import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@env';
import { Buffer } from 'buffer';

export default function App() {
  const [images, setImages] = useState([]);
  const [carDetails, setCarDetails] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

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
      // Validate each selected image
      setIsValidating(true);
      const validImages = [];
      const invalidImages = [];
      
      for (const asset of result.assets) {
        try {
          console.log('Validating image:', asset.uri);
          
          // Check if image contains a vehicle
          const validation = await validateCarImage(asset.uri);
          
          if (!validation.contains_vehicle) {
            invalidImages.push({
              uri: asset.uri,
              reason: `Not a vehicle: ${validation.reason}`
            });
            continue;
          }
          
          // If we have existing photos, check consistency
          if (images.length > 0 || validImages.length > 0) {
            const consistency = await checkCarConsistency(asset.uri);
            
            if (!consistency.matches_expected && consistency.confidence !== "low") {
              invalidImages.push({
                uri: asset.uri,
                reason: `Different vehicle: ${consistency.reason}`
              });
              continue;
            }
          }
          
          validImages.push(asset);
          
        } catch (error) {
          console.error('Error validating image:', error);
          // On validation error, allow the image
          validImages.push(asset);
        }
      }
      
      setIsValidating(false);
      
      // Show results to user
      if (invalidImages.length > 0 && validImages.length === 0) {
        Alert.alert(
          'Invalid Images',
          `None of the selected images contain vehicles or match your existing car photos. Please select images that show cars, trucks, or other motor vehicles.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (invalidImages.length > 0) {
        Alert.alert(
          'Some Images Rejected',
          `${invalidImages.length} image(s) were rejected:\n${invalidImages.map(img => `• ${img.reason}`).join('\n')}\n\n${validImages.length} valid image(s) will be added.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Valid Images', onPress: () => setImages([...images, ...validImages]) }
          ]
        );
      } else {
        // All images are valid
        setImages([...images, ...validImages]);
        if (validImages.length > 0) {
          Alert.alert(
            'Images Added',
            `Successfully added ${validImages.length} vehicle image(s).`,
            [{ text: 'OK' }]
          );
        }
      }
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
      // Validate the captured photo
      setIsValidating(true);
      
      try {
        const asset = result.assets[0];
        console.log('Validating captured photo:', asset.uri);
        
        // Check if image contains a vehicle
        const validation = await validateCarImage(asset.uri);
        
        if (!validation.contains_vehicle) {
          setIsValidating(false);
          Alert.alert(
            'Not a Vehicle',
            `The captured image doesn't appear to contain a vehicle. ${validation.reason}\n\nPlease take a photo of a car, truck, or other motor vehicle.`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // If we have existing photos, check consistency
        if (images.length > 0) {
          const consistency = await checkCarConsistency(asset.uri);
          
          if (!consistency.matches_expected && consistency.confidence !== "low") {
            setIsValidating(false);
            Alert.alert(
              'Different Vehicle Detected',
              `This appears to be a different vehicle than your existing photos. ${consistency.reason}\n\nWould you like to start a new session with this vehicle?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Start New Session', 
                  onPress: () => {
                    setImages([asset]);
                    setCarDetails([]);
                  }
                }
              ]
            );
            return;
          }
        }
        
        // Photo is valid, add it
        setImages([...images, asset]);
        Alert.alert(
          'Photo Added',
          'Vehicle photo captured successfully!',
          [{ text: 'OK' }]
        );
        
      } catch (error) {
        console.error('Error validating captured photo:', error);
        // On validation error, allow the photo
        setImages([...images, result.assets[0]]);
      } finally {
        setIsValidating(false);
      }
    }
  };

  // Validate if image contains a car
  const validateCarImage = async (imageUri) => {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convert image to base64
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');

      // Simple validation prompt
      const prompt = `Look at this image and determine if it contains a car, truck, motorcycle, or any motor vehicle as the main subject.

Return ONLY a JSON object with this format:
{
  "contains_vehicle": true/false,
  "vehicle_type": "car/truck/motorcycle/suv/van/other" (only if contains_vehicle is true),
  "confidence": "high/medium/low",
  "reason": "Brief explanation"
}

Be strict - only return true if there's clearly a motor vehicle as the main subject.`;

      const imagePart = {
        inlineData: {
          data: base64String,
          mimeType: "image/jpeg"
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const analysis = result.response.text();
      
      console.log('Vehicle validation response:', analysis);
      
      // Clean and parse response
      let jsonStr = analysis.trim();
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      let startIndex = jsonStr.indexOf('{');
      let endIndex = jsonStr.lastIndexOf('}');
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        jsonStr = jsonStr.substring(startIndex, endIndex + 1);
      }
      
      const validation = JSON.parse(jsonStr);
      return validation;
    } catch (error) {
      console.error('Error validating image:', error);
      // On error, assume it might be a car to avoid blocking users
      return { 
        contains_vehicle: true, 
        vehicle_type: "unknown", 
        confidence: "low", 
        reason: "Validation failed, allowing upload" 
      };
    }
  };

  // Check if new photos match existing car
  const checkCarConsistency = async (newImageUri) => {
    // If no existing photos or no car details analyzed yet, allow the new photo
    if (images.length === 0 || carDetails.length === 0) {
      return { matches_expected: true, confidence: "high", reason: "First photo or no analysis done yet" };
    }
    
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const response = await fetch(newImageUri);
      const arrayBuffer = await response.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');

      // Get existing car details for comparison
      const existingCar = carDetails[0];
      const expectedBrand = existingCar.brand || 'Unknown';
      const expectedModel = existingCar.model || 'Unknown';
      const expectedColor = existingCar.color || 'Unknown';

      const prompt = `Look at this car image and identify the brand, model, and color.

Expected car details from previous photos:
- Brand: ${expectedBrand}
- Model: ${expectedModel} 
- Color: ${expectedColor}

Return ONLY a JSON object:
{
  "brand": "detected brand",
  "model": "detected model", 
  "color": "detected color",
  "matches_expected": true/false,
  "confidence": "high/medium/low",
  "reason": "Brief explanation of match/mismatch"
}`;

      const imagePart = {
        inlineData: {
          data: base64String,
          mimeType: "image/jpeg"
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const analysis = result.response.text();
      
      console.log('Consistency check response:', analysis);
      
      // Parse response
      let jsonStr = analysis.trim();
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      let startIndex = jsonStr.indexOf('{');
      let endIndex = jsonStr.lastIndexOf('}');
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        jsonStr = jsonStr.substring(startIndex, endIndex + 1);
      }
      
      const consistency = JSON.parse(jsonStr);
      return consistency;
    } catch (error) {
      console.error('Error checking consistency:', error);
      // On error, assume consistency to avoid blocking users
      return { matches_expected: true, confidence: "low", reason: "Validation failed, allowing upload" };
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

      // Enhanced prompt for car analysis + price prediction
      const prompt = `Analyze this car image and return ONLY a valid JSON object with car details and value estimation.

IMPORTANT: Always include BOTH pre-damage and post-damage value estimates.

Required JSON format:
{
  "brand": "Car brand (e.g., Toyota, BMW, Ford)",
  "model": "Model name (e.g., Camry, 911, F-150)",
  "year": "Year or range (e.g., 2020, 2018-2020)",
  "body_type": "Vehicle type (e.g., Sedan, SUV, Sports Car)",
  "color": "Primary color (e.g., Red, Blue, Silver)",
  "confidence_level": "high, medium, or low",
  "damage_detected": true or false,
  "damage_severity": "none, minor, moderate, or severe",
  "estimated_value_undamaged": "Pre-damage market value if vehicle was in perfect condition (e.g., $20,000 - $22,000)",
  "estimated_value_current": "Current market value considering actual condition and damage (e.g., $15,000 - $18,000)",
  "value_factors": "Key factors affecting value (condition, rarity, model year, etc.)",
  "damage_types": ["list of damage types if any"],
  "damage_description": "Brief description of any damage",
  "condition_assessment": "Overall condition summary"
}

For luxury/exotic cars, provide realistic high-end valuations. For damaged vehicles, reduce the estimated value accordingly. Consider the vehicle's brand prestige, model rarity, condition, and market demand. Return ONLY the JSON object, no other text.`;

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

  // Content for each tab
  const renderHomeContent = () => (
    <>
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
            <Text style={styles.detailsTitle}>🚗 Vehicle Analysis & Valuation</Text>
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
                  
                  {/* Price Prediction */}
                  {(details.estimated_value_current || details.estimated_value) && (
                    <View style={styles.priceSection}>
                      <Text style={styles.priceTitle}>� Current Value</Text>
                      <Text style={styles.estimatedPrice}>
                        {details.estimated_value_current || details.estimated_value}
                      </Text>
                      
                      {details.damage_detected && (
                        <Text style={styles.damageImpact}>
                          {details.damage_severity === 'severe' ? '🔴 Significant damage detected - value reduced' :
                           details.damage_severity === 'moderate' ? '🟡 Moderate damage detected - value affected' :
                           details.damage_severity === 'minor' ? '🟢 Minor damage detected - slight impact' :
                           '✅ No significant damage detected'}
                        </Text>
                      )}
                      
                      {details.value_factors && (
                        <Text style={styles.valueFactors}>
                          Key factors: {details.value_factors}
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
    </>
  );

  const renderDamageContent = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🔧 Damage Reports & Analysis</Text>
        <Text style={styles.tabSubtitle}>Detailed damage assessment and repair information</Text>
      </View>
      
      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>📋 Comprehensive Damage Analysis</Text>
        <Text style={styles.cardText}>• Detailed damage assessment with severity ratings</Text>
        <Text style={styles.cardText}>• Professional repair cost estimates</Text>
        <Text style={styles.cardText}>• Impact on vehicle value and resale potential</Text>
        <Text style={styles.cardText}>• Component-level damage identification</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>🔩 Replacement Parts</Text>
        <Text style={styles.cardText}>• Find compatible replacement parts</Text>
        <Text style={styles.cardText}>• Get cost estimates for repairs</Text>
        <Text style={styles.cardText}>• Connect with local repair shops</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>📊 Detailed Damage Reports</Text>
        {carDetails.length > 0 ? (
          carDetails.map((details, index) => (
            <View key={index} style={styles.damageReportCard}>
              <Text style={styles.damageReportTitle}>
                📸 {details.brand} {details.model} ({details.year}) - Photo {index + 1}
              </Text>
              
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
                      Estimated Repair Cost: {details.estimated_repair_cost}
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
              
              {/* Value Impact */}
              {(details.estimated_value_current || details.estimated_value || details.estimated_value_undamaged) && (
                <View style={styles.valueImpactSection}>
                  <Text style={styles.valueImpactTitle}>💰 Value Analysis</Text>
                  
                  {/* Pre-damage value */}
                  {details.estimated_value_undamaged && (
                    <Text style={styles.undamagedValue}>
                      Pre-damage Value: {details.estimated_value_undamaged}
                    </Text>
                  )}
                  
                  {/* Current value */}
                  <Text style={styles.currentValue}>
                    Current Value: {details.estimated_value_current || details.estimated_value}
                  </Text>
                  
                  {/* Value difference calculation */}
                  {details.estimated_value_undamaged && details.estimated_value_current && (
                    <Text style={styles.valueDifference}>
                      💥 Impact: Value affected by damage/condition
                    </Text>
                  )}
                  
                  {details.value_factors && (
                    <Text style={styles.valueFactors}>Factors: {details.value_factors}</Text>
                  )}
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>No damage reports available. Upload and analyze car photos in the Home tab first.</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderModsContent = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>⚡ Modifications</Text>
        <Text style={styles.tabSubtitle}>Car modifications and customization</Text>
      </View>
      
      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>🏁 Performance Mods</Text>
        <Text style={styles.cardText}>• Engine tuning and upgrades</Text>
        <Text style={styles.cardText}>• Exhaust system modifications</Text>
        <Text style={styles.cardText}>• Suspension and handling improvements</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>🎨 Aesthetic Mods</Text>
        <Text style={styles.cardText}>• Body kits and spoilers</Text>
        <Text style={styles.cardText}>• Custom paint and wraps</Text>
        <Text style={styles.cardText}>• Lighting upgrades</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>🔧 Interior Mods</Text>
        <Text style={styles.cardText}>• Custom seats and upholstery</Text>
        <Text style={styles.cardText}>• Audio system upgrades</Text>
        <Text style={styles.cardText}>• Dashboard and trim modifications</Text>
      </View>

      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonText}>🚧 Coming Soon</Text>
        <Text style={styles.cardText}>AI-powered modification recommendations based on your car model</Text>
      </View>
    </ScrollView>
  );

  const renderProfileContent = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>👤 Profile & Saved Prompts</Text>
        <Text style={styles.tabSubtitle}>Manage your profile and custom analysis prompts</Text>
      </View>
      
      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>📱 Profile Settings</Text>
        <Text style={styles.cardText}>• Customize analysis preferences</Text>
        <Text style={styles.cardText}>• Set default image quality</Text>
        <Text style={styles.cardText}>• Manage notification settings</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>💾 Saved Prompts</Text>
        <Text style={styles.cardText}>• Create custom analysis prompts</Text>
        <Text style={styles.cardText}>• Save frequently used queries</Text>
        <Text style={styles.cardText}>• Share prompts with community</Text>
      </View>

      <View style={styles.tabCard}>
        <Text style={styles.cardTitle}>📈 Analysis History</Text>
        <Text style={styles.cardText}>• View past car analyses</Text>
        <Text style={styles.cardText}>• Export analysis reports</Text>
        <Text style={styles.cardText}>• Track vehicle condition over time</Text>
      </View>

      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonText}>🚧 Coming Soon</Text>
        <Text style={styles.cardText}>Cloud sync and user accounts</Text>
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHomeContent();
      case 'damage':
        return renderDamageContent();
      case 'mods':
        return renderModsContent();
      case 'profile':
        return renderProfileContent();
      default:
        return renderHomeContent();
    }
  };  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Tab Content */}
      <View style={styles.mainContent}>
        {renderTabContent()}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'home' && styles.activeNavItem]} 
          onPress={() => setActiveTab('home')}
        >
          <Text style={[styles.navIcon, activeTab === 'home' && styles.activeNavIcon]}>🏠</Text>
          <Text style={[styles.navText, activeTab === 'home' && styles.activeNavText]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'damage' && styles.activeNavItem]} 
          onPress={() => setActiveTab('damage')}
        >
          <Text style={[styles.navIcon, activeTab === 'damage' && styles.activeNavIcon]}>🔧</Text>
          <Text style={[styles.navText, activeTab === 'damage' && styles.activeNavText]}>Damage</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'mods' && styles.activeNavItem]} 
          onPress={() => setActiveTab('mods')}
        >
          <Text style={[styles.navIcon, activeTab === 'mods' && styles.activeNavIcon]}>⚡</Text>
          <Text style={[styles.navText, activeTab === 'mods' && styles.activeNavText]}>Mods</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'profile' && styles.activeNavItem]} 
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.activeNavIcon]}>👤</Text>
          <Text style={[styles.navText, activeTab === 'profile' && styles.activeNavText]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Modal for Validation */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={isValidating}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            <Text style={styles.modalTitle}>Validating Photo</Text>
            <Text style={styles.modalText}>
              Checking if this image contains a vehicle...
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  mainContent: {
    flex: 1,
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
  // Price Prediction Styles
  priceSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  priceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  estimatedPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 6,
  },
  undamagedValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 4,
  },
  valueDifference: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  damageImpact: {
    fontSize: 12,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  valueFactors: {
    fontSize: 11,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  // Damage Report Styles (for damage tab)
  damageReportCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  damageReportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#495057',
    textAlign: 'center',
  },
  valueImpactSection: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  valueImpactTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#856404',
  },
  currentValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  // Bottom Navigation Styles
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingBottom: 25, // Extra padding for safe area
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavItem: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  activeNavIcon: {
    fontSize: 22,
  },
  navText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeNavText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // Tab Content Styles
  tabContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tabSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tabCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  comingSoonCard: {
    backgroundColor: '#fff9e6',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
    borderStyle: 'dashed',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff8c00',
    marginBottom: 8,
  },
  assessmentItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  assessmentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  assessmentStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 280,
  },
  loader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
