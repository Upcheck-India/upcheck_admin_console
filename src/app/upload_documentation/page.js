'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import UnauthorizedAccess from '../../components/UnauthorizedAccess';

export default function UploadDocumentation() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Group all state declarations together
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('documents');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('general'); // Default to general project
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [useAlternatives, setUseAlternatives] = useState(false);
  const [selectedStorageOptions, setSelectedStorageOptions] = useState(['server']);
  const [alternativeLinks, setAlternativeLinks] = useState({
    'google-drive': '',
    'onedrive': '',
    'mega': '',
    'mediafire': ''
  });
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Group all effects together
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser && ['Console admin', 'Admin'].includes(currentUser.role)) {
      fetchProjects();
    }
  }, [currentUser]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      setCurrentUser(data.user);
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser || !['Console admin', 'Admin'].includes(currentUser.role)) {
    return <UnauthorizedAccess />;
  }

  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      let data = await response.json();
      
      // Filter out any 'general' project from the API to avoid duplicates
      data = data.filter(project => project._id !== 'general');
      
      // Add our standard general project at the beginning
      setProjects([{ _id: 'general', name: 'General' }, ...data]);
    } catch (error) {
      console.error('Error fetching projects:', error);
      // Ensure we have at least the general project
      setProjects([{ _id: 'general', name: 'General' }]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

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
      formData.append('projectId', selectedProject); // Add selected project
      
      // Add password protection if enabled
      formData.append('isPasswordProtected', isPasswordProtected);
      if (isPasswordProtected) {
        formData.append('password', password);
      }
      
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
      setIsPasswordProtected(false);
      setPassword('');
      setConfirmPassword('');
      
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

            {/* Project selection */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">Project *</label>
              <p className="text-sm text-gray-500 mb-3">Select which project this document belongs to</p>
              
              {isLoadingProjects ? (
                <div className="flex items-center space-x-2 h-10">
                  <div className="w-5 h-5 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                  <span className="text-gray-600">Loading projects...</span>
                </div>
              ) : (
                <>
                  {/* Project search for many projects */}
                  {projects.length > 9 && (
                    <div className="mb-4 relative">
                      <input
                        type="text"
                        placeholder="Search projects..."
                        className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase();
                          const filteredProjects = document.querySelectorAll('.project-card');
                          filteredProjects.forEach(card => {
                            const projectName = card.getAttribute('data-name').toLowerCase();
                            if (projectName.includes(searchTerm)) {
                              card.style.display = '';
                            } else {
                              card.style.display = 'none';
                            }
                          });
                        }}
                      />
                      <div className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  {/* Project grid with responsive layout */}
                  <div className={`grid grid-cols-1 ${projects.length <= 6 ? 'md:grid-cols-2 lg:grid-cols-3' : 
                                    projects.length <= 12 ? 'md:grid-cols-3 lg:grid-cols-4' : 
                                    'md:grid-cols-4 lg:grid-cols-5'} gap-3 max-h-96 overflow-y-auto p-1`}>
                    {projects.map(project => (
                      <div 
                        key={project._id}
                        data-name={project.name}
                        className={`project-card p-3 border rounded-lg cursor-pointer transition-all ${selectedProject === project._id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
                        onClick={() => setSelectedProject(project._id)}
                      >
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${selectedProject === project._id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" 
                              className={`h-6 w-6 ${selectedProject === project._id ? 'text-blue-600' : 'text-gray-500'}`} 
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="font-medium truncate">{project.name}</div>
                            <div className="text-xs text-gray-500">
                              {project._id === 'general' ? 'Default project space' : 'Project space'}
                            </div>
                          </div>
                          {selectedProject === project._id && (
                            <div className="ml-2 flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Project count indicator */}
                  {projects.length > 6 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Showing all {projects.length} available project spaces
                    </div>
                  )}
                </>
              )}
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

            {/* Password Protection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 text-sm font-medium">Password Protection</label>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input 
                    type="checkbox" 
                    id="toggle-password" 
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" 
                    checked={isPasswordProtected}
                    onChange={() => {
                      setIsPasswordProtected(!isPasswordProtected);
                      if (isPasswordProtected) {
                        setPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    disabled={isUploading}
                  />
                  <label 
                    htmlFor="toggle-password" 
                    className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${isPasswordProtected ? 'bg-blue-500' : 'bg-gray-300'}`}
                  ></label>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Enable password protection to restrict access to this document</p>
              
              {isPasswordProtected && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter password"
                        required={isPasswordProtected}
                        disabled={isUploading}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isUploading}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {password && (
                      <p className="text-xs text-gray-500 mt-1">
                        {password.length < 6 ? 'Weak password' : password.length < 10 ? 'Medium strength' : 'Strong password'}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-medium mb-2">Confirm Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 border ${password && confirmPassword && password !== confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-lg focus:outline-none focus:ring-2`}
                      placeholder="Confirm password"
                      required={isPasswordProtected}
                      disabled={isUploading}
                    />
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
              )}
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