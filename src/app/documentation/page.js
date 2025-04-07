"use client";

import { useState, useEffect, useRef } from 'react';
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
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, resourceId: null });
  const [downloadModal, setDownloadModal] = useState({ show: false, resource: null });
  const [projectModal, setProjectModal] = useState({ show: false, moveResourceId: null });  
  const [manageProjectModal, setManageProjectModal] = useState({ show: false, project: null, action: null });  
  const [projectResourcesCount, setProjectResourcesCount] = useState(0);
  const [projectResources, setProjectResources] = useState([]);
  const [targetProject, setTargetProject] = useState(null);
  const [createBackupSpace, setCreateBackupSpace] = useState(false);
  const [backupSpaceName, setBackupSpaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState({ show: false, action: null });
  const [moveToProjectModal, setMoveToProjectModal] = useState({ show: false });
  const [passwordModal, setPasswordModal] = useState({ show: false, resource: null, type: 'view' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [renameModal, setRenameModal] = useState({ show: false, resource: null, newName: '' });
  const [tempDisableModal, setTempDisableModal] = useState({ show: false, resource: null });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const router = useRouter();
  const passwordInputRef = useRef(null);
  const dropdownRef = useRef(null);

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
    fetchProjects();
  }, []);

  // Focus on password input when the modal opens
  useEffect(() => {
    if (passwordModal.show && passwordInputRef.current) {
      setTimeout(() => {
        passwordInputRef.current.focus();
      }, 100);
    }
  }, [passwordModal.show]);

  // Effect to close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdownId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      // Ensure we have at least the general project
      setProjects([{ _id: 'general', name: 'General' }]);
    }
  }

  async function createProject(projectName) {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: projectName }),
      });
      
      if (!response.ok) throw new Error('Failed to create project');
      const newProject = await response.json();
      
      setProjects(prev => [...prev, newProject]);
      
      // If creating a project with a resource to move
      if (projectModal.moveResourceId) {
        // Move resource to the new project
        await fetch(`/api/resources/${projectModal.moveResourceId}/move`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ projectId: newProject._id })
        });
        
        // Update resource in state
        setResources(prevResources => 
          prevResources.map(resource => {
            if (resource._id === projectModal.moveResourceId) {
              return { ...resource, projectId: newProject._id };
            }
            return resource;
          })
        );
      }
      
      setProjectModal({ show: false, moveResourceId: null });
      setNewProjectName('');
      setSelectedProject(newProject._id);
      
      // Show success message
      alert(`Project "${newProject.name}" created successfully${projectModal.moveResourceId ? ' and document moved' : ''}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    }
  }
  
  // Get resources in a project
  async function getProjectResources(projectId) {
    try {
      // First get all resources
      const response = await fetch('/api/resources');
      if (!response.ok) throw new Error('Failed to fetch resources');
      const allResources = await response.json();
      
      // Then filter for this project - more reliable than using the API filter
      console.log(`Total resources: ${allResources.length}`);
      
      // Simple filter to catch all resources belonging to this project
      const projectResources = allResources.filter(resource => {
        const belongsToProject = resource.projectId === projectId;
        if (belongsToProject) {
          console.log(`Found resource: ${resource.name} in project ${projectId}`);
        }
        return belongsToProject;
      });
      
      console.log(`Resources for project ${projectId}: ${projectResources.length}`);
      return projectResources;
    } catch (error) {
      console.error('Error fetching project resources:', error);
      return [];
    }
  }
  
  // Open project management modal
  async function openManageProjectModal(project, action) {
    if (project._id === 'general') {
      alert('The General project is a default project and cannot be modified.');
      return;
    }
    
    // Set initial modal state
    setManageProjectModal({
      show: true,
      project,
      action
    });
    
    // If action is delete, check for resources in the project
    if (action === 'delete') {
      setProjectResourcesCount(0); // Reset count while loading
      setProjectResources([]); // Reset resources list
      
      const resources = await getProjectResources(project._id);
      console.log(`Found ${resources.length} resources in project ${project._id}`);
      
      setProjectResources(resources);
      setProjectResourcesCount(resources.length);
      
      // Generate a unique backup name if needed
      const timestamp = new Date().getTime().toString(36);
      setBackupSpaceName(`backup-${timestamp}`);
    }
  }
  
  // Rename project
  async function renameProject(projectId, newName) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      });
      
      if (!response.ok) throw new Error('Failed to rename project');
      
      // Update projects in state
      setProjects(prevProjects => 
        prevProjects.map(p => {
          if (p._id === projectId) {
            return { ...p, name: newName };
          }
          return p;
        })
      );
      
      setManageProjectModal({ show: false, project: null, action: null });
      alert(`Project renamed successfully to "${newName}"`);
    } catch (error) {
      console.error('Error renaming project:', error);
      alert('Failed to rename project');
    }
  }
  
  // Move resources to another project
  async function moveResourcesToProject(sourceProjectId, targetProjectId, resourceIds) {
    try {
      const response = await fetch(`/api/projects/${sourceProjectId}/move-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetProjectId, resourceIds })
      });
      
      if (!response.ok) throw new Error('Failed to move resources');
      
      // Update resources in state
      setResources(prevResources => 
        prevResources.map(resource => {
          if (resourceIds.includes(resource._id)) {
            return { ...resource, projectId: targetProjectId };
          }
          return resource;
        })
      );
      
      return true;
    } catch (error) {
      console.error('Error moving resources:', error);
      alert('Failed to move resources to another project');
      return false;
    }
  }
  
  // Create backup project and move resources
  async function createBackupProjectAndMove(sourceProjectId, backupName, resourceIds) {
    try {
      // First create the backup project
      const createResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: backupName }),
      });
      
      if (!createResponse.ok) throw new Error('Failed to create backup project');
      const newProject = await createResponse.json();
      
      // Add the new project to state
      setProjects(prev => [...prev, newProject]);
      
      // Now move the resources to the new project
      const moveSuccess = await moveResourcesToProject(sourceProjectId, newProject._id, resourceIds);
      if (!moveSuccess) throw new Error('Failed to move resources to backup project');
      
      return true;
    } catch (error) {
      console.error('Error creating backup project:', error);
      alert('Failed to create backup project');
      return false;
    }
  }
  
  // Delete project
  async function deleteProject(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete project');
      
      // Update projects in state
      setProjects(prev => prev.filter(p => p._id !== projectId));
      
      // If we're currently viewing this project, switch to general
      if (selectedProject === projectId) {
        setSelectedProject('general');
      }
      
      setManageProjectModal({ show: false, project: null, action: null });
      alert('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  }
  
  // Rename resource function
  async function renameResource(resourceId, newName) {
    try {
      const response = await fetch(`/api/resources/${resourceId}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      });
      
      if (!response.ok) throw new Error('Failed to rename resource');
      
      // Update the resource in state
      setResources(prevResources => 
        prevResources.map(resource => {
          if (resource._id === resourceId) {
            return { ...resource, name: newName };
          }
          return resource;
        })
      );
      
      setRenameModal({ show: false, resource: null, newName: '' });
    } catch (error) {
      console.error('Error renaming resource:', error);
      alert('Failed to rename resource');
    }
  }
  
  // Duplicate resource function
  async function duplicateResource(resourceId) {
    try {
      const response = await fetch(`/api/resources/${resourceId}/duplicate`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to duplicate resource');
      const newResource = await response.json();
      
      // Add the new resource to state
      setResources(prevResources => [...prevResources, newResource]);
      
      // Show success message
      alert('Resource duplicated successfully');
    } catch (error) {
      console.error('Error duplicating resource:', error);
      alert('Failed to duplicate resource');
    }
  }
  
  // Toggle temporary disable access
  async function toggleTempDisable(resourceId, disableStatus) {
    try {
      const response = await fetch(`/api/resources/${resourceId}/toggle-access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ disabled: disableStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update access status');
      
      // Update the resource in state
      setResources(prevResources => 
        prevResources.map(resource => {
          if (resource._id === resourceId) {
            return { ...resource, isDisabled: disableStatus };
          }
          return resource;
        })
      );
      
      setTempDisableModal({ show: false, resource: null });
    } catch (error) {
      console.error('Error updating access status:', error);
      alert('Failed to update access status');
    }
  }

  // Toggle document password protection
  async function toggleLockDocument(resourceId, isLocked, password, oldPassword = null) {
    try {
      const requestBody = { isLocked, password };
      if (oldPassword) {
        requestBody.oldPassword = oldPassword;
      }
      
      const response = await fetch(`/api/resources/${resourceId}/protect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update password protection');
      }
      
      // Update the resource in state
      setResources(prevResources => 
        prevResources.map(resource => {
          if (resource._id === resourceId) {
            return { ...resource, isPasswordProtected: isLocked };
          }
          return resource;
        })
      );
      
      setPasswordModal({ show: false, resource: null, type: 'view' });
      return true;
    } catch (error) {
      console.error('Error updating password protection:', error);
      alert(error.message || 'Failed to update password protection');
      return false;
    }
  }

  const filteredResources = resources.filter(resource => {
    // Handle general category (no project assigned)
    const matchesProject = selectedProject === 'general' ? 
      (!resource.projectId || resource.projectId === 'general') : 
      resource.projectId === selectedProject;
    
    // Filter by category if a category filter is selected
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    
    const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (resource.description && resource.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesProject && matchesSearch && matchesCategory;
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
  
  // Format storage options display with +X more indicator when multiple options exist
  const formatStorageDisplay = (resource) => {
    const options = getResourceStorageOptions(resource);
    if (options.length === 1) {
      return options[0];
    } else {
      return `${options[0]} +${options.length - 1} more`;
    }
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Clear selection when turning off selection mode
      setSelectedItems([]);
    }
    setSelectionMode(!selectionMode);
  };

  // Handle item selection
  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    } else {
      setSelectedItems(prev => [...prev, itemId]);
    }
  };

  // Select/Deselect all visible items
  const toggleSelectAll = () => {
    if (selectedItems.length === filteredResources.length) {
      setSelectedItems([]);
    } else {
      const allVisibleIds = filteredResources.map(resource => resource._id);
      setSelectedItems(allVisibleIds);
    }
  };

  // Open create project modal
  const openCreateProjectModal = () => {
    setProjectModal({ show: true });
    setNewProjectName('');
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      setIsDeleting(true);
      
      const promises = selectedItems.map(id => 
        fetch(`/api/resources/${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(promises);
      
      // Remove the deleted resources from the state
      setResources(prevResources => 
        prevResources.filter(resource => !selectedItems.includes(resource._id))
      );
      
      setSelectedItems([]);
      setBulkActionModal({ show: false, action: null });
      
    } catch (error) {
      console.error('Error deleting resources:', error);
      alert('Failed to delete one or more resources');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open move to project modal
  const openMoveToProjectModal = () => {
    if (selectedItems.length === 0) return;
    setMoveToProjectModal({ show: true });
  };

  // Handle move to project
  const handleMoveToProject = async (targetProjectId) => {
    if (selectedItems.length === 0) return;
    
    try {
      // Set a loading state on the button
      const btn = document.querySelector(`[data-project-id="${targetProjectId}"]`);
      if (btn) {
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<div class="flex items-center justify-center"><div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-2"></div>Moving...</div>`;
        btn.disabled = true;
        
        // Disable all other buttons
        document.querySelectorAll('[data-project-id]').forEach(b => {
          if (b !== btn) b.disabled = true;
        });
      }
      
      const promises = selectedItems.map(id => 
        fetch(`/api/resources/${id}/move`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ projectId: targetProjectId })
        })
      );
      
      await Promise.all(promises);
      
      // Update the resources in state
      setResources(prevResources => 
        prevResources.map(resource => {
          if (selectedItems.includes(resource._id)) {
            return { ...resource, projectId: targetProjectId };
          }
          return resource;
        })
      );
      
      // Apply a brief delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSelectedItems([]);
      setMoveToProjectModal({ show: false });
      setSelectionMode(false);
      
      // Show success message with proper project name
      const projectName = projects.find(p => p._id === targetProjectId)?.name || 'the selected project';
      alert(`${selectedItems.length} document${selectedItems.length === 1 ? '' : 's'} moved successfully to ${projectName}`);
      
    } catch (error) {
      console.error('Error moving resources:', error);
      alert('Failed to move one or more resources');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Organization Documentation</h1>
              <p className="mt-2 text-blue-100 text-sm md:text-base">Access all documents, files, software and tools in one place</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Create Project Button */}
              <button 
                onClick={openCreateProjectModal}
                className="inline-flex items-center px-3 py-2 bg-blue-800 text-white text-sm rounded-lg shadow hover:bg-blue-900 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="whitespace-nowrap">Create Project</span>
              </button>
              
              {/* Upload Button */}
              <Link href="/upload_documentation" className="inline-flex items-center px-3 py-2 bg-white text-blue-700 text-sm rounded-lg shadow hover:bg-blue-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="whitespace-nowrap">Upload Document</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search, Filters and Project Selection */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search documents..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            
            {/* Filter Toggle Button */}
            <button
              onClick={() => setFilterDrawer(!filterDrawer)}
              className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors ${filterDrawer ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white border border-gray-300 hover:bg-gray-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="whitespace-nowrap">Filters {categoryFilter !== 'all' && '(1)'}</span>
            </button>
            
            {/* Project Management Button (not shown for General project) */}
            {selectedProject !== 'general' && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    const project = projects.find(p => p._id === selectedProject);
                    if (project) {
                      e.currentTarget.blur(); // Remove focus
                      setActiveDropdownId(activeDropdownId === 'project-manage' ? null : 'project-manage');
                    }
                  }}
                  className="px-4 py-3 rounded-lg flex items-center gap-2 transition-colors bg-white border border-gray-300 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="whitespace-nowrap">Manage Project Space</span>
                </button>
                
                {/* Project Management Dropdown */}
                {activeDropdownId === 'project-manage' && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200" ref={dropdownRef}>
                    <div className="py-1">
                      {(() => {
                        const project = projects.find(p => p._id === selectedProject);
                        return project ? (
                          <>
                            <button
                              onClick={() => {
                                setActiveDropdownId(null);
                                setNewProjectName(project.name);
                                openManageProjectModal(project, 'rename');
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Rename Project
                            </button>
                            <button
                              onClick={() => {
                                setActiveDropdownId(null);
                                openManageProjectModal(project, 'delete');
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Project
                            </button>
                          </>
                        ) : null;
                      })()} 
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Filter Options Panel */}
          {filterDrawer && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="font-medium text-gray-700 mb-3">Filter by Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setCategoryFilter('documents')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${categoryFilter === 'documents' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Documents
                </button>
                <button
                  onClick={() => setCategoryFilter('software')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${categoryFilter === 'software' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Software
                </button>
                <button
                  onClick={() => setCategoryFilter('tools')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${categoryFilter === 'tools' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Tools
                </button>
                <button
                  onClick={() => setCategoryFilter('other')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${categoryFilter === 'other' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Other
                </button>
              </div>
            </div>
          )}
          
          {/* Project Selection */}
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              onClick={() => setSelectedProject('general')}
              className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg whitespace-nowrap transition-colors flex-shrink-0 text-sm sm:text-base ${selectedProject === 'general' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'}`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                General
              </div>
            </button>
            
            {projects.filter(p => p._id !== 'general').map(project => (
              <button
                key={project._id}
                onClick={() => setSelectedProject(project._id)}
                className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg whitespace-nowrap transition-colors flex-shrink-0 text-sm sm:text-base ${
                  selectedProject === project._id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                  {project.name}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Selection Mode Toggle and Bulk Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSelectionMode}
              className={`flex items-center ${selectionMode ? 'text-blue-600' : 'text-gray-600'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {selectionMode ? 'Cancel Selection' : 'Select Items'}
            </button>
            
            {selectionMode && (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="text-gray-600 hover:text-blue-600"
                >
                  {selectedItems.length === filteredResources.length ? 'Deselect All' : 'Select All'}
                </button>
                
                {selectedItems.length > 0 && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setBulkActionModal({ show: true, action: 'delete' })}
                      className="flex items-center text-red-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete
                    </button>
                    
                    <button
                      onClick={openMoveToProjectModal}
                      className="flex items-center text-blue-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      Move to Project
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Resources Count */}
          {!isLoading && (
            <div>
              <p className="text-gray-600">
                Showing {filteredResources.length} {filteredResources.length === 1 ? 'document' : 'documents'}
                {selectedProject !== 'general' && projects.find(p => p._id === selectedProject) 
                  ? ` in "${projects.find(p => p._id === selectedProject).name}"` 
                  : ' in "General"'}
                {searchTerm ? ` matching "${searchTerm}"` : ''}
              </p>
            </div>
          )}
        </div>
        
        {/* Resources Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-xl text-gray-600">No documents found</p>
            <p className="mt-2 text-gray-500">Try changing your search or project selection</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredResources.map(resource => (
              <div 
                key={resource._id || resource.fileId} 
                className={`bg-white rounded-lg shadow-md overflow-hidden transition-all relative ${selectionMode ? 'border-2 border-transparent' : 'hover:shadow-lg'} ${
                  selectionMode && selectedItems.includes(resource._id) ? 'border-blue-500 shadow-lg' : ''
                } ${
                  resource.isDisabled ? 'opacity-60' : ''
                }`}
                onClick={() => selectionMode ? toggleItemSelection(resource._id) : null}
              >
                {/* Status Badge - top left */}
                <div className="absolute top-3 left-3 z-10 flex gap-2">
                  {/* Selection Checkbox - shown only in selection mode */}
                  {selectionMode && (
                    <div className={`w-6 h-6 rounded-full border ${selectedItems.includes(resource._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'} flex items-center justify-center`}>
                      {selectedItems.includes(resource._id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Status Badges - top right */}
                <div className="absolute top-3 right-3 z-10 flex flex-col space-y-2">
                  {/* Locked indicator */}
                  {resource.isPasswordProtected && (
                    <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-xs font-medium flex items-center shadow-sm border border-amber-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Locked
                    </div>
                  )}
                  
                  {/* Temporarily Disabled indicator */}
                  {resource.isDisabled && (
                    <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium flex items-center shadow-sm border border-red-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Disabled
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 text-blue-600 mr-3">
                        <span className="text-xl">{getCategoryIcon(resource.category)}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold line-clamp-1">{resource.name}</h3>
                        <div className="flex items-center mt-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                            {resource.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            {resource.fileSize}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                      </svg>
                      <span 
                        className={`${getResourceStorageOptions(resource).length > 1 ? 'group relative' : ''}`}
                        title={getResourceStorageOptions(resource).length > 1 ? 
                          getResourceStorageOptions(resource).join(', ') : undefined}
                      >
                        {formatStorageDisplay(resource)}
                        {getResourceStorageOptions(resource).length > 1 && (
                          <span className="hidden group-hover:block absolute left-0 bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                            {getResourceStorageOptions(resource).join(', ')}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(resource.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {!selectionMode && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        {resource.downloads || 0} downloads
                      </span>
                      <div className="dropdown relative" ref={activeDropdownId === resource._id ? dropdownRef : null}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === resource._id ? null : resource._id);
                          }}
                          className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        
                        {/* More Actions Dropdown Menu */}
                        {activeDropdownId === resource._id && (
                          <div className="absolute right-0 bottom-full mb-1 w-56 bg-white rounded-md shadow-lg z-50 overflow-hidden border border-gray-200 text-left">
                            <div className="py-1">
                              {/* Duplicate */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateResource(resource._id);
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                </svg>
                                Duplicate
                              </button>
                              
                              {/* Rename */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameModal({ show: true, resource, newName: resource.name });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Rename
                              </button>
                              
                              {/* Create new project and move to it */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectModal({ show: true, moveResourceId: resource._id });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                </svg>
                                New Project & Move
                              </button>
                              
                              {/* Move to project */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItems([resource._id]);
                                  setMoveToProjectModal({ show: true });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Move to Project
                              </button>

                              {/* Password Protection */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPasswordModal({ 
                                    show: true, 
                                    resource, 
                                    type: resource.isPasswordProtected ? 'unlock' : 'lock'
                                  });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                {resource.isPasswordProtected ? 'Manage Password' : 'Password Protect'}
                              </button>
                              
                              {/* Disable/Enable Access */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTempDisableModal({ show: true, resource });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                {resource.isDisabled ? 'Enable Access' : 'Temporarily Disable'}
                              </button>
                              
                              <div className="border-t border-gray-200 my-1"></div>
                              
                              {/* Delete */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteModal({ show: true, resourceId: resource._id });
                                  setActiveDropdownId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {/* Actions */}
                      <div className="flex space-x-1 flex-grow">
                        <button
                          onClick={() => setDeleteModal({ show: true, resourceId: resource._id })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete document"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        
                        {/* Rename button */}
                        <button
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Rename document"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {/* Duplicate button */}
                        <button
                          className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                          title="Duplicate document"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>
                        
                        {/* Move to project button */}
                        <button
                          onClick={() => {
                            setSelectedItems([resource._id]);
                            setMoveToProjectModal({ show: true });
                          }}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
                          title="Move to another project"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                        </button>
                        
                        {/* Lock/Unlock button */}
                        <button
                          onClick={() => setPasswordModal({ 
                            show: true, 
                            resource, 
                            type: resource.isPasswordProtected ? 'unlock' : 'lock'
                          })}
                          className={`p-2 ${resource.isPasswordProtected ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-600 hover:bg-gray-50'} rounded-full transition-colors`}
                          title={resource.isPasswordProtected ? "Manage password protection" : "Add password protection"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Download Button - Always shows Download for all resources */}
                      {resource.isPasswordProtected ? (
                        /* Password protected download */
                        <button
                          onClick={() => setPasswordModal({ show: true, resource, type: 'download' })}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center transition-colors shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download</span>
                        </button>
                      ) : getResourceStorageOptions(resource).length === 1 ? (
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
                        /* Multiple download options - Uses modal */
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
                )}
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

      {/* Project Management Modal */}
      {manageProjectModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d={manageProjectModal.action === 'delete' ? "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" : "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"} 
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">
                  {manageProjectModal.action === 'delete' ? 'Delete Project' : 'Rename Project'}
                </h3>
              </div>
              <button 
                onClick={() => setManageProjectModal({ show: false, project: null, action: null })}
                className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {manageProjectModal.action === 'rename' ? (
              /* Rename Project UI */
              <div>
                <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-blue-800">You are renaming project: <strong>{manageProjectModal.project?.name}</strong></p>
                </div>
                
                <div className="mb-5">
                  <label className="block text-gray-700 text-sm font-medium mb-2">New Project Name</label>
                  <input 
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    placeholder="Enter new project name"
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setManageProjectModal({ show: false, project: null, action: null })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newProjectName.trim()) {
                        alert('Please enter a new project name');
                        return;
                      }
                      renameProject(manageProjectModal.project._id, newProjectName.trim());
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Rename Project
                  </button>
                </div>
              </div>
            ) : manageProjectModal.action === 'delete' && projectResources.length > 0 ? (
              /* Delete Project with Resources Warning UI */
              <div>
                <div className="mb-6 bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="flex items-center text-red-800 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <strong>Warning: This project contains {projectResourcesCount} resource{projectResourcesCount !== 1 ? 's' : ''}</strong>
                  </div>
                  <p className="mb-3">Deleting this project will result in these resources being inaccessible unless you transfer them first.</p>
                  
                  {/* Resources preview */}
                  <div className="mb-4 bg-white p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                    {projectResources.slice(0, 3).map(resource => (
                      <div key={resource._id} className="flex items-center mb-2 border-b border-gray-100 pb-2">
                        <div className="w-8 h-8 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="truncate text-sm font-medium">{resource.name}</div>
                          <div className="text-xs text-gray-500">{new Date(resource.updatedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                    {projectResourcesCount > 3 && (
                      <div className="text-sm text-gray-600 mt-2 text-center">
                        + {projectResourcesCount - 3} more resource{projectResourcesCount - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="font-medium text-gray-700 mb-2">Choose an action:</p>
                  
                  <div className="mb-3">
                    <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 border rounded-lg hover:border-blue-300 transition-colors">
                      <input 
                        type="radio" 
                        name="deleteAction" 
                        className="h-4 w-4 text-blue-600"
                        checked={!createBackupSpace && !targetProject}
                        onChange={() => {
                          setCreateBackupSpace(false);
                          setTargetProject(null);
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-800">Delete resources with project</div>
                        <div className="text-sm text-gray-500">All resources in this project will be permanently deleted.</div>
                      </div>
                    </label>
                  </div>
                  
                  <div className="mb-3">
                    <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 border rounded-lg hover:border-blue-300 transition-colors">
                      <input 
                        type="radio" 
                        name="deleteAction" 
                        className="h-4 w-4 text-blue-600"
                        checked={!!targetProject}
                        onChange={() => {
                          setCreateBackupSpace(false);
                          setTargetProject(projects.find(p => p._id !== manageProjectModal.project._id && p._id !== 'general') || null);
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-800">Move resources to another project</div>
                        <div className="text-sm text-gray-500">Transfer resources to an existing project before deletion.</div>
                      </div>
                    </label>
                    
                    {targetProject && (
                      <div className="mt-3 ml-6">
                        <label className="block text-gray-700 text-sm font-medium mb-2">Select Target Project</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                          value={targetProject?._id || ''}
                          onChange={(e) => {
                            const selected = projects.find(p => p._id === e.target.value);
                            setTargetProject(selected || null);
                          }}
                        >
                          <option value="general">General (Default)</option>
                          {projects
                            .filter(p => p._id !== 'general' && p._id !== manageProjectModal.project._id)
                            .map(project => (
                              <option key={project._id} value={project._id}>{project.name}</option>
                            ))
                          }
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 border rounded-lg hover:border-blue-300 transition-colors">
                      <input 
                        type="radio" 
                        name="deleteAction" 
                        className="h-4 w-4 text-blue-600"
                        checked={createBackupSpace}
                        onChange={() => {
                          setCreateBackupSpace(true);
                          setTargetProject(null);
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-800">Create backup project</div>
                        <div className="text-sm text-gray-500">Create a backup project with all resources before deletion.</div>
                      </div>
                    </label>
                    
                    {createBackupSpace && (
                      <div className="mt-3 ml-6">
                        <label className="block text-gray-700 text-sm font-medium mb-2">Backup Project Name</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={backupSpaceName}
                          onChange={(e) => setBackupSpaceName(e.target.value)}
                          placeholder="Enter backup project name"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setManageProjectModal({ show: false, project: null, action: null })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (createBackupSpace) {
                        // Create backup project and move resources
                        if (!backupSpaceName.trim()) {
                          alert('Please enter a backup project name');
                          return;
                        }
                        
                        const resourceIds = projectResources.map(r => r._id);
                        const success = await createBackupProjectAndMove(
                          manageProjectModal.project._id,
                          backupSpaceName.trim(),
                          resourceIds
                        );
                        
                        if (success) {
                          deleteProject(manageProjectModal.project._id);
                        }
                      } else if (targetProject) {
                        // Move resources to selected project
                        const resourceIds = projectResources.map(r => r._id);
                        const success = await moveResourcesToProject(
                          manageProjectModal.project._id,
                          targetProject._id,
                          resourceIds
                        );
                        
                        if (success) {
                          deleteProject(manageProjectModal.project._id);
                        }
                      } else {
                        // Just delete the project and its resources
                        if (confirm(`Are you sure you want to delete this project and all ${projectResourcesCount} resources? This action cannot be undone.`)) {
                          deleteProject(manageProjectModal.project._id);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {createBackupSpace
                      ? 'Create Backup & Delete Project'
                      : targetProject
                        ? 'Move Resources & Delete Project'
                        : 'Delete Project & Resources'}
                  </button>
                </div>
              </div>
            ) : (
              /* Delete Project without Resources Warning UI */
              <div>
                <div className="mb-6 bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="flex items-center text-red-800 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <strong>Are you sure you want to delete this project?</strong>
                  </div>
                  <p>You are about to delete the project <strong>"{manageProjectModal.project?.name}"</strong>. This action cannot be undone.</p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setManageProjectModal({ show: false, project: null, action: null })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteProject(manageProjectModal.project._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {projectModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Create New Project</h3>
              </div>
              <button 
                onClick={() => setProjectModal({ show: false })}
                className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Illustration */}
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 bg-blue-50 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
            </div>
            
            <p className="mb-5 text-gray-600 text-center">Create a new project to organize your documentation and keep resources organized efficiently.</p>
            
            <form onSubmit={(e) => { 
              e.preventDefault();
              const btn = e.currentTarget.querySelector('button[type="submit"]');
              if (btn) {
                // Display loading state
                btn.disabled = true;
                btn.innerHTML = '<div class="flex items-center"><div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>Creating...</div>';
                
                // Call create project with slight delay to show animation
                setTimeout(() => {
                  createProject(newProjectName);
                }, 500);
              } else {
                createProject(newProjectName);
              }
            }}>
              <div className="mb-5">
                <label htmlFor="projectName" className="block text-gray-700 text-sm font-medium mb-2">Project Name</label>
                <div className="relative">
                  <input
                    type="text"
                    id="projectName"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    placeholder="Enter project name"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                </div>
                {newProjectName && (
                  <p className="mt-2 text-sm text-gray-500">Documents will be organized under "{newProjectName}"</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setProjectModal({ show: false })}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-w-[140px] flex items-center justify-center shadow-md"
                  disabled={!newProjectName.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Bulk Action Confirmation Modal */}
      {bulkActionModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              {bulkActionModal.action === 'delete' ? 'Confirm Bulk Deletion' : 'Confirm Action'}
            </h3>
            <p className="mb-6 text-gray-600">
              {bulkActionModal.action === 'delete' 
                ? `Are you sure you want to delete ${selectedItems.length} selected document${selectedItems.length !== 1 ? 's' : ''}? This action cannot be undone.`
                : `Are you sure you want to proceed with this action on ${selectedItems.length} selected document${selectedItems.length !== 1 ? 's' : ''}?`
              }
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setBulkActionModal({ show: false, action: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={bulkActionModal.action === 'delete' ? handleBulkDelete : null}
                className={`px-4 py-2 ${bulkActionModal.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors flex items-center`}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  bulkActionModal.action === 'delete' ? 'Delete All' : 'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Move to Project Modal */}
      {moveToProjectModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Move to Project</h3>
              <button 
                onClick={() => setMoveToProjectModal({ show: false })}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-gray-600">
              Select a project to move {selectedItems.length} document{selectedItems.length !== 1 ? 's' : ''} to:
            </p>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <button
                onClick={() => handleMoveToProject('general')}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
              >
                <div className="w-10 h-10 mr-3 bg-gray-100 flex items-center justify-center rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">General</div>
                  <div className="text-sm text-gray-500">Unassigned documents</div>
                </div>
              </button>
              
              {projects.filter(p => p._id !== 'general').map(project => (
                <button
                  key={project._id}
                  onClick={() => handleMoveToProject(project._id)}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
                >
                  <div className="w-10 h-10 mr-3 bg-blue-100 flex items-center justify-center rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-gray-500">Project</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setMoveToProjectModal({ show: false })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {passwordModal.type === 'lock' && 'Add Password Protection'}
                {passwordModal.type === 'unlock' && 'Manage Password Protection'}
                {passwordModal.type === 'download' && 'Enter Password to Download'}
                {passwordModal.type === 'view' && 'Enter Password to View'}
              </h3>
              <button 
                onClick={() => {
                  setPasswordModal({ show: false, resource: null, type: 'view' });
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {['lock', 'unlock', 'verify-remove', 'change'].includes(passwordModal.type) ? (
              <>
                {passwordModal.type === 'verify-remove' ? (
                  <>
                    <p className="mb-4 text-gray-600">Enter the current password to remove protection from <span className="font-medium">{passwordModal.resource.name}</span>.</p>
                    <div className="mb-4">
                      <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="Enter current password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(!showPassword)}
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
                    </div>
                    <div className="flex justify-between space-x-3">
                      <button
                        onClick={() => {
                          setPasswordModal({ 
                            show: true, 
                            resource: passwordModal.resource, 
                            type: 'unlock' 
                          });
                          setPassword('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          // First verify the current password is correct
                          try {
                            const verifyResponse = await fetch(`/api/resources/${passwordModal.resource._id}/verify`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ password })
                            });
                            
                            if (!verifyResponse.ok) {
                              alert('Incorrect password. Please try again.');
                              return;
                            }
                            
                            // If verification successful, remove protection
                            // Pass the current password as oldPassword for verification
                            toggleLockDocument(passwordModal.resource._id, false, "", password).then(success => {
                              if (success) {
                                alert('Password protection removed successfully');
                                setPassword('');
                              }
                            });
                          } catch (error) {
                            console.error('Error verifying password:', error);
                            alert('Failed to verify password');
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        disabled={!password}
                      >
                        Remove Protection
                      </button>
                    </div>
                  </>
                ) : passwordModal.type === 'unlock' ? (
                  <div className="mb-6">
                    <div className="flex justify-center p-4 mb-5">
                      <div className="relative">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <div className="absolute top-0 right-0 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-center mb-5 text-gray-600">Document <span className="font-semibold">{passwordModal.resource.name}</span> is currently password protected.</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <button
                        onClick={() => setPasswordModal({ show: true, resource: passwordModal.resource, type: 'change' })}
                        className="py-3 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-center border border-blue-200 flex items-center justify-center shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Change Password
                      </button>
                      
                      <button
                        onClick={() => {
                          setPasswordModal({ 
                            show: true, 
                            resource: passwordModal.resource, 
                            type: 'verify-remove' 
                          });
                        }}
                        className="py-3 px-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors text-center border border-red-200 flex items-center justify-center shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove Protection
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mb-4 text-gray-600">
                    Add a password to protect this document. Users will need to enter the password to download or view it.
                  </p>
                )}
                {passwordModal.type !== 'unlock' && (
                <form onSubmit={(e) => { 
                  e.preventDefault();
                  
                  // Validate passwords match for 'lock' type
                  if ((passwordModal.type === 'lock' || passwordModal.type === 'change') && password !== confirmPassword) {
                    alert('Passwords do not match');
                    return;
                  }
                  
                  // Determine if we're locking or changing the document password
                  const isLocking = passwordModal.type === 'lock' || passwordModal.type === 'change';
                  
                  // For change password, we need to provide the old password too
                  const oldPassword = passwordModal.type === 'change' ? password : null;
                  const newPassword = passwordModal.type === 'change' ? confirmPassword : password;
                  
                  // Call the toggleLockDocument function
                  toggleLockDocument(
                    passwordModal.resource._id, 
                    isLocking, 
                    newPassword,
                    oldPassword
                  ).then(success => {
                    if (success) {
                      setPassword('');
                      setConfirmPassword('');
                      alert(`Password protection ${passwordModal.type === 'lock' ? 'set' : 'updated'} successfully`);
                    }
                  });
                }}>
                  <div className="mb-4">
                    <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        ref={passwordInputRef}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter password"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {password && (
                      <div className="mt-1">
                        <div className="h-1 bg-gray-200 rounded-full">
                          <div 
                            className={`h-1 rounded-full ${password.length < 6 ? 'bg-red-500' : password.length < 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, password.length * 10)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {password.length < 6 ? 'Weak password' : password.length < 10 ? 'Medium strength' : 'Strong password'}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {(passwordModal.type === 'lock' || passwordModal.type === 'change') && (
                    <div className="mb-4">
                      <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-medium mb-2">
                        {passwordModal.type === 'change' ? 'New Password' : 'Confirm Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="confirmPassword"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full pr-10 pl-3 py-2 border ${passwordModal.type === 'change' ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500' : (password && confirmPassword && password !== confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500')} rounded-lg focus:outline-none focus:ring-2`}
                          placeholder={passwordModal.type === 'change' ? "Enter new password" : "Confirm password"}
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      {passwordModal.type !== 'change' && password && confirmPassword && password !== confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                      )}
                      {confirmPassword && (
                        <div className="mt-1">
                          <div className="h-1 bg-gray-200 rounded-full">
                            <div 
                              className={`h-1 rounded-full ${confirmPassword.length < 6 ? 'bg-red-500' : confirmPassword.length < 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(100, confirmPassword.length * 10)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {confirmPassword.length < 6 ? 'Weak password' : confirmPassword.length < 10 ? 'Medium strength' : 'Strong password'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordModal({ show: false, resource: null, type: 'view' });
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={!password.trim() || (passwordModal.type === 'lock' && password !== confirmPassword) || (passwordModal.type === 'change' && !confirmPassword.trim())}
                    >
                      {passwordModal.type === 'lock' ? 'Set Password' : 'Update Password'}
                    </button>
                  </div>
                </form>
                )}
              </>
            ) : (
              <>
                <p className="mb-4 text-gray-600">
                  This document is password protected. Please enter the password to {passwordModal.type === 'download' ? 'download' : 'view'} it.
                </p>
                <form onSubmit={(e) => { 
                  e.preventDefault();
                  // Handle password verification and download/view logic
                  fetch(`/api/resources/${passwordModal.resource._id}/verify`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password })
                  })
                  .then(response => {
                    if (!response.ok) throw new Error('Incorrect password');
                    return response.json();
                  })
                  .then(() => {
                    setPasswordModal({ show: false, resource: null, type: 'view' });
                    setPassword('');
                    
                    // If download type, trigger the download after password verification
                    if (passwordModal.type === 'download' && passwordModal.resource) {
                      // Trigger download with verified token
                      window.open(`/api/media/${passwordModal.resource.fileId}?token=${Date.now()}`, '_blank');
                    }
                  })
                  .catch(error => {
                    console.error('Error verifying password:', error);
                    alert('Incorrect password. Please try again.');
                  });
                }}>
                  <div className="mb-4">
                    <label htmlFor="accessPassword" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                    <input
                      type="password"
                      id="accessPassword"
                      ref={passwordInputRef}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordModal({ show: false, resource: null, type: 'view' });
                        setPassword('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={!password.trim()}
                    >
                      {passwordModal.type === 'download' ? 'Download' : 'View'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Rename Modal */}
      {renameModal.show && renameModal.resource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Rename Document</h3>
              <button 
                onClick={() => setRenameModal({ show: false, resource: null, newName: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              renameResource(renameModal.resource._id, renameModal.newName);
            }}>
              <div className="mb-4">
                <label htmlFor="newName" className="block text-gray-700 text-sm font-medium mb-2">New Name</label>
                <input
                  type="text"
                  id="newName"
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new name"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRenameModal({ show: false, resource: null, newName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.resource.name}
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Temporary Disable Modal */}
      {tempDisableModal.show && tempDisableModal.resource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {tempDisableModal.resource.isDisabled ? 'Enable Access' : 'Temporarily Disable Access'}
              </h3>
              <button 
                onClick={() => setTempDisableModal({ show: false, resource: null })}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              {tempDisableModal.resource.isDisabled ? (
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-green-100 rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-700">Are you sure you want to enable access to this document? Users will be able to view and download it again.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-red-100 rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-700">Temporarily disabling access will prevent users from viewing or downloading this document until you enable it again.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setTempDisableModal({ show: false, resource: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleTempDisable(tempDisableModal.resource._id, !tempDisableModal.resource.isDisabled)}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${tempDisableModal.resource.isDisabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {tempDisableModal.resource.isDisabled ? 'Enable Access' : 'Disable Access'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Action Button for document upload */}
      <div className="fixed bottom-8 right-8 z-40">
        <Link 
          href="/upload_documentation" 
          className="bg-blue-600 hover:bg-blue-700 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 group"
          title="Upload New Document"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span className="absolute right-full mr-4 bg-gray-800 text-white text-sm px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
            Upload Document
          </span>
        </Link>
      </div>
    </div>
  );
}