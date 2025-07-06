'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import ManageMembersForm from './ManageMembersForm';
import { uploadFile } from '../../../lib/upload';

const SettingsTab = ({ project, user, onProjectUpdate }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(project.logo || '');
  const [members, setMembers] = useState(project.members);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (project && user) {
      const isSuper = project.superManager === user.username;
      const isManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
      setIsAuthorized(isSuper || isManager);
    }
  }, [project, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
          name, 
          description, 
          logo: uploadedLogoUrl, 
          members 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      alert('Project updated successfully!');
      onProjectUpdate(); // Callback to refresh data on the parent page

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />
            <div>
                <h3 className="font-semibold text-yellow-800">Permissions Required</h3>
                <p className="text-yellow-700 text-sm">Only the Super Manager or Project Managers can modify project settings.</p>
            </div>
        </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
        {error && <p className="text-red-500">{error}</p>}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">General Settings</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Project Name</label>
                    <input type="text" id="projectName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea id="projectDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                </div>
                 <div>
                    <label htmlFor="logoFile" className="block text-sm font-medium text-gray-700">Project Logo</label>
                    <input type="file" id="logoFile" onChange={(e) => setLogoFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Or paste an image URL" className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <ManageMembersForm initialMembers={members} onMembersChange={setMembers} superManager={project.superManager} />
        </div>

        <div className="flex justify-end">
            <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    </form>
  );
};

export default SettingsTab;
