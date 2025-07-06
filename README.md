# 🚗 Car Photo Analysis App

A comprehensive React Native application for car photo capture, analysis, and damage detection using AI.

## ✨ Features

### 📱 **Mobile App (React Native + Expo)**
- **Photo Capture**: Take photos with device camera
- **Photo Upload**: Select images from gallery  
- **Multi-image Support**: Upload and analyze multiple car photos
- **AI-Powered Analysis**: Get detailed car information using Gemini 2.5 API
- **Cross-Platform**: Works on iOS, Android, and Web

### 🤖 **AI Analysis Capabilities**
- **Car Identification**: Brand, model, year detection
- **Visual Features**: Body type, color analysis
- **Damage Detection**: Custom YOLOv8 model for vehicle damage assessment
- **Confidence Scoring**: Reliability indicators for all detections

### 🔧 **Damage Detection System**
- **Custom YOLO Model**: Trained on VehiDE dataset
- **10+ Damage Types**: Scratches, dents, cracks, glass damage, etc.
- **Severity Assessment**: Automatic damage severity classification
- **Visual Annotation**: Highlighted damage areas on images
- **API Integration**: RESTful API for mobile app integration

## 🚀 Quick Start

### Mobile App
```bash
cd car-photo-app
npm install
npx expo start
```

### Damage Detection (Optional)
```bash
cd car-photo-app/vehicle_detection
./setup.sh
python download_dataset.py
python convert_to_yolo.py
python train_model.py
```

## 📁 Project Structure

```
car-photo-app/
├── App.js                 # Main React Native app
├── .env                   # API keys (Gemini)
├── package.json           # Dependencies
├── vehicle_detection/     # Custom damage detection
│   ├── README.md         # Damage detection docs
│   ├── setup.sh          # Setup script
│   ├── requirements.txt  # Python dependencies
│   ├── download_dataset.py
│   ├── convert_to_yolo.py
│   ├── train_model.py
│   ├── inference.py
│   ├── api_server.py     # FastAPI server
│   └── react_native_integration.js
└── assets/               # App icons and images
```

## 🔧 Setup & Configuration

### 1. **Gemini API Key**
1. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to `.env` file:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 2. **Run Mobile App**
```bash
cd car-photo-app
npm install
npx expo start
```

### 3. **Damage Detection (Optional)**
```bash
cd vehicle_detection
chmod +x setup.sh
./setup.sh
```

## 🎯 Use Cases

- **Insurance Claims**: Automated damage assessment
- **Car Dealerships**: Vehicle condition documentation  
- **Rental Services**: Pre/post-rental inspections
- **Personal Use**: Car maintenance tracking
- **Fleet Management**: Vehicle condition monitoring

## 🛠️ Technologies

### Frontend
- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and tools
- **Expo Image Picker** - Camera and gallery access

### AI & Machine Learning  
- **Google Gemini 2.5** - General car analysis
- **YOLOv8** - Custom damage detection
- **Ultralytics** - YOLO training and inference
- **OpenCV** - Image processing

### Backend (Optional)
- **FastAPI** - REST API server
- **Python** - Data processing and ML
- **PyTorch** - Deep learning framework

## 📊 Model Performance

### Gemini 2.5 Analysis
- ✅ **Generous Free Tier**: 15 requests/min, 1,500/day
- ✅ **High Accuracy**: Excellent car identification
- ✅ **Multi-modal**: Handles text + image analysis

### Custom YOLO Damage Detection
- 🎯 **Specialized**: Trained specifically for vehicle damage
- 📱 **Mobile Ready**: Exportable to TensorFlow Lite
- 🔧 **Customizable**: Retrain on your own damage data

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 Check the [vehicle_detection/README.md](car-photo-app/vehicle_detection/README.md) for detailed damage detection setup
- 🐛 Open an issue for bug reports
- 💡 Submit feature requests via GitHub issues

---

**Built with ❤️ for better vehicle analysis and damage detection**
