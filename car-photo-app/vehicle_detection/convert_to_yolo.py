#!/usr/bin/env python3
"""
Convert VehiDE Dataset to YOLO format for damage detection training
"""

import os
import json
import shutil
from pathlib import Path
import cv2
import pandas as pd

class VehiDEToYOLO:
    def __init__(self, dataset_path='./datasets/vehide', output_path='./datasets/yolo_damage'):
        self.dataset_path = Path(dataset_path)
        self.output_path = Path(output_path)
        
        # Damage class mapping (update based on actual VehiDE labels)
        self.damage_classes = {
            'scratch': 0,
            'dent': 1,
            'crack': 2,
            'glass_damage': 3,
            'paint_damage': 4,
            'bumper_damage': 5,
            'headlight_damage': 6,
            'tire_damage': 7,
            'rust': 8,
            'broken_part': 9
        }
        
    def setup_yolo_structure(self):
        """Create YOLO dataset structure"""
        print("📁 Setting up YOLO directory structure...")
        
        for split in ['train', 'val', 'test']:
            for folder in ['images', 'labels']:
                (self.output_path / split / folder).mkdir(parents=True, exist_ok=True)
        
        print("✅ Directory structure created")
    
    def convert_bbox_to_yolo(self, bbox, img_width, img_height):
        """
        Convert bounding box to YOLO format
        bbox: [x_min, y_min, x_max, y_max] in pixels
        Returns: [x_center, y_center, width, height] normalized
        """
        x_min, y_min, x_max, y_max = bbox
        
        # Calculate center and dimensions
        x_center = (x_min + x_max) / 2.0
        y_center = (y_min + y_max) / 2.0
        width = x_max - x_min
        height = y_max - y_min
        
        # Normalize by image dimensions
        x_center /= img_width
        y_center /= img_height
        width /= img_width
        height /= img_height
        
        return [x_center, y_center, width, height]
    
    def process_annotations(self, annotation_file, image_dir, split='train'):
        """Process annotation file and convert to YOLO format"""
        print(f"🔄 Processing {split} annotations...")
        
        # This will depend on the actual VehiDE annotation format
        # Update this based on the dataset structure
        
        if annotation_file.suffix == '.json':
            with open(annotation_file, 'r') as f:
                annotations = json.load(f)
        elif annotation_file.suffix == '.csv':
            annotations = pd.read_csv(annotation_file)
        else:
            print(f"❌ Unsupported annotation format: {annotation_file.suffix}")
            return
        
        processed_count = 0
        
        # Process each annotation (adapt based on actual format)
        for annotation in annotations:
            try:
                # Extract image info (update field names as needed)
                image_filename = annotation.get('filename') or annotation.get('image_name')
                image_path = image_dir / image_filename
                
                if not image_path.exists():
                    continue
                
                # Read image to get dimensions
                image = cv2.imread(str(image_path))
                if image is None:
                    continue
                
                img_height, img_width = image.shape[:2]
                
                # Copy image to YOLO structure
                output_image_path = self.output_path / split / 'images' / image_filename
                shutil.copy2(image_path, output_image_path)
                
                # Process damage annotations
                label_filename = image_path.stem + '.txt'
                label_path = self.output_path / split / 'labels' / label_filename
                
                with open(label_path, 'w') as label_file:
                    # Extract damage annotations (update based on actual format)
                    damages = annotation.get('damages', []) or annotation.get('annotations', [])
                    
                    for damage in damages:
                        damage_type = damage.get('type') or damage.get('class')
                        bbox = damage.get('bbox') or damage.get('bounding_box')
                        
                        if damage_type in self.damage_classes and bbox:
                            class_id = self.damage_classes[damage_type]
                            yolo_bbox = self.convert_bbox_to_yolo(bbox, img_width, img_height)
                            
                            # Write YOLO format: class_id x_center y_center width height
                            label_file.write(f"{class_id} {' '.join(map(str, yolo_bbox))}\\n")
                
                processed_count += 1
                
                if processed_count % 100 == 0:
                    print(f"  📸 Processed {processed_count} images...")
                    
            except Exception as e:
                print(f"❌ Error processing {annotation}: {e}")
                continue
        
        print(f"✅ Processed {processed_count} images for {split}")
    
    def create_data_yaml(self):
        """Create data.yaml configuration file"""
        print("📄 Creating data.yaml configuration...")
        
        yaml_content = f"""# Vehicle Damage Detection Dataset
path: {self.output_path.absolute()}
train: train/images
val: val/images
test: test/images

# Classes
nc: {len(self.damage_classes)}  # number of classes
names: {list(self.damage_classes.keys())}  # class names
"""
        
        with open(self.output_path / 'data.yaml', 'w') as f:
            f.write(yaml_content)
        
        print("✅ data.yaml created")
    
    def convert_dataset(self):
        """Main conversion function"""
        print("🚗 Converting VehiDE Dataset to YOLO format for damage detection")
        print("=" * 60)
        
        if not self.dataset_path.exists():
            print(f"❌ Dataset not found at {self.dataset_path}")
            print("Please run download_dataset.py first")
            return False
        
        self.setup_yolo_structure()
        
        # Find annotation files (update paths based on actual dataset structure)
        train_annotations = self.dataset_path / 'annotations' / 'train.json'
        val_annotations = self.dataset_path / 'annotations' / 'val.json'
        test_annotations = self.dataset_path / 'annotations' / 'test.json'
        
        train_images = self.dataset_path / 'images' / 'train'
        val_images = self.dataset_path / 'images' / 'val'
        test_images = self.dataset_path / 'images' / 'test'
        
        # Process each split
        if train_annotations.exists():
            self.process_annotations(train_annotations, train_images, 'train')
        
        if val_annotations.exists():
            self.process_annotations(val_annotations, val_images, 'val')
        
        if test_annotations.exists():
            self.process_annotations(test_annotations, test_images, 'test')
        
        self.create_data_yaml()
        
        print("\\n🎉 Conversion completed!")
        print(f"📁 YOLO dataset location: {self.output_path.absolute()}")
        print("\\n🚀 Ready for training: python train_model.py")
        
        return True

if __name__ == "__main__":
    converter = VehiDEToYOLO()
    converter.convert_dataset()
