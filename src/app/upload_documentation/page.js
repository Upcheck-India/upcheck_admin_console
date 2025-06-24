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
  const [selectedProject, setSelectedProject] = useState('general');
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
  
  // New state for server settings
  const [serverSettings, setServerSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Group all effects together
  useEffect(() => {
    checkAuth();
    fetchServerSettings();
  }, []);

  useEffect(() => {
    // Fetch projects for any user with upload permission
    if (currentUser && hasUploadPermission()) {
      fetchProjects();
    }
  }, [currentUser, serverSettings]); // Add serverSettings to dependencies to refetch if settings change

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

  const fetchServerSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await fetch('/api/server-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setServerSettings(data.data);
        } else {
          console.error('Failed to fetch server settings:', data.error);
          setServerSettings({
            allowInternUpload: false,
            allowInternDownload: true,
            allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
            maxFileSize: 5,
            fileNameRegex: '.*',
            uploadDeadline: null,
            allowedProjectsForDownload: ['general'],
            allowedDocuments: {}
          });
        }
      } else {
        console.error('Failed to fetch server settings:', response.statusText);
        // Set default settings if fetch fails
        setServerSettings({
          allowInternUpload: false,
          allowInternDownload: true,
          allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
          maxFileSize: 5,
          fileNameRegex: '.*',
          uploadDeadline: null,
          allowedProjectsForDownload: ['general'],
          allowedDocuments: {}
        });
      }
    } catch (error) {
      console.error('Error fetching server settings:', error);
      // Set default restrictive settings
      setServerSettings({
        allowInternUpload: false,
        allowInternDownload: true,
        allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
        maxFileSize: 5,
        fileNameRegex: '.*',
        uploadDeadline: null,
        allowedProjectsForDownload: ['general'],
        allowedDocuments: {}
      });
    } finally {
      setSettingsLoading(false);
    }
  };

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

  // Check if user has upload permissions
  const hasUploadPermission = () => {
    if (!currentUser || !serverSettings) return false;
    
    // Log for debugging
    console.log('User role:', currentUser.role);
    console.log('Server settings:', serverSettings);
    
    // Admins and Console admins always have permission
    if (['Console admin', 'Admin'].includes(currentUser.role)) {
      console.log('User is admin, allowing upload');
      return true;
    }
    
    // For interns, check the allowInternUpload setting
    if (currentUser.role === 'Intern') {
      const canUpload = serverSettings.allowInternUpload === true;
      console.log('Intern upload allowed:', canUpload);
      return canUpload;
    }
    
    console.log('No matching role or permission');
    return false;
  };

  // Check if upload deadline has passed
  const isUploadDeadlinePassed = () => {
    if (!serverSettings?.uploadDeadline) return false;
    return new Date() > new Date(serverSettings.uploadDeadline);
  };

  // Get allowed file extensions
  const getAllowedFileExtensions = () => {
    return serverSettings?.allowedFileTypes || [];
  };

  // Get max file size in MB
  const getMaxFileSize = () => {
    return serverSettings?.maxFileSize || 5;
  };

  // Validate file type
  const isValidFileType = (fileName) => {
    const allowedTypes = getAllowedFileExtensions();
    if (allowedTypes.length === 0) return true;
    
    const fileExtension = '.' + fileName.split('.').pop().toLowerCase();
    return allowedTypes.some(type => type.toLowerCase() === fileExtension);
  };

  // Validate file size
  const isValidFileSize = (fileSize) => {
    const maxSizeMB = getMaxFileSize();
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  };

  // Validate file name against regex
  const isValidFileName = (fileName) => {
    if (!serverSettings?.fileNameRegex) return true;
    try {
      const regex = new RegExp(serverSettings.fileNameRegex);
      return regex.test(fileName);
    } catch (error) {
      console.error('Invalid regex pattern:', error);
      return true;
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <UnauthorizedAccess />;
  }

  // Check if user has upload permission
  if (!hasUploadPermission()) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Restricted</h2>
            <p className="text-gray-600 mb-6">
              {currentUser.role === 'Intern' 
                ? 'Document upload is currently not allowed for interns. Please contact an administrator if you need to upload documents.'
                : 'You do not have permission to upload documents.'
              }
            </p>
            <Link
              href="/documentation"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Documentation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if upload deadline has passed
  if (isUploadDeadlinePassed()) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Deadline Passed</h2>
            <p className="text-gray-600 mb-2">
              The upload deadline has passed. Document uploads are no longer accepted.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Deadline was: {new Date(serverSettings.uploadDeadline).toLocaleString()}
            </p>
            <Link
              href="/documentation"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Documentation
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
      // Validate file type
      if (!isValidFileType(selectedFile.name)) {
        setError(`File type not allowed. Allowed types: ${getAllowedFileExtensions().join(', ')}`);
        return;
      }

      // Validate file size
      if (!isValidFileSize(selectedFile.size)) {
        setError(`File size exceeds maximum limit of ${getMaxFileSize()}MB`);
        return;
      }

      // Validate file name
      if (!isValidFileName(selectedFile.name)) {
        setError('File name does not match the required pattern');
        return;
      }

      setError(''); // Clear any previous errors
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
      
      // Validate file type
      if (!isValidFileType(droppedFile.name)) {
        setError(`File type not allowed. Allowed types: ${getAllowedFileExtensions().join(', ')}`);
        return;
      }

      // Validate file size
      if (!isValidFileSize(droppedFile.size)) {
        setError(`File size exceeds maximum limit of ${getMaxFileSize()}MB`);
        return;
      }

      // Validate file name
      if (!isValidFileName(droppedFile.name)) {
        setError('File name does not match the required pattern');
        return;
      }

      setError(''); // Clear any previous errors
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

    // Validate password confirmation
    if (isPasswordProtected && password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
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
      formData.append('projectId', selectedProject);
      
      // Add uploaded by information
      if (currentUser) {
        formData.append('uploadedBy', JSON.stringify({
          userId: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role
        }));
      }
      
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

        {/* Settings info banner for interns */}
        {currentUser.role === 'Intern' && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Upload Guidelines:</strong><br/>
                  • Allowed file types: {getAllowedFileExtensions().join(', ')}<br/>
                  • Maximum file size: {getMaxFileSize()}MB<br/>
                  {serverSettings.uploadDeadline && (
                    <>• Upload deadline: {new Date(serverSettings.uploadDeadline).toLocaleString()}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Main form card */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          {/* Special notice for interns */}
          {currentUser?.role === 'Intern' && serverSettings?.allowInternUpload && (
            <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Note for Interns:</strong> This upload access has been temporarily enabled by an administrator.
                    {serverSettings.uploadDeadline && (
                      <span> Uploads will be accepted until {new Date(serverSettings.uploadDeadline).toLocaleString()}.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
                            <h3 className={`font-medium truncate ${selectedProject === project._id ? 'text-blue-900' : 'text-gray-900'}`}>
                              {project.name}
                            </h3>
                            {project._id === 'general' && (
                              <p className="text-xs text-gray-500 mt-1">Default project</p>
                            )}
                          </div>
                          {selectedProject === project._id && (
                            <div className="flex-shrink-0 ml-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                rows="3"
                placeholder="Provide a brief description of this resource"
                disabled={isUploading}
              />
            </div>

            {/* Storage Options */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">Storage Options *</label>
              <p className="text-sm text-gray-500 mb-4">Choose where to store this resource. You can select multiple options.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storageOptions.map(option => (
                  <div 
                    key={option.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedStorageOptions.includes(option.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                    onClick={() => toggleStorageOption(option.id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selectedStorageOptions.includes(option.id) ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          {option.icon ? (
                            <Image
                              src={option.icon}
                              alt={option.name}
                              width={20}
                              height={20}
                              className="w-5 h-5"
                            />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" 
                              className={`h-5 w-5 ${selectedStorageOptions.includes(option.id) ? 'text-blue-600' : 'text-gray-500'}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <h3 className={`font-medium ${selectedStorageOptions.includes(option.id) ? 'text-blue-900' : 'text-gray-900'}`}>
                          {option.name}
                        </h3>
                        {option.id === 'server' && (
                          <p className="text-xs text-gray-500 mt-1">Upload to server</p>
                        )}
                      </div>
                      {selectedStorageOptions.includes(option.id) && (
                        <div className="flex-shrink-0 ml-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* File Upload Section - Only show if server storage is selected */}
            {selectedStorageOptions.includes('server') && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">File Upload *</label>
                <p className="text-sm text-gray-500 mb-4">
                  Upload your file to the server. Max size: {getMaxFileSize()}MB. 
                  Allowed types: {getAllowedFileExtensions().join(', ')}
                </p>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : file 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept={getAllowedFileExtensions().join(',')}
                    disabled={isUploading}
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-green-700 font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          if (name === file.name) setName('');
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                        disabled={isUploading}
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-gray-700">
                        <button
                          type="button"
                          onClick={triggerFileInput}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          disabled={isUploading}
                        >
                          Click to upload
                        </button>
                        {' '}or drag and drop
                      </p>
                      <p className="text-sm text-gray-500">
                        {getAllowedFileExtensions().join(', ')} up to {getMaxFileSize()}MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alternative Storage Links */}
            {selectedStorageOptions.some(option => option !== 'server') && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Alternative Storage Links</label>
                <p className="text-sm text-gray-500 mb-4">
                  Provide links to the files stored in the selected cloud storage services.
                </p>
                
                <div className="space-y-4">
                  {selectedStorageOptions
                    .filter(option => option !== 'server')
                    .map(option => {
                      const storageOption = storageOptions.find(opt => opt.id === option);
                      return (
                        <div key={option} className="border rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <div className="w-6 h-6 mr-2 flex items-center justify-center">
                              {storageOption.icon ? (
                                <Image
                                  src={storageOption.icon}
                                  alt={storageOption.name}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4"
                                />
                              ) : (
                                <div className="w-4 h-4 bg-gray-300 rounded"></div>
                              )}
                            </div>
                            <label className="text-sm font-medium text-gray-700">
                              {storageOption.name} Link *
                            </label>
                          </div>
                          <input
                            type="url"
                            value={alternativeLinks[option]}
                            onChange={(e) => handleAlternativeLinkChange(option, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Enter ${storageOption.name} share link`}
                            disabled={isUploading}
                            required
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Password Protection */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="password-protection"
                  checked={isPasswordProtected}
                  onChange={(e) => {
                    setIsPasswordProtected(e.target.checked);
                    if (!e.target.checked) {
                      setPassword('');
                      setConfirmPassword('');
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isUploading}
                />
                <label htmlFor="password-protection" className="ml-2 text-sm font-medium text-gray-700">
                  Password protect this resource
                </label>
              </div>
              
              {isPasswordProtected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter password"
                        disabled={isUploading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        disabled={isUploading}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Confirm Password *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm password"
                      disabled={isUploading}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Upload Progress</span>
                  <span className="text-sm font-medium text-gray-700">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              <Link
                href="/documentation"
                className="inline-flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </Link>
              
              <button
                type="submit"
                disabled={isUploading || !selectedStorageOptions.length}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Resource
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}