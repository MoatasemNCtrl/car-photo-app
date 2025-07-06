/**
 * Integration example for React Native Car Photo App
 * Shows how to integrate the custom YOLO damage detection with existing Gemini analysis
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';

// Add this to your existing App.js

const DamageDetectionService = {
  /**
   * Analyze image for vehicle damage using custom YOLO model
   */
  async detectDamage(imageUri, serverUrl = 'http://localhost:8000') {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'car_damage.jpg',
      });
      formData.append('confidence', '0.5'); // Adjust threshold as needed

      const response = await fetch(`${serverUrl}/detect-damage`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Damage detection failed:', error);
      throw error;
    }
  },

  /**
   * Get annotated image with damage detections highlighted
   */
  async detectDamageWithAnnotation(imageUri, serverUrl = 'http://localhost:8000') {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'car_damage.jpg',
      });

      const response = await fetch(`${serverUrl}/detect-damage-with-image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Damage detection with annotation failed:', error);
      throw error;
    }
  }
};

// Enhanced analysis function combining YOLO + Gemini
const analyzeCarImageEnhanced = async (imageUri) => {
  try {
    setIsAnalyzing(true);
    
    // Run both analyses in parallel for faster results
    const [geminiAnalysis, damageDetection] = await Promise.all([
      analyzeCarImage(imageUri), // Your existing Gemini analysis
      DamageDetectionService.detectDamage(imageUri).catch(error => {
        console.log('YOLO damage detection not available:', error.message);
        return null; // Fallback gracefully if YOLO server is not running
      })
    ]);

    // Combine results
    const enhancedAnalysis = {
      ...geminiAnalysis,
      damage_detection: damageDetection ? {
        detected_damages: damageDetection.detailed_damages,
        total_damages: damageDetection.total_damages,
        severity: damageDetection.severity_assessment,
        damage_summary: damageDetection.damage_summary
      } : null,
      analysis_method: damageDetection ? 'Gemini + YOLO' : 'Gemini Only'
    };

    return enhancedAnalysis;

  } catch (error) {
    console.error('Enhanced analysis failed:', error);
    // Fallback to Gemini-only analysis
    return await analyzeCarImage(imageUri);
  } finally {
    setIsAnalyzing(false);
  }
};

// Example component for damage detection results
const DamageDetectionResults = ({ damageData }) => {
  if (!damageData) return null;

  return (
    <View style={styles.damageResults}>
      <Text style={styles.damageTitle}>🔍 Damage Detection Results</Text>
      
      <View style={styles.severityBadge}>
        <Text style={styles.severityText}>
          Severity: {damageData.severity}
        </Text>
      </View>

      <Text style={styles.damageCount}>
        Total Damages: {damageData.total_damages}
      </Text>

      {Object.entries(damageData.damage_summary).map(([type, count]) => (
        <Text key={type} style={styles.damageItem}>
          • {type.replace('_', ' ')}: {count}
        </Text>
      ))}

      {damageData.detected_damages.map((damage, index) => (
        <View key={index} style={styles.damageDetail}>
          <Text style={styles.damageType}>{damage.type}</Text>
          <Text style={styles.damageConfidence}>
            Confidence: {(damage.confidence * 100).toFixed(1)}%
          </Text>
        </View>
      ))}
    </View>
  );
};

// Enhanced styles
const enhancedStyles = StyleSheet.create({
  damageResults: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    marginVertical: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  damageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  severityBadge: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  severityText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  damageCount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#34495e',
  },
  damageItem: {
    fontSize: 13,
    marginVertical: 2,
    color: '#7f8c8d',
  },
  damageDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  damageType: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
  },
  damageConfidence: {
    fontSize: 12,
    color: '#7f8c8d',
  },
});

export { DamageDetectionService, DamageDetectionResults, analyzeCarImageEnhanced };
