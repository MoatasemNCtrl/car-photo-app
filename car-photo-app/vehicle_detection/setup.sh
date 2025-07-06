#!/bin/bash
# Vehicle Damage Detection Setup Script

echo "🚗 Vehicle Damage Detection Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo "🐍 Checking Python version..."
python_version=$(python3 --version 2>&1)
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ $python_version${NC}"
else
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Create virtual environment
echo "🏗️  Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${YELLOW}⚠️  Virtual environment already exists${NC}"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📥 Installing requirements..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo -e "${GREEN}✅ Requirements installed${NC}"
else
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p datasets/vehide
mkdir -p datasets/yolo_damage
mkdir -p models
echo -e "${GREEN}✅ Directories created${NC}"

# Check for Kaggle API
echo "🔑 Checking Kaggle API setup..."
if [ -f "$HOME/.kaggle/kaggle.json" ]; then
    echo -e "${GREEN}✅ Kaggle API credentials found${NC}"
    chmod 600 ~/.kaggle/kaggle.json
else
    echo -e "${YELLOW}⚠️  Kaggle API credentials not found${NC}"
    echo "Please download kaggle.json from https://www.kaggle.com/settings"
    echo "and place it in ~/.kaggle/kaggle.json"
fi

# Check GPU availability
echo "🚀 Checking GPU availability..."
python3 -c "import torch; print('✅ GPU available:', torch.cuda.is_available())" 2>/dev/null
if [[ $? -ne 0 ]]; then
    echo -e "${YELLOW}⚠️  PyTorch not installed yet${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Setup Kaggle API if not done: cp kaggle.json ~/.kaggle/"
echo "3. Download dataset: python download_dataset.py"
echo "4. Convert to YOLO: python convert_to_yolo.py"
echo "5. Train model: python train_model.py"
echo "6. Run inference: python inference.py --image your_car_image.jpg"
echo ""
echo "For API server: python api_server.py"
echo "API docs will be available at: http://localhost:8000/docs"
