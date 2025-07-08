import React, { useState, useRef } from 'react';
import './ImageUploader.css';

const ImageUploader = ({ onImageUpload, maxFiles = 10, acceptedTypes = "image/*" }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Handle file input change
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  // Process uploaded files
  const handleFiles = async (files) => {
    const fileArray = Array.from(files);
    
    // Filter for image files and check limits
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (uploadedImages.length + imageFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} images.`);
      return;
    }

    setUploading(true);

    try {
      const newImages = [];
      
      for (let file of imageFiles) {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        
        const imageData = {
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          size: file.size,
          previewUrl: previewUrl,
          uploadDate: new Date().toISOString()
        };
        
        newImages.push(imageData);
      }
      
      const updatedImages = [...uploadedImages, ...newImages];
      setUploadedImages(updatedImages);
      
      // Call parent callback if provided
      if (onImageUpload) {
        onImageUpload(updatedImages);
      }
      
    } catch (error) {
      console.error('Error processing images:', error);
      alert('Error uploading images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Remove image
  const removeImage = (imageId) => {
    const updatedImages = uploadedImages.filter(img => img.id !== imageId);
    setUploadedImages(updatedImages);
    
    // Clean up object URL to prevent memory leaks
    const imageToRemove = uploadedImages.find(img => img.id === imageId);
    if (imageToRemove && imageToRemove.previewUrl) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    
    if (onImageUpload) {
      onImageUpload(updatedImages);
    }
  };

  // Open file dialog
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="image-uploader">
      {/* Upload Area */}
      <div 
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input 
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        <div className="upload-content">
          {uploading ? (
            <div className="uploading">
              <div className="spinner"></div>
              <p>Uploading images...</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">📸</div>
              <h3>Upload Car Photos</h3>
              <p>Drag and drop images here, or click to select files</p>
              <p className="upload-info">
                Supports: JPG, PNG, GIF, WebP (Max {maxFiles} files)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress/Stats */}
      {uploadedImages.length > 0 && (
        <div className="upload-stats">
          <p>{uploadedImages.length} of {maxFiles} images uploaded</p>
        </div>
      )}

      {/* Image Preview Grid */}
      {uploadedImages.length > 0 && (
        <div className="image-grid">
          <h4>Uploaded Images</h4>
          <div className="image-list">
            {uploadedImages.map((image) => (
              <div key={image.id} className="image-item">
                <div className="image-preview">
                  <img 
                    src={image.previewUrl} 
                    alt={image.name}
                    onLoad={() => {
                      // Revoke object URL after image loads to free memory
                      // Note: In a real app, you might want to keep these longer
                    }}
                  />
                  <button 
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(image.id);
                    }}
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
                <div className="image-info">
                  <p className="image-name" title={image.name}>
                    {image.name.length > 20 ? image.name.substring(0, 20) + '...' : image.name}
                  </p>
                  <p className="image-size">{formatFileSize(image.size)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
