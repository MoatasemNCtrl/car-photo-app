import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@env';
import { Buffer } from 'buffer';

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

  // Analyze car details using Gemini AI vision
  const analyzeCarImage = async (imageUri, retryCount = 0) => {
    try {
      setIsAnalyzing(true);
      
      // Debug: Check if API key is loaded
      console.log('Gemini API Key loaded:', GEMINI_API_KEY ? 'Yes' : 'No');
      console.log('API Key length:', GEMINI_API_KEY?.length);
      console.log('API Key starts with:', GEMINI_API_KEY?.substring(0, 15) + '...');
      
      if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
        Alert.alert('API Key Missing', 'Gemini API key not found. Please check your .env file and restart the app.');
        throw new Error('Gemini API key not found. Please check your .env file.');
      }
      
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convert image to base64
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');

      // Simplified and more reliable prompt for car analysis + damage detection
      const prompt = `Analyze this car image and return ONLY a valid JSON object with car details and damage assessment.

Required JSON format:
{
  "brand": "Car brand (e.g., Toyota, BMW, Ford)",
  "model": "Model name (e.g., Camry, 911, F-150)",
  "year": "Year or range (e.g., 2020, 2018-2020)",
  "body_type": "Vehicle type (e.g., Sedan, SUV, Sports Car)",
  "color": "Primary color (e.g., Red, Blue, Silver)",
  "confidence_level": "high, medium, or low",
  "damage_detected": true or false,
  "damage_types": ["list of damage types if any"],
  "damage_severity": "none, minor, moderate, or severe",
  "damage_description": "Brief description of any damage",
  "condition_assessment": "Overall condition summary"
}

Look for visible damage like scratches, dents, broken parts, collision damage, or rust. Return ONLY the JSON object, no other text.`;

      // Create image part for Gemini
      const imagePart = {
        inlineData: {
          data: base64String,
          mimeType: "image/jpeg"
        }
      };

      // Generate content
      const result = await model.generateContent([prompt, imagePart]);
      const analysis = result.response.text();
      
      console.log('Gemini response:', analysis);
      
      try {
        // Clean the response to extract JSON - be more aggressive
        let jsonStr = analysis.trim();
        
        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Find JSON object boundaries
        let startIndex = jsonStr.indexOf('{');
        let endIndex = jsonStr.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          jsonStr = jsonStr.substring(startIndex, endIndex + 1);
        }
        
        console.log('Cleaned JSON string:', jsonStr);
        
        const carInfo = JSON.parse(jsonStr);
        
        // Validate that we have the minimum required fields
        if (!carInfo.brand && !carInfo.model) {
          throw new Error('Missing essential car information');
        }
        
        return carInfo;
      } catch (parseError) {
        console.log('JSON parsing failed:', parseError.message);
        console.log('Attempting fallback parsing...');
        
        // Fallback: create a structured response from the text
        return {
          brand: "Analysis Complete",
          model: "See details below", 
          year: "Text format",
          body_type: "Analysis provided",
          color: "Check description",
          confidence_level: "medium",
          damage_detected: analysis.toLowerCase().includes('damage') || analysis.toLowerCase().includes('crash'),
          damage_types: [],
          damage_severity: "unknown",
          damage_description: "Full analysis in text format",
          condition_assessment: "See analysis below",
          analysis: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : '') // Truncate long responses
        };
      }
    } catch (error) {
      console.error('Error analyzing car:', error);
      console.error('Error details:', error.message);
      
      // Provide specific error messages based on the error type
      if (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid API key')) {
        return {
          brand: "Authentication Error",
          model: "Invalid API Key",
          year: "Please check your Gemini API key",
          body_type: "Error",
          color: "N/A",
          note: "The API key may be invalid or expired. Please check your .env file."
        };
      } else if (error.message.includes('RATE_LIMIT') || error.message.includes('quota')) {
        return {
          brand: "Rate Limit",
          model: "Too Many Requests",
          year: "Please wait and try again",
          body_type: "Error",
          color: "N/A",
          note: "You've reached the API rate limit. Please wait a moment and try again."
        };
      } else if (error.message.includes('Network') || error.message.includes('network')) {
        return {
          brand: "Network Error",
          model: "No Internet Connection",
          year: "Please check your connection",
          body_type: "Error",
          color: "N/A",
          note: "Please check your internet connection and try again."
        };
      } else {
        return {
          brand: "Analysis Error",
          model: "Unable to analyze",
          year: "Please try again",
          body_type: "Error", 
          color: "N/A",
          note: `Error: ${error.message}. Check the console for more details.`
        };
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeAllImages = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please upload some car photos first.');
      return;
    }

    // Warn about rate limits for multiple images
    if (images.length > 1) {
      Alert.alert(
        'Multiple Images Detected',
        `You're about to analyze ${images.length} images. This will take a moment as we analyze each image individually. Consider using the single image analysis (🔍 button) for faster results.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => performBatchAnalysis() }
        ]
      );
    } else {
      performBatchAnalysis();
    }
  };

  const performBatchAnalysis = async () => {
    setIsAnalyzing(true);
    const analyses = [];
    
    // Add smaller delay between requests for Gemini
    for (let i = 0; i < images.length; i++) {
      try {
        const analysis = await analyzeCarImage(images[i].uri);
        analyses.push(analysis);
        
        // Add a shorter delay between requests
        if (i < images.length - 1) {
          console.log(`Waiting 3 seconds before analyzing next image...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        }
      } catch (error) {
        console.error(`Error analyzing image ${i + 1}:`, error);
        analyses.push({
          brand: "Analysis Failed",
          model: "Error occurred",
          year: "Skipped",
          body_type: "Error",
          color: "N/A",
          note: `Failed to analyze image ${i + 1}`
        });
      }
    }
    
    setCarDetails(analyses);
    setIsAnalyzing(false);
  };

  const testAPIConnection = async () => {
    try {
      console.log('Testing Gemini API connection...');
      console.log('Gemini API Key loaded:', GEMINI_API_KEY ? 'Yes' : 'No');
      console.log('API Key length:', GEMINI_API_KEY?.length);
      console.log('API Key starts with:', GEMINI_API_KEY?.substring(0, 15) + '...');
      
      if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
        Alert.alert('API Key Missing', 'Please check your .env file');
        return;
      }

      // Simple text-only API test with Gemini
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent("Just respond with 'Gemini API working' if you receive this message.");
      const response = result.response.text();

      console.log('Gemini API Test Response:', response);
      Alert.alert('API Test Success', response || 'Gemini API is working!');
      
    } catch (error) {
      console.error('Gemini API Test Error:', error);
      console.error('Error message:', error.message);
      Alert.alert('API Test Failed', `Error: ${error.message}`);
    }
  };

  const analyzeSingleImage = async (index) => {
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeCarImage(images[index].uri);
      const newCarDetails = [...carDetails];
      newCarDetails[index] = analysis;
      setCarDetails(newCarDetails);
    } catch (error) {
      console.error('Error analyzing single image:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to get severity styling
  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'total_loss':
      case 'totaled':
        return { color: '#8b0000', fontWeight: 'bold', backgroundColor: '#ffebee', padding: 4, borderRadius: 4 };
      case 'severe':
        return { color: '#e74c3c', fontWeight: 'bold' };
      case 'moderate':
        return { color: '#f39c12', fontWeight: 'bold' };
      case 'minor':
        return { color: '#f1c40f', fontWeight: 'bold' };
      case 'none':
        return { color: '#27ae60', fontWeight: 'bold' };
      default:
        return { color: '#27ae60', fontWeight: 'bold' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚗 Car Photo App</Text>
        <Text style={styles.subtitle}>Capture and analyze your car photos with Gemini AI</Text>
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
              <Text style={styles.analyzeButtonText}>🔍 Analyze with Gemini AI</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* API Test Button */}
      <View style={styles.analyzeContainer}>
        <TouchableOpacity style={styles.testButton} onPress={testAPIConnection}>
          <Text style={styles.testButtonText}>🧪 Test API Connection</Text>
        </TouchableOpacity>
      </View>

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
            
            {/* Single Image Analyze Button */}
            <TouchableOpacity 
              style={styles.analyzeImageButton} 
              onPress={() => analyzeSingleImage(index)}
              disabled={isAnalyzing}
            >
              <Text style={styles.analyzeImageButtonText}>🔍</Text>
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

        {/* Detailed Car Analysis - moved inside the main ScrollView */}
        {carDetails.length > 0 && (
          <View style={styles.detailsSection}>
            <Text style={styles.detailsTitle}>🚗 Car Analysis Results</Text>
            {carDetails.map((details, index) => (
              <View key={index} style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>📸 Photo {index + 1} Analysis</Text>
                
                {/* Car Information */}
                <View style={styles.carInfoSection}>
                  <Text style={styles.sectionTitle}>🚗 Vehicle Information</Text>
                  <Text style={styles.detailItem}>Brand: {details.brand || 'Unknown'}</Text>
                  <Text style={styles.detailItem}>Model: {details.model || 'Unknown'}</Text>
                  <Text style={styles.detailItem}>Year: {details.year || 'Unknown'}</Text>
                  <Text style={styles.detailItem}>Type: {details.body_type || 'Unknown'}</Text>
                  <Text style={styles.detailItem}>Color: {details.color || 'Unknown'}</Text>
                </View>
                  
                  {/* Damage Assessment */}
                  {details.damage_detected !== undefined && (
                    <View style={styles.damageSection}>
                      <Text style={styles.damageTitle}>🔍 Damage Assessment</Text>
                      <Text style={[styles.damageStatus, details.damage_detected ? styles.damageFound : styles.noDamage]}>
                        {details.damage_detected ? '⚠️ Damage Detected' : '✅ No Damage Found'}
                      </Text>
                      
                      {details.damage_severity && (
                        <Text style={[styles.damageSeverity, getSeverityStyle(details.damage_severity)]}>
                          Severity: {details.damage_severity.toUpperCase()}
                        </Text>
                      )}
                      
                      {details.estimated_repair_cost && (
                        <Text style={styles.repairCost}>
                          Estimated Repair Cost: {details.estimated_repair_cost.toUpperCase()}
                        </Text>
                      )}
                      
                      {details.damage_types && details.damage_types.length > 0 && (
                        <View style={styles.damageTypes}>
                          <Text style={styles.damageTypesTitle}>Damage Types:</Text>
                          {details.damage_types.map((type, idx) => (
                            <Text key={idx} style={styles.damageType}>• {type.replace(/_/g, ' ')}</Text>
                          ))}
                        </View>
                      )}
                      
                      {details.damage_description && (
                        <Text style={styles.damageDescription}>
                          Description: {details.damage_description}
                        </Text>
                      )}
                      
                      {details.condition_assessment && (
                        <Text style={styles.conditionAssessment}>
                          Overall Condition: {details.condition_assessment}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {/* Confidence and Features */}
                  {details.confidence_level && (
                    <Text style={[styles.detailItem, styles.confidenceText]}>
                      Confidence: {details.confidence_level}
                    </Text>
                  )}
                  {details.additional_features && (
                    <Text style={styles.detailFeatures}>
                      Features: {details.additional_features}
                    </Text>
                  )}
                  {details.note && (
                    <Text style={styles.detailNote}>{details.note}</Text>
                  )}
                </View>
              ))}
          </View>
        )}
      </ScrollView>
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
  testButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    paddingBottom: 20, // Add padding at bottom for better spacing
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
  analyzeImageButton: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(255, 107, 53, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeImageButtonText: {
    color: 'white',
    fontSize: 14,
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
    marginTop: 20,
    width: '100%',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  detailCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
    textAlign: 'center',
  },
  carInfoSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  detailItem: {
    fontSize: 12,
    marginBottom: 4,
    color: '#333',
  },
  confidenceText: {
    color: '#28a745',
    fontWeight: '600',
  },
  detailFeatures: {
    fontSize: 11,
    marginBottom: 4,
    color: '#495057',
    fontStyle: 'italic',
  },
  detailNote: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#dc3545',
    marginTop: 8,
    fontWeight: '500',
  },
  // Damage Assessment Styles
  damageSection: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  damageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  damageStatus: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  damageFound: {
    color: '#e74c3c',
  },
  noDamage: {
    color: '#27ae60',
  },
  damageSeverity: {
    fontSize: 12,
    marginBottom: 6,
  },
  repairCost: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 'bold',
    color: '#8e44ad',
  },
  damageTypes: {
    marginBottom: 8,
  },
  damageTypesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#34495e',
  },
  damageType: {
    fontSize: 11,
    marginLeft: 8,
    marginBottom: 2,
    color: '#7f8c8d',
  },
  damageDescription: {
    fontSize: 11,
    marginBottom: 6,
    color: '#5d6d7e',
    fontStyle: 'italic',
  },
  conditionAssessment: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2c3e50',
  },
});
