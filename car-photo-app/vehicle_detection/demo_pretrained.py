#!/usr/bin/env python3
"""
Quick demo using pre-trained YOLO for general object detection
This is a temporary solution until the custom damage model is trained
"""

from ultralytics import YOLO
import cv2

def demo_with_pretrained():
    """Demo using YOLOv8 pre-trained model for general object detection"""
    
    # Load pre-trained model (will download automatically)
    model = YOLO('yolov8n.pt')  # Nano model for speed
    
    print("🚗 Demo: Using pre-trained YOLO for general car detection")
    print("Note: This won't detect specific damage types yet")
    
    # This can detect cars, but not specific damage types
    results = model('path/to/car/image.jpg')
    
    # The pre-trained model can detect:
    # - car, truck, bus, motorcycle (vehicle classes)
    # - But NOT specific damage types like scratches, dents, etc.
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            class_id = int(box.cls[0])
            if class_id == 2:  # 'car' class in COCO dataset
                print("✅ Car detected")
            
    return results

if __name__ == "__main__":
    demo_with_pretrained()
