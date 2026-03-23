'use client';

import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Settings, Upload, Image, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { uploadFile } from '../../../lib/upload';

export default function ProjectSettings({ project, onProjectUpdate }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(project?.logo || '');
  const [status, setStatus] = useState(project?.status || 'active');
  const [repoUrl, setRepoUrl] = useState(project?.githubRepoUrl || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const statusOptions = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
    { value: 'ideation', label: 'Ideation', color: 'bg-purple-100 text-purple-700' },
    { value: 'paused', label: 'Paused', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'shelved', label: 'Shelved', color: 'bg-gray-100 text-gray-700' },
    { value: 'archived', label: 'Archived', color: 'bg-slate-100 text-slate-700' },
    { value: 'dismissed', label: 'Dismissed', color: 'bg-red-100 text-red-700' },
  ];

  // Track unsaved changes
  useEffect(() => {
    if (!project) return;

    const hasChanges =
      name !== project.name ||
      description !== project.description ||
      logoUrl !== (project.logo || '') ||
      status !== (project.status || 'active') ||
      repoUrl !== (project.githubRepoUrl || '') ||
      logoFile !== null;

    setHasUnsavedChanges(hasChanges);
  }, [name, description, logoUrl, status, repoUrl, logoFile, project]);

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
        if (uploadResult) {
          uploadedLogoUrl = uploadResult;
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
          status,
          githubRepoUrl: repoUrl.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      setSuccess('Project settings updated successfully!');
      setLogoFile(null);
      if (onProjectUpdate) {
        onProjectUpdate();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName(project?.name || '');
    setDescription(project?.description || '');
    setLogoUrl(project?.logo || '');
    setStatus(project?.status || 'active');
    setRepoUrl(project?.githubRepoUrl || '');
    setLogoFile(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="space-y-6">
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
              <label htmlFor="projectStatus" className="block text-sm font-medium text-gray-700 mb-2">
                Project Status
              </label>
              <select
                id="projectStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Repository URL
            </label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
            Reset
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
  );
}
