#!/usr/bin/env python3
"""
Train YOLOv8 model for vehicle damage detection
"""

from ultralytics import YOLO
import torch
from pathlib import Path
import yaml

class DamageDetectionTrainer:
    def __init__(self, data_yaml='./datasets/yolo_damage/data.yaml'):
        self.data_yaml = Path(data_yaml)
        self.model_dir = Path('./models')
        self.model_dir.mkdir(exist_ok=True)
        
    def check_gpu(self):
        """Check if GPU is available"""
        if torch.cuda.is_available():
            print(f"🚀 GPU detected: {torch.cuda.get_device_name()}")
            return True
        else:
            print("💻 Using CPU training (will be slower)")
            return False
    
    def load_config(self):
        """Load dataset configuration"""
        if not self.data_yaml.exists():
            print(f"❌ Configuration file not found: {self.data_yaml}")
            print("Please run convert_to_yolo.py first")
            return None
        
        with open(self.data_yaml, 'r') as f:
            config = yaml.safe_load(f)
        
        print(f"📋 Dataset config loaded:")
        print(f"  Classes: {config['nc']}")
        print(f"  Damage types: {config['names']}")
        
        return config
    
    def train_model(self, 
                   model_size='n',  # n, s, m, l, x
                   epochs=100,
                   batch_size=16,
                   img_size=640):
        """Train YOLOv8 model for damage detection"""
        
        print("🚗 Training YOLOv8 for Vehicle Damage Detection")
        print("=" * 50)
        
        # Check prerequisites
        config = self.load_config()
        if not config:
            return False
        
        self.check_gpu()
        
        # Load pre-trained model
        model_name = f'yolov8{model_size}.pt'
        print(f"📥 Loading pre-trained model: {model_name}")
        model = YOLO(model_name)
        
        # Training parameters
        train_params = {
            'data': str(self.data_yaml),
            'epochs': epochs,
            'batch': batch_size,
            'imgsz': img_size,
            'project': str(self.model_dir),
            'name': 'damage_detection',
            'save_period': 10,  # Save checkpoint every 10 epochs
            'patience': 50,     # Early stopping patience
            'cache': True,      # Cache images for faster training
            'device': 0 if torch.cuda.is_available() else 'cpu',
            
            # Data augmentation
            'hsv_h': 0.015,
            'hsv_s': 0.7,
            'hsv_v': 0.4,
            'degrees': 0.0,
            'translate': 0.1,
            'scale': 0.5,
            'shear': 0.0,
            'perspective': 0.0,
            'flipud': 0.0,
            'fliplr': 0.5,
            'mosaic': 1.0,
            'mixup': 0.0,
        }
        
        print(f"🔧 Training parameters:")
        for key, value in train_params.items():
            print(f"  {key}: {value}")
        
        print("\\n🚀 Starting training...")
        
        try:
            # Train the model
            results = model.train(**train_params)
            
            print("\\n✅ Training completed!")
            
            # Model paths
            best_model = self.model_dir / 'damage_detection' / 'weights' / 'best.pt'
            last_model = self.model_dir / 'damage_detection' / 'weights' / 'last.pt'
            
            print(f"📁 Best model: {best_model}")
            print(f"📁 Last model: {last_model}")
            
            # Validate the model
            print("\\n🔍 Running validation...")
            val_results = model.val()
            
            print(f"📊 Validation Results:")
            print(f"  mAP50: {val_results.box.map50:.3f}")
            print(f"  mAP50-95: {val_results.box.map:.3f}")
            
            return True
            
        except Exception as e:
            print(f"❌ Training failed: {e}")
            return False
    
    def export_model(self, model_path=None, formats=['onnx', 'tflite']):
        """Export trained model to different formats"""
        if not model_path:
            model_path = self.model_dir / 'damage_detection' / 'weights' / 'best.pt'
        
        if not Path(model_path).exists():
            print(f"❌ Model not found: {model_path}")
            return False
        
        print(f"📦 Exporting model: {model_path}")
        model = YOLO(model_path)
        
        for format_type in formats:
            try:
                print(f"  🔄 Exporting to {format_type}...")
                model.export(format=format_type)
                print(f"  ✅ {format_type} export completed")
            except Exception as e:
                print(f"  ❌ {format_type} export failed: {e}")
        
        return True

def main():
    trainer = DamageDetectionTrainer()
    
    print("🚗 Vehicle Damage Detection Training Pipeline")
    print("=" * 50)
    
    # Train model
    success = trainer.train_model(
        model_size='n',     # Start with nano for faster training
        epochs=100,         # Adjust based on your needs
        batch_size=16,      # Adjust based on your GPU memory
        img_size=640        # Standard size for YOLO
    )
    
    if success:
        print("\\n📦 Exporting model for deployment...")
        trainer.export_model(formats=['onnx', 'tflite'])
        
        print("\\n🎉 Training pipeline completed!")
        print("🔍 Next step: python inference.py --image path/to/damaged_car.jpg")
    else:
        print("\\n❌ Training failed. Please check the errors above.")

if __name__ == "__main__":
    main()
