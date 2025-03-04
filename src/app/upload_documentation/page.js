"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function UploadDocumentationPage() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('documents');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const router = useRouter();

  // Storage options state
  const [useAlternatives, setUseAlternatives] = useState(false);
  const [selectedStorageOptions, setSelectedStorageOptions] = useState(['server']);
  const [alternativeLinks, setAlternativeLinks] = useState({
    'google-drive': '',
    'onedrive': '',
    'mega': '',
    'mediafire': ''
  });

  const storageOptions = [
    { id: 'server', name: 'Server', icon: '/icons/server.svg' },
    { id: 'google-drive', name: 'Google Drive', icon: '/icons/drive.svg' },
    { id: 'onedrive', name: 'Microsoft OneDrive', icon: '/icons/onedrive.svg' },
    { id: 'mega', name: 'Mega', icon: '/icons/mega.svg' },
    { id: 'mediafire', name: 'MediaFire', icon: '/icons/mediafire.svg' }
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name);
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!name) {
        setName(droppedFile.name);
      }
    }
  };

  const toggleStorageOption = (optionId) => {
    setSelectedStorageOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      } else {
        return [...prev, optionId];
      }
    });
  };

  const handleAlternativeLinkChange = (option, value) => {
    setAlternativeLinks(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const validateForm = () => {
    // Basic validation
    if (!name.trim()) {
      setError('Please provide a name for the file');
      return false;
    }

    // If no storage option is selected
    if (selectedStorageOptions.length === 0) {
      setError('Please select at least one storage option');
      return false;
    }

    // Validate file for server upload
    if (selectedStorageOptions.includes('server') && !file) {
      setError('Please select a file to upload to the server');
      return false;
    }

    // Validate links for alternative storage options
    const selectedAlternatives = selectedStorageOptions.filter(opt => opt !== 'server');
    
    for (const option of selectedAlternatives) {
      if (!alternativeLinks[option] || !alternativeLinks[option].trim()) {
        setError(`Please provide a valid link for ${storageOptions.find(opt => opt.id === option).name}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsUploading(true);
      setError('');
      setSuccess('');
      setUploadProgress(0);
      
      const formData = new FormData();
      
      // Append file if server storage is selected
      if (selectedStorageOptions.includes('server') && file) {
        formData.append('file', file);
      }
      
      formData.append('name', name.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('isDocumentationResource', 'true');
      
      // Add storage options and links
      formData.append('storageOptions', JSON.stringify(selectedStorageOptions));
      formData.append('alternativeLinks', JSON.stringify(alternativeLinks));
      
      // Simulate upload progress
      const progressInterval = simulateProgress();
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      
      setSuccess('Resource uploaded successfully!');
      setFile(null);
      setName('');
      setDescription('');
      setSelectedStorageOptions(['server']);
      setUseAlternatives(false);
      setAlternativeLinks({
        'google-drive': '',
        'onedrive': '',
        'mega': '',
        'mediafire': ''
      });
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/documentation');
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload resource');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const simulateProgress = () => {
    // This simulates upload progress for UI feedback
    return setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 10);
      });
    }, 300);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header with navigation */}
        <div className="flex items-center mb-8">
          <Link 
            href="/documentation"
            className="flex items-center text-blue-600 hover:text-blue-800 mr-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Documentation
          </Link>
          <h1 className="text-2xl font-bold">Upload Documentation Resource</h1>
        </div>
        
        {/* Main form card */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Resource name */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Resource Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a name for this resource"
                  disabled={isUploading}
                  required
                />
              </div>
              
              {/* Category selection */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  disabled={isUploading}
                  required
                >
                  <option value="documents">Documents</option>
                  <option value="software">Software</option>
                  <option value="tools">Tools</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            {/* Description */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Provide a short description of this resource"
                disabled={isUploading}
              ></textarea>
            </div>
            
            {/* Storage Options */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">Storage Options *</label>
              <p className="text-sm text-gray-500 mb-1">Select where you want to store this resource. You can choose multiple options.</p>
              <p className="text-sm text-red-600 mb-3">Note: Use Server only when needed</p>
              
              <div className="space-y-3">
                {storageOptions.map((option) => (
                  <div key={option.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`option-${option.id}`}
                      checked={selectedStorageOptions.includes(option.id)}
                      onChange={() => toggleStorageOption(option.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={isUploading}
                    />
                    <label htmlFor={`option-${option.id}`} className="ml-2 flex items-center">
                      <div className="w-6 h-6 mr-2">
                        <Image 
                          src={option.icon} 
                          alt={option.name} 
                          width={24} 
                          height={24} 
                        />
                      </div>
                      <span>{option.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Server upload area - shown only if server option is selected */}
            {selectedStorageOptions.includes('server') && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Server Upload</label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  
                  {file ? (
                    <div className="py-6 flex flex-col items-center">
                      <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-lg font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                      <button
                        type="button"
                        className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        disabled={isUploading}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div className="py-8">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700">Drag and drop your file here</p>
                      <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
                      <p className="text-xs text-gray-500 mt-3">Maximum file size: 100MB</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Alternative Links - show input fields for selected alternative options */}
            {selectedStorageOptions.some(opt => opt !== 'server') && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Alternative Storage Links</label>
                <div className="space-y-4">
                  {storageOptions.filter(opt => opt.id !== 'server' && selectedStorageOptions.includes(opt.id)).map((option) => (
                    <div key={`link-${option.id}`} className="flex items-center">
                      <div className="w-6 h-6 mr-2 flex-shrink-0">
                        <Image 
                          src={option.icon} 
                          alt={option.name} 
                          width={24} 
                          height={24} 
                        />
                      </div>
                      <input
                        type="url"
                        value={alternativeLinks[option.id]}
                        onChange={(e) => handleAlternativeLinkChange(option.id, e.target.value)}
                        className="w-full ml-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Enter ${option.name} link`}
                        disabled={isUploading}
                        required={selectedStorageOptions.includes(option.id)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Provide direct links to your uploaded resource on the selected platforms</p>
              </div>
            )}
            
            {/* Upload progress */}
            {isUploading && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Form actions */}
            <div className="flex justify-end space-x-3">
              <Link
                href="/documentation"
                className={`px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                Cancel
              </Link>
              <button
                type="submit"
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isUploading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Resource'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
}