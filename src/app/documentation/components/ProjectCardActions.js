'use client';

import React, { useState } from 'react';
import { Settings, Trash2, Lock, Info, Edit } from 'lucide-react';

export default function ProjectCardActions({ project, onEdit, onDelete, onPermissions, onDetails }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState(project.status || 'active');

  const handleEdit = () => {
    onEdit(project, { name: name.trim(), description: description.trim(), status });
    setShowEditModal(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
      onDelete(project);
    }
  };

  const statuses = [
    <option value="active">Active</option>,
    <option value="ideation">Ideation</option>,
    <option value="paused">Paused</option>,
    <option value="shelved">Shelved</option>,
    <option value="archived">Archived</option>,
    <option value="dismissed">Dismissed</option>,
  ];

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEditModal(true);
          }}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Edit Project"
        >
          <Edit className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPermissions(project);
          }}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Manage Permissions"
        >
          <Lock className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDetails(project);
          }}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="View Details"
        >
          <Info className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          title="Delete Project"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
          onClick={() => setShowEditModal(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Project</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {statuses.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
