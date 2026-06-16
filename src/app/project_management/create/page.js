'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle, UploadCloud } from 'lucide-react';
import AddMemberForm from './AddMemberForm';
import { uploadFile } from '../../../lib/upload'; // Import the upload helper

const CreateProjectPage = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);

  // moved above
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [members, setMembers] = useState([]); // State for project members
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch current user on mount to enforce role-based access
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.user?.role === 'Intern') {
          router.push('/project_management');
        }
      } catch (err) {
        console.error('Failed to fetch user', err);
        router.push('/login');
      }
    };
    fetchUser();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!name.trim()) {
      setError('Project name is required.');
      setLoading(false);
      return;
    }

    let uploadedLogoUrl = logoUrl;

    try {
      // If a file is selected, upload it first
      if (logoFile) {
        const uploadResult = await uploadFile(logoFile);
        if (uploadResult && uploadResult.filePath) {
          uploadedLogoUrl = uploadResult.filePath;
        } else {
          throw new Error('Logo upload failed.');
        }
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          description, 
          logo: uploadedLogoUrl, 
          members 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      router.push('/project_management');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button 
            onClick={() => router.back()}
            className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </button>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h1>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 mr-3" />
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="logoFile" className="block text-sm font-medium text-gray-700">Project Logo (Optional)</label>
              <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="logoFile" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>Upload a file</span>
                      <input id="logoFile" name="logoFile" type="file" className="sr-only" onChange={(e) => setLogoFile(e.target.files[0])} accept="image/*" />
                    </label>
                    <p className="pl-1">or paste a URL below</p>
                  </div>
                  {logoFile ? (
                    <p className="text-xs text-gray-500">{logoFile.name}</p>
                  ) : (
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  )}
                </div>
              </div>
              <input
                type="text"
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Or paste an image URL here"
              />
            </div>

            <AddMemberForm members={members} setMembers={setMembers} />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || (currentUser && currentUser.role === 'Intern')}
                className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200 disabled:bg-blue-300"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Creating...</>
                ) : (
                  currentUser && currentUser.role === 'Intern' ? 'Not Allowed' : 'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectPage;
