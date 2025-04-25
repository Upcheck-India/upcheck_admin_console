'use client';
import React, { useState, useEffect } from 'react';
import { Upload, X, Link as LinkIcon } from 'lucide-react';

export default function ThumbnailUpload({ value, onChange, required = true }) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(value);
  const [error, setError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // Notify parent form about validation state whenever preview changes
  useEffect(() => {
    if (required) {
      const input = document.createElement('input');
      input.setAttribute('type', 'hidden');
      input.setAttribute('name', 'thumbnail-validation');
      input.setAttribute('value', preview ? 'valid' : 'invalid');
      document.querySelector('form')?.appendChild(input);
      
      return () => {
        document.querySelector('input[name="thumbnail-validation"]')?.remove();
      };
    }
  }, [preview, required]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size should be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setError('');
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setPreview(data.fileUrl);
      onChange(data.fileUrl);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = (e) => {
    e?.preventDefault?.();
    if (!imageUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setError('');
    setPreview(imageUrl);
    onChange(imageUrl);
    setImageUrl('');
    setShowUrlInput(false);
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    setError('');
  };

  const ImageUrlInput = () => (
    <div className="flex gap-2">
      <input
        type="url"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
        placeholder="Enter image URL"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={handleUrlSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        disabled={!imageUrl.trim()}
      >
        Add
      </button>
    </div>
  );

  const UploadArea = () => (
    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <Upload className="w-8 h-8 mb-2 text-gray-500" />
        <p className="text-sm text-gray-500">Click to upload thumbnail</p>
        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
      </div>
      <input
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </label>
  );

  const Preview = () => (
    <div className="relative">
      <img 
        src={preview} 
        alt="Thumbnail preview" 
        className="w-full h-48 object-cover rounded-lg"
      />
      <button
        type="button"
        onClick={handleRemove}
        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
      >
        <X size={16} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      
      {required && !preview && (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          Please either upload an image or provide an image URL
        </div>
      )}
      
      {preview ? (
        <Preview />
      ) : (
        <div className="space-y-4">
          <UploadArea />

          <div className="flex items-center justify-center">
            <span className="px-3 text-gray-500">or</span>
          </div>

          {showUrlInput ? (
            <ImageUrlInput />
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <LinkIcon size={16} />
              Use Image URL
            </button>
          )}
        </div>
      )}
      
      {isUploading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        </div>
      )}
    </div>
  );
}