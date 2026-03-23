'use client';

import React, { useState, useEffect } from 'react';
import { X, Folder, Upload, Users, AlertCircle, Info, UploadCloud, Trash2, Plus, ChevronDown } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', description: 'Currently in development' },
  { value: 'ideation', label: 'Ideation', description: 'In planning phase' },
  { value: 'paused', label: 'Paused', description: 'Temporarily on hold' },
];

const PROJECT_ROLES = ['Project Manager', 'Contributor', 'Viewer'];

export default function CreateProjectModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch all users on mount
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const response = await fetch('/api/users');
          if (!response.ok) throw new Error('Failed to fetch users');
          const data = await response.json();
          setAllUsers(data);
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  // Handle logo file selection
  useEffect(() => {
    if (logoFile) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(logoFile);
    } else {
      setLogoPreview(null);
    }
  }, [logoFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let uploadedLogoUrl = formData.logoUrl;

      // Upload logo file if provided
      if (logoFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', logoFile);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          uploadedLogoUrl = uploadResult.filePath;
        } else {
          throw new Error('Logo upload failed');
        }
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
          logo: uploadedLogoUrl,
          members,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setFormData({ name: '', description: '', status: 'active', logoUrl: '' });
        setLogoFile(null);
        setLogoPreview(null);
        setMembers([]);
        onSuccess(data);
        onClose();
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    if (!selectedUser) {
      alert('Please select a user.');
      return;
    }
    if (members.some(m => m.user === selectedUser)) {
      alert('This user has already been added.');
      return;
    }

    const userObject = allUsers.find(u => u.username === selectedUser);
    if (userObject) {
      setMembers([...members, { user: userObject.username, email: userObject.email, role: selectedRole }]);
      setSelectedUser('');
    }
  };

  const handleRemoveMember = (userToRemove) => {
    setMembers(members.filter(member => member.user !== userToRemove));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Folder className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create Project Space</h2>
              <p className="text-sm text-gray-500">Set up a new documentation space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>
              Creating a project space here will also create it in Project Management.
              You can manage team members and settings from either location.
            </span>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the project"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Project Logo/Thumbnail <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-4 items-start">
              {logoPreview && (
                <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden shrink-0">
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Click to upload
                    </span>
                    <span className="text-sm text-gray-500"> or drag and drop</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</p>
                </div>
                {logoFile && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="font-medium">{logoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <input
                type="text"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="Or paste an image URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Initial Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: option.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    formData.status === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`block text-sm font-medium ${
                    formData.status === option.value ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Add Members */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700">Project Members</h3>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="" disabled>Select a user</option>
                {allUsers.map(user => (
                  <option key={user._id} value={user.username}>{user.username} ({user.email})</option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {PROJECT_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddMember}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {members.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {members.map(member => (
                  <div key={member.user} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{member.user}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
