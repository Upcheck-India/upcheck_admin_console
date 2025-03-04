"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import SecureLoading from "../components/SecureLoading";

export default function DocumentationPage() {
  const { 
    isLoading: authLoading, 
    isAuthenticated, 
    hasPermission, 
    authError
  } = useAuth(true);

  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, resourceId: null });
  const [downloadModal, setDownloadModal] = useState({ show: false, resource: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const router = useRouter();

  // Storage option icons mapping
  const storageIcons = {
    'server': '/icons/server.svg',
    'google-drive': '/icons/drive.svg',
    'onedrive': '/icons/onedrive.svg',
    'mega': '/icons/mega.svg',
    'mediafire': '/icons/mediafire.svg'
  };

  // Storage option names mapping
  const storageNames = {
    'server': 'Server',
    'google-drive': 'Google Drive',
    'onedrive': 'Microsoft OneDrive',
    'mega': 'Mega',
    'mediafire': 'MediaFire'
  };

  // Move all useEffect hooks before any conditional returns
  useEffect(() => {
    if (isAuthenticated && !hasPermission) {
      setShowAccessDenied(true);
    }
  }, [isAuthenticated, hasPermission]);

  // Move this useEffect before the conditional return
  useEffect(() => {
    fetchResources();
  }, []);
  
  // Now we can have conditional returns
  if (authLoading) {
    return <SecureLoading />;
  }

  async function fetchResources() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/resources');
      if (!response.ok) throw new Error('Failed to fetch resources');
      const data = await response.json();
      setResources(data);
      
      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(data.map(item => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredResources = resources.filter(resource => {
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'documents': return '📄';
      case 'software': return '💻';
      case 'tools': return '🔧';
      case 'other': return '📁';
      default: return '📁';
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.resourceId) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/resources/${deleteModal.resourceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete resource');
      }
      
      // Remove the deleted resource from the state
      setResources(prevResources => 
        prevResources.filter(resource => resource._id !== deleteModal.resourceId)
      );
      
      setDeleteModal({ show: false, resourceId: null });
    } catch (error) {
      console.error('Error deleting resource:', error);
      alert('Failed to delete resource');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDownloadModal = (resource) => {
    setDownloadModal({ show: true, resource });
  };

  const closeDownloadModal = () => {
    setDownloadModal({ show: false, resource: null });
  };

  // Ensure all resources have storageOptions by adding a check function:
  const getResourceStorageOptions = (resource) => {
    // Default to server if no storage options are defined
    if (!resource.storageOptions || !Array.isArray(resource.storageOptions) || resource.storageOptions.length === 0) {
      return ['server'];
    }
    return resource.storageOptions;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Organization Documentation</h1>
          <p className="mt-2 text-blue-100">Access all documents, files, software and tools in one place</p>
          
          {/* Upload Button */}
          <Link href="/upload_documentation" className="mt-4 inline-flex items-center px-4 py-2 bg-white text-blue-700 rounded-lg shadow hover:bg-blue-50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Upload Document
          </Link>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search resources..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute right-3 top-3 text-gray-400">🔍</span>
          </div>
          
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-3 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === category 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {category === 'all' ? 'All Resources' : category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Resources Count */}
        {!isLoading && (
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {filteredResources.length} {filteredResources.length === 1 ? 'resource' : 'resources'}
              {selectedCategory !== 'all' ? ` in "${selectedCategory}"` : ''}
              {searchTerm ? ` matching "${searchTerm}"` : ''}
            </p>
          </div>
        )}
        
        {/* Resources Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-xl text-gray-600">No resources found</p>
            <p className="mt-2 text-gray-500">Try changing your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map(resource => (
              <div key={resource._id || resource.fileId} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">{getCategoryIcon(resource.category)}</span>
                    <span className="text-xs uppercase font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {resource.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 line-clamp-1">{resource.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{resource.fileSize}</span>
                    <span>Updated: {new Date(resource.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="border-t border-gray-100 p-4 bg-gray-50 flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {resource.downloads || 0} downloads
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setDeleteModal({ show: true, resourceId: resource._id })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete resource"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    
                    {/* Download Button */}
                    {getResourceStorageOptions(resource).length === 1 ? (
                      /* Single download option */
                      <a
                        href={getResourceStorageOptions(resource)[0] === 'server' 
                          ? `/api/media/${resource.fileId}` 
                          : (resource.alternativeLinks?.[getResourceStorageOptions(resource)[0]] || '#')}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center transition-colors"
                        title={`Download from ${storageNames[getResourceStorageOptions(resource)[0]] || 'Server'}`}
                      >
                        <div className="w-5 h-5 mr-2 bg-blue-200 p-0.5 rounded">
                          <Image 
                            src={storageIcons[getResourceStorageOptions(resource)[0]] || '/icons/server.svg'} 
                            alt={storageNames[getResourceStorageOptions(resource)[0]] || 'Server'} 
                            width={20} 
                            height={20} 
                          />
                        </div>
                        <span>Download</span>
                      </a>
                    ) : (
                      /* Multiple download options - Now uses modal instead of dropdown */
                      <button
                        onClick={() => openDownloadModal(resource)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6 text-gray-600">Are you sure you want to delete this resource? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ show: false, resourceId: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Download Options Modal */}
      {downloadModal.show && downloadModal.resource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Download Options</h3>
              <button 
                onClick={closeDownloadModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-gray-600">Choose where to download "{downloadModal.resource.name}" from:</p>
            
            <div className="space-y-3">
              {getResourceStorageOptions(downloadModal.resource).map((option) => (
                <a
                  key={option}
                  href={option === 'server' 
                    ? `/api/media/${downloadModal.resource.fileId}` 
                    : (downloadModal.resource.alternativeLinks?.[option] || '#')}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full"
                  onClick={closeDownloadModal}
                >
                  <div className="w-10 h-10 mr-3 bg-blue-100 p-2 rounded flex items-center justify-center">
                    <Image 
                      src={storageIcons[option] || '/icons/server.svg'} 
                      alt={storageNames[option] || 'Server'} 
                      width={24} 
                      height={24} 
                    />
                  </div>
                  <div>
                    <div className="font-medium">{storageNames[option] || 'Server'}</div>
                    <div className="text-sm text-gray-500">
                      {option === 'server' ? 'Direct download from Upcheck server' : `Download via ${storageNames[option]}`}
                    </div>
                  </div>
                </a>
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={closeDownloadModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}