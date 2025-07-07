'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertTriangle, Settings, Users, Github, Image, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import ManageMembersForm from './ManageMembersForm';
import { uploadFile } from '../../../lib/upload';

const SettingsTab = ({ project, user, onProjectUpdate }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(project.logo || '');
  const [members, setMembers] = useState(project.members);
  const [repoUrl, setRepoUrl] = useState(project.githubRepoUrl || '');
  const [showRepoPreview, setShowRepoPreview] = useState(false);
  const [repoValidation, setRepoValidation] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (project && user) {
      const isSuper = project.superManager === user.username;
      const isManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
      setIsAuthorized(isSuper || isManager);
    }
  }, [project, user]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
      name !== project.name ||
      description !== project.description ||
      logoUrl !== (project.logo || '') ||
      repoUrl !== (project.githubRepoUrl || '') ||
      JSON.stringify(members) !== JSON.stringify(project.members) ||
      logoFile !== null;
    
    setHasUnsavedChanges(hasChanges);
  }, [name, description, logoUrl, repoUrl, members, logoFile, project]);

  // Validate GitHub URL
  useEffect(() => {
    const validateRepo = async () => {
      if (!repoUrl.trim()) {
        setRepoValidation(null);
        return;
      }

      const githubPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
      if (!githubPattern.test(repoUrl.trim())) {
        setRepoValidation({ status: 'error', message: 'Invalid GitHub URL format' });
        return;
      }

      setRepoValidation({ status: 'validating', message: 'Validating repository...' });
      
      try {
        const repoPath = repoUrl.replace('https://github.com/', '');
        const response = await fetch(`https://api.github.com/repos/${repoPath}`);
        
        if (response.ok) {
          const repoData = await response.json();
          setRepoValidation({ 
            status: 'success', 
            message: 'Repository found',
            data: repoData 
          });
        } else {
          setRepoValidation({ 
            status: 'error', 
            message: 'Repository not found or not accessible' 
          });
        }
      } catch (err) {
        setRepoValidation({ 
          status: 'error', 
          message: 'Failed to validate repository' 
        });
      }
    };

    const timeoutId = setTimeout(validateRepo, 500);
    return () => clearTimeout(timeoutId);
  }, [repoUrl]);

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    let uploadedLogoUrl = logoUrl;

    try {
      if (logoFile) {
        const uploadResult = await uploadFile(logoFile);
        if (uploadResult && uploadResult.filePath) {
          uploadedLogoUrl = uploadResult.filePath;
        } else {
          throw new Error('Logo upload failed.');
        }
      }

      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: description.trim(), 
          logo: uploadedLogoUrl, 
          members,
          githubRepoUrl: repoUrl.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      setSuccess('Project settings updated successfully!');
      setLogoFile(null);
      onProjectUpdate(); // Callback to refresh data on the parent page

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName(project.name);
    setDescription(project.description);
    setLogoUrl(project.logo || '');
    setMembers(project.members);
    setRepoUrl(project.githubRepoUrl || '');
    setLogoFile(null);
    setError(null);
    setSuccess(null);
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg flex items-start p-4">
          <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Permissions Required</h3>
            <p className="text-yellow-700 text-sm">
              Only the Super Manager or Project Managers can modify project settings.
            </p>
            <p className="text-yellow-600 text-xs mt-2">
              Your current role: <span className="font-medium">
                {project.members?.find(m => m.user === user.username)?.role || 'Contributor'}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <XCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-800">Error</h4>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-green-800">Success</h4>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              General Settings
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input 
                  type="text" 
                  id="projectName" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Repository URL
                </label>
                <div className="relative">
                  <input 
                    type="url" 
                    id="repoUrl" 
                    value={repoUrl} 
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {repoValidation?.status === 'validating' && (
                      <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                    )}
                    {repoValidation?.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {repoValidation?.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                {repoValidation?.message && (
                  <p className={`text-xs mt-1 ${
                    repoValidation.status === 'error' ? 'text-red-600' : 
                    repoValidation.status === 'success' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {repoValidation.message}
                  </p>
                )}
                {repoValidation?.status === 'success' && repoValidation.data && (
                  <button
                    type="button"
                    onClick={() => setShowRepoPreview(!showRepoPreview)}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center"
                  >
                    {showRepoPreview ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showRepoPreview ? 'Hide' : 'Show'} repository info
                  </button>
                )}
                {showRepoPreview && repoValidation?.data && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md border text-xs">
                    <p><strong>Name:</strong> {repoValidation.data.name}</p>
                    <p><strong>Description:</strong> {repoValidation.data.description || 'No description'}</p>
                    <p><strong>Language:</strong> {repoValidation.data.language || 'Not specified'}</p>
                    <p><strong>Stars:</strong> {repoValidation.data.stargazers_count}</p>
                    <p><strong>Private:</strong> {repoValidation.data.private ? 'Yes' : 'No'}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Project Description
              </label>
              <textarea 
                id="projectDescription" 
                rows={4} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe your project goals, scope, and key objectives..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Image className="h-4 w-4 inline mr-1" />
                Project Logo
              </label>
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  {(logoUrl || logoFile) && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border">
                      {logoFile ? (
                        <img 
                          src={URL.createObjectURL(logoFile)} 
                          alt="Logo preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <img 
                          src={logoUrl} 
                          alt="Current logo" 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      )}
                      <div className="w-full h-full bg-gray-200 rounded-lg hidden items-center justify-center">
                        <Image className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      id="logoFile" 
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="url" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Or paste an image URL"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Management */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-gray-600" />
              Team Management
            </h3>
          </div>
          <div className="p-6">
            <ManageMembersForm 
              initialMembers={members} 
              onMembersChange={setMembers} 
              superManager={project.superManager} 
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center">
            {hasUnsavedChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                You have unsaved changes
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || !hasUnsavedChanges}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Changes
            </button>
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={isSubmitting || !hasUnsavedChanges}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;