# Vehicle Damage Detection with YOLOv8

This directory contains scripts and configurations for training a custom YOLOv8 model on the VehiDE dataset for **vehicle damage detection and classification**.

The model can detect and classify different types of vehicle damage such as:
- Scratches
- Dents
- Broken parts
- Paint damage
- Glass damage
- And more damage types from the VehiDE annotations

## Setup Steps

1. **Download VehiDE Dataset** - `download_dataset.py`
2. **Convert to YOLO Format** - `convert_to_yolo.py` 
3. **Create Configuration** - `data.yaml`
4. **Train Damage Detection Model** - `train_model.py`
5. **Run Damage Inference** - `inference.py`

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Setup Kaggle API (download kaggle.json from kaggle.com/settings)
mkdir -p ~/.kaggle
cp kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json

# 3. Download and prepare damage detection dataset
python download_dataset.py
python convert_to_yolo.py

# 4. Train damage detection model
python train_model.py

# 5. Run damage detection inference
python inference.py --image path/to/damaged_car.jpg --output annotated_car.jpg
```

## Dataset Information

The VehiDE dataset contains annotated vehicle damage images with the following damage types:
- **Scratches**: Surface scratches on paint
- **Dents**: Physical deformations in body panels  
- **Cracks**: Structural cracks in various parts
- **Glass Damage**: Windshield, window damage
- **Paint Damage**: Chips, fading, discoloration
- **Bumper Damage**: Front/rear bumper damage
- **Headlight Damage**: Broken or damaged lights
- **Tire Damage**: Tire wear, punctures, damage
- **Rust**: Corrosion and rust spots
- **Broken Parts**: Missing or severely damaged components

## Model Training

The training script supports different YOLOv8 model sizes:
- `n` (nano): Fastest, smallest model
- `s` (small): Good balance of speed and accuracy
- `m` (medium): Higher accuracy, slower inference
- `l` (large): High accuracy applications
- `x` (extra large): Maximum accuracy

Training parameters can be customized in `train_model.py`:
```python
trainer.train_model(
    model_size='n',     # Model size
    epochs=100,         # Training epochs
    batch_size=16,      # Batch size
    img_size=640        # Input image size
)
```

## Integration with React Native App

The trained damage detection model can be integrated with your car photo app in several ways:

### 1. **Server-Side API Integration**
```javascript
// In your React Native app
const analyzeDamage = async (imageUri) => {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'car_damage.jpg',
  });
  
  const response = await fetch('http://your-server.com/detect-damage', {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
};
```

### 2. **Mobile Deployment (TensorFlow Lite)**
- Convert trained model to TensorFlow Lite format
- Integrate with React Native using `react-native-tflite`
- Run inference directly on device

### 3. **Hybrid Approach**
- Use YOLO model for damage detection
- Combine with Gemini API for damage assessment and repair estimates
- Provide comprehensive damage reports

### 4. **Use Cases**
- **Insurance Claims**: Automated damage assessment
- **Car Dealerships**: Pre-sale vehicle inspection
- **Rental Cars**: Damage documentation
- **Maintenance**: Regular vehicle condition monitoring

## Model Export Options

```bash
# Export to different formats
python -c "
from ultralytics import YOLO
model = YOLO('./models/damage_detection/weights/best.pt')
model.export(format='onnx')     # ONNX format
model.export(format='tflite')   # TensorFlow Lite
model.export(format='coreml')   # iOS Core ML
"
```

## Performance Optimization

- **GPU Training**: Use CUDA-enabled GPU for faster training
- **Model Quantization**: Reduce model size for mobile deployment
- **Image Preprocessing**: Optimize input resolution and quality
- **Batch Processing**: Process multiple images efficiently
