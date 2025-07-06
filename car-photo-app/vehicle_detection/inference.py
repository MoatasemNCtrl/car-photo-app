#!/usr/bin/env python3
"""
Run inference with trained YOLOv8 damage detection model
"""

import argparse
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import json

class DamageDetector:
    def __init__(self, model_path='./models/damage_detection/weights/best.pt'):
        self.model_path = Path(model_path)
        self.model = None
        self.damage_classes = {
            0: 'scratch',
            1: 'dent', 
            2: 'crack',
            3: 'glass_damage',
            4: 'paint_damage',
            5: 'bumper_damage',
            6: 'headlight_damage',
            7: 'tire_damage',
            8: 'rust',
            9: 'broken_part'
        }
        
    def load_model(self):
        """Load the trained damage detection model"""
        if not self.model_path.exists():
            print(f"❌ Model not found: {self.model_path}")
            print("Please train the model first: python train_model.py")
            return False
        
        print(f"📥 Loading model: {self.model_path}")
        self.model = YOLO(str(self.model_path))
        print("✅ Model loaded successfully")
        return True
    
    def detect_damage(self, image_path, confidence_threshold=0.5):
        """
        Detect damage in an image
        Returns: List of detected damages with bounding boxes and confidence
        """
        if not self.model:
            if not self.load_model():
                return None
        
        image_path = Path(image_path)
        if not image_path.exists():
            print(f"❌ Image not found: {image_path}")
            return None
        
        print(f"🔍 Analyzing image: {image_path}")
        
        # Run inference
        results = self.model(str(image_path), conf=confidence_threshold)
        
        damages = []
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Extract detection info
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    
                    damage_type = self.damage_classes.get(class_id, f"unknown_{class_id}")
                    
                    damage_info = {
                        'type': damage_type,
                        'confidence': confidence,
                        'bbox': bbox,
                        'bbox_formatted': {
                            'x1': int(bbox[0]),
                            'y1': int(bbox[1]), 
                            'x2': int(bbox[2]),
                            'y2': int(bbox[3])
                        }
                    }
                    
                    damages.append(damage_info)
        
        return damages
    
    def visualize_detections(self, image_path, damages, output_path=None):
        """Visualize detections on the image"""
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"❌ Could not load image: {image_path}")
            return None
        
        # Color map for different damage types
        colors = {
            'scratch': (0, 255, 255),      # Yellow
            'dent': (255, 0, 0),           # Blue
            'crack': (0, 0, 255),          # Red
            'glass_damage': (255, 255, 0), # Cyan
            'paint_damage': (255, 0, 255), # Magenta
            'bumper_damage': (0, 255, 0),  # Green
            'headlight_damage': (128, 0, 128), # Purple
            'tire_damage': (255, 165, 0),  # Orange
            'rust': (139, 69, 19),         # Brown
            'broken_part': (128, 128, 128) # Gray
        }
        
        for damage in damages:
            bbox = damage['bbox_formatted']
            damage_type = damage['type']
            confidence = damage['confidence']
            
            # Get color for this damage type
            color = colors.get(damage_type, (255, 255, 255))
            
            # Draw bounding box
            cv2.rectangle(image, 
                         (bbox['x1'], bbox['y1']), 
                         (bbox['x2'], bbox['y2']), 
                         color, 2)
            
            # Add label
            label = f"{damage_type}: {confidence:.2f}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
            
            cv2.rectangle(image,
                         (bbox['x1'], bbox['y1'] - label_size[1] - 10),
                         (bbox['x1'] + label_size[0], bbox['y1']),
                         color, -1)
            
            cv2.putText(image, label,
                       (bbox['x1'], bbox['y1'] - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
        
        # Save annotated image
        if output_path:
            cv2.imwrite(str(output_path), image)
            print(f"💾 Annotated image saved: {output_path}")
        
        return image
    
    def generate_report(self, damages, image_path):
        """Generate a damage assessment report"""
        report = {
            'image': str(image_path),
            'total_damages': len(damages),
            'damage_summary': {},
            'detailed_damages': damages,
            'severity_assessment': self.assess_severity(damages)
        }
        
        # Count damage types
        for damage in damages:
            damage_type = damage['type']
            if damage_type not in report['damage_summary']:
                report['damage_summary'][damage_type] = 0
            report['damage_summary'][damage_type] += 1
        
        return report
    
    def assess_severity(self, damages):
        """Assess overall damage severity"""
        if not damages:
            return "No damage detected"
        
        total_damages = len(damages)
        avg_confidence = sum(d['confidence'] for d in damages) / total_damages
        
        # Severity based on number and type of damages
        severe_damages = ['broken_part', 'glass_damage', 'crack']
        severe_count = sum(1 for d in damages if d['type'] in severe_damages)
        
        if severe_count >= 3 or total_damages >= 5:
            return "Severe"
        elif severe_count >= 1 or total_damages >= 3:
            return "Moderate"
        elif total_damages >= 1:
            return "Minor"
        else:
            return "No damage"

def main():
    parser = argparse.ArgumentParser(description='Vehicle Damage Detection Inference')
    parser.add_argument('--image', required=True, help='Path to input image')
    parser.add_argument('--model', default='./models/damage_detection/weights/best.pt', 
                       help='Path to trained model')
    parser.add_argument('--confidence', type=float, default=0.5,
                       help='Confidence threshold (0-1)')
    parser.add_argument('--output', help='Output path for annotated image')
    parser.add_argument('--report', help='Output path for JSON report')
    
    args = parser.parse_args()
    
    print("🚗 Vehicle Damage Detection Inference")
    print("=" * 40)
    
    # Initialize detector
    detector = DamageDetector(args.model)
    
    # Run detection
    damages = detector.detect_damage(args.image, args.confidence)
    
    if damages is None:
        print("❌ Detection failed")
        return
    
    print(f"\\n🔍 Detection Results:")
    print(f"Total damages found: {len(damages)}")
    
    if damages:
        print("\\nDetected damages:")
        for i, damage in enumerate(damages, 1):
            print(f"  {i}. {damage['type']} (confidence: {damage['confidence']:.3f})")
        
        # Generate report
        report = detector.generate_report(damages, args.image)
        print(f"\\n📊 Damage Assessment: {report['severity_assessment']}")
        
        # Save report if requested
        if args.report:
            with open(args.report, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"📄 Report saved: {args.report}")
        
        # Visualize detections
        output_path = args.output or f"annotated_{Path(args.image).name}"
        detector.visualize_detections(args.image, damages, output_path)
        
    else:
        print("✅ No damage detected in the image")

if __name__ == "__main__":
    main()
