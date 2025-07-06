#!/usr/bin/env python3
"""
Download VehiDE Dataset from Kaggle for Vehicle Damage Detection
"""

import os
import kaggle
from pathlib import Path

def setup_kaggle_api():
    """
    Setup Kaggle API credentials
    Make sure you have kaggle.json in ~/.kaggle/ directory
    """
    kaggle_dir = Path.home() / '.kaggle'
    kaggle_file = kaggle_dir / 'kaggle.json'
    
    if not kaggle_file.exists():
        print("❌ Kaggle API credentials not found!")
        print("Please download kaggle.json from https://www.kaggle.com/settings")
        print(f"And place it in: {kaggle_file}")
        return False
    
    # Set proper permissions
    os.chmod(kaggle_file, 0o600)
    return True

def download_vehide_dataset():
    """
    Download VehiDE dataset for vehicle damage detection
    """
    if not setup_kaggle_api():
        return False
    
    # Create dataset directory
    dataset_dir = Path('./datasets/vehide')
    dataset_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print("🔄 Downloading VehiDE dataset...")
        
        # Replace with actual VehiDE dataset identifier
        # You'll need to find the correct dataset name on Kaggle
        kaggle.api.dataset_download_files(
            'dataset-name/vehide-vehicle-damage',  # Update this with actual dataset
            path=str(dataset_dir),
            unzip=True
        )
        
        print("✅ Dataset downloaded successfully!")
        print(f"📁 Location: {dataset_dir.absolute()}")
        
        # List contents
        print("\n📋 Dataset contents:")
        for item in dataset_dir.rglob('*'):
            if item.is_file():
                print(f"  📄 {item.relative_to(dataset_dir)}")
                
        return True
        
    except Exception as e:
        print(f"❌ Error downloading dataset: {e}")
        print("\n💡 Tips:")
        print("1. Make sure you have Kaggle API credentials set up")
        print("2. Check if the dataset name is correct")
        print("3. Ensure you have internet connection")
        return False

if __name__ == "__main__":
    print("🚗 VehiDE Vehicle Damage Detection Dataset Downloader")
    print("=" * 50)
    
    success = download_vehide_dataset()
    
    if success:
        print("\n🎉 Ready for next step: python convert_to_yolo.py")
    else:
        print("\n❌ Download failed. Please check the errors above.")
