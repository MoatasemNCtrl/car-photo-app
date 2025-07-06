#!/usr/bin/env python3
"""
FastAPI server for vehicle damage detection
Provides REST API endpoint for the React Native app
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import numpy as np
import io
from PIL import Image
import json
import tempfile
from pathlib import Path

# Import our damage detector
from inference import DamageDetector

app = FastAPI(
    title="Vehicle Damage Detection API",
    description="API for detecting vehicle damage using YOLOv8",
    version="1.0.0"
)

# Enable CORS for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize damage detector
detector = DamageDetector()

@app.on_event("startup")
async def startup_event():
    """Load the model on startup"""
    success = detector.load_model()
    if not success:
        print("❌ Failed to load damage detection model")
    else:
        print("✅ Damage detection model loaded successfully")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Vehicle Damage Detection API",
        "status": "running",
        "model_loaded": detector.model is not None
    }

@app.post("/detect-damage")
async def detect_damage(
    file: UploadFile = File(...),
    confidence: float = 0.5
):
    """
    Detect damage in uploaded car image
    
    Args:
        file: Uploaded image file
        confidence: Detection confidence threshold (0-1)
    
    Returns:
        JSON response with detected damages
    """
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        contents = await file.read()
        
        # Convert to OpenCV format
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_array.shape) == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Save temporary file for processing
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            cv2.imwrite(tmp_file.name, image_array)
            temp_path = tmp_file.name
        
        try:
            # Run damage detection
            damages = detector.detect_damage(temp_path, confidence)
            
            if damages is None:
                raise HTTPException(status_code=500, detail="Damage detection failed")
            
            # Generate comprehensive report
            report = detector.generate_report(damages, file.filename)
            
            # Add API metadata
            api_response = {
                "success": True,
                "filename": file.filename,
                "confidence_threshold": confidence,
                "processing_time": "< 1s",  # You can add actual timing
                "api_version": "1.0.0",
                **report
            }
            
            return api_response
            
        finally:
            # Clean up temporary file
            Path(temp_path).unlink(missing_ok=True)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@app.post("/detect-damage-with-image")
async def detect_damage_with_annotated_image(
    file: UploadFile = File(...),
    confidence: float = 0.5
):
    """
    Detect damage and return annotated image along with detection results
    """
    try:
        # Similar to above but also return annotated image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        if len(image_array.shape) == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            cv2.imwrite(tmp_file.name, image_array)
            temp_path = tmp_file.name
        
        try:
            damages = detector.detect_damage(temp_path, confidence)
            
            if damages is None:
                raise HTTPException(status_code=500, detail="Damage detection failed")
            
            # Generate annotated image
            annotated_image = detector.visualize_detections(temp_path, damages)
            
            # Convert annotated image to base64
            import base64
            _, buffer = cv2.imencode('.jpg', annotated_image)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            report = detector.generate_report(damages, file.filename)
            
            api_response = {
                "success": True,
                "filename": file.filename,
                "confidence_threshold": confidence,
                "annotated_image": f"data:image/jpeg;base64,{img_base64}",
                **report
            }
            
            return api_response
            
        finally:
            Path(temp_path).unlink(missing_ok=True)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@app.get("/damage-types")
async def get_damage_types():
    """Get list of supported damage types"""
    return {
        "damage_types": detector.damage_classes,
        "total_classes": len(detector.damage_classes)
    }

@app.get("/model-info")
async def get_model_info():
    """Get information about the loaded model"""
    if not detector.model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return {
        "model_path": str(detector.model_path),
        "model_loaded": True,
        "supported_formats": ["jpg", "jpeg", "png", "bmp"],
        "max_file_size": "10MB",
        "recommended_image_size": "640x640"
    }

if __name__ == "__main__":
    print("🚗 Starting Vehicle Damage Detection API Server")
    print("📡 API Documentation: http://localhost:8000/docs")
    print("🔍 Health Check: http://localhost:8000/")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        reload=True  # Set to False in production
    )
