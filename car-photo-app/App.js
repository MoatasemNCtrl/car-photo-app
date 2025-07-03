import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { OPENAI_API_KEY } from '@env';

export default function App() {
  const [images, setImages] = useState([]);
  const [carDetails, setCarDetails] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
  };

  const takePhoto = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    // Also remove corresponding car details
    const newCarDetails = carDetails.filter((_, i) => i !== index);
    setCarDetails(newCarDetails);
  };

  // Analyze car details using AI vision
  const analyzeCarImage = async (imageUri) => {
    try {
      setIsAnalyzing(true);
      
      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // Call OpenAI Vision API
      const apiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this car image and provide detailed information in JSON format. Include: brand, model, year (or year range), body_type, color, and any other notable features you can identify. If it's an interior shot, identify interior features, materials, etc. Be as specific as possible."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const analysis = apiResponse.data.choices[0].message.content;
      
      try {
        // Try to parse as JSON
        const carInfo = JSON.parse(analysis);
        return carInfo;
      } catch {
        // If not JSON, return as text analysis
        return { analysis: analysis };
      }
    } catch (error) {
      console.error('Error analyzing car:', error);
      // Return a mock analysis for demo purposes
      return {
        brand: "Analysis unavailable",
        model: "Please add API key",
        year: "Demo mode",
        body_type: "Various",
        color: "Multiple",
        confidence: "Low",
        note: "Add your OpenAI API key to enable real analysis"
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeAllImages = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please upload some car photos first.');
      return;
    }

    setIsAnalyzing(true);
    const analyses = [];
    
    for (let i = 0; i < images.length; i++) {
      const analysis = await analyzeCarImage(images[i].uri);
      analyses.push(analysis);
    }
    
    setCarDetails(analyses);
    setIsAnalyzing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚗 Car Photo App</Text>
        <Text style={styles.subtitle}>Capture and organize your car photos</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Analyze Button */}
      {images.length > 0 && (
        <View style={styles.analyzeContainer}>
          <TouchableOpacity 
            style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]} 
            onPress={analyzeAllImages}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <View style={styles.analyzeButtonContent}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.analyzeButtonText}>Analyzing...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeButtonText}>🔍 Analyze Car Details</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Image Count */}
      {images.length > 0 && (
        <Text style={styles.imageCount}>{images.length} photo{images.length !== 1 ? 's' : ''} uploaded</Text>
      )}

      {/* Image Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.imageGrid}>
        {images.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.image} />
            <TouchableOpacity 
              style={styles.removeButton} 
              onPress={() => removeImage(index)}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
            
            {/* Car Details Overlay */}
            {carDetails[index] && (
              <View style={styles.carDetailsOverlay}>
                <Text style={styles.carBrand}>
                  {carDetails[index].brand} {carDetails[index].model}
                </Text>
                <Text style={styles.carYear}>{carDetails[index].year}</Text>
                <Text style={styles.carColor}>{carDetails[index].color}</Text>
              </View>
            )}
          </View>
        ))}
        
        {images.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>Take a photo or choose from your gallery to get started</Text>
          </View>
        )}
      </ScrollView>

      {/* Detailed Car Analysis */}
      {carDetails.length > 0 && (
        <View style={styles.detailsSection}>
          <Text style={styles.detailsTitle}>🚗 Car Analysis Results</Text>
          <ScrollView style={styles.detailsScroll} horizontal showsHorizontalScrollIndicator={false}>
            {carDetails.map((details, index) => (
              <View key={index} style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Photo {index + 1}</Text>
                <Text style={styles.detailItem}>Brand: {details.brand || 'Unknown'}</Text>
                <Text style={styles.detailItem}>Model: {details.model || 'Unknown'}</Text>
                <Text style={styles.detailItem}>Year: {details.year || 'Unknown'}</Text>
                <Text style={styles.detailItem}>Type: {details.body_type || 'Unknown'}</Text>
                <Text style={styles.detailItem}>Color: {details.color || 'Unknown'}</Text>
                {details.note && (
                  <Text style={styles.detailNote}>{details.note}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    flex: 0.45,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  analyzeContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  analyzeButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
  },
  analyzeButtonDisabled: {
    backgroundColor: '#999',
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imageCount: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  carDetailsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
  },
  carBrand: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  carYear: {
    color: 'white',
    fontSize: 10,
  },
  carColor: {
    color: 'white',
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#bbb',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  detailsSection: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 200,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  detailsScroll: {
    flexGrow: 0,
  },
  detailCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginRight: 15,
    minWidth: 200,
  },
  detailCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF',
  },
  detailItem: {
    fontSize: 12,
    marginBottom: 4,
    color: '#333',
  },
  detailNote: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 8,
  },
});
