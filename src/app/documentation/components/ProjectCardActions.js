'use client';

import React, { useState } from 'react';
import { Settings, Trash2, Lock, Info, Edit, ChevronDown, Play, Lightbulb, Pause, Archive, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'Active', icon: Play, color: 'text-emerald-600' },
  ideation: { label: 'Ideation', icon: Lightbulb, color: 'text-violet-600' },
  paused: { label: 'Paused', icon: Pause, color: 'text-amber-600' },
  shelved: { label: 'Shelved', icon: Archive, color: 'text-slate-500' },
  archived: { label: 'Archived', icon: Archive, color: 'text-gray-500' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-red-600' },
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'ideation', label: 'Ideation' },
  { value: 'paused', label: 'Paused' },
  { value: 'shelved', label: 'Shelved' },
  { value: 'archived', label: 'Archived' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function ProjectCardActions({ project, onEdit, onDelete, onPermissions, onDetails, onStatusChange }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
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

  const handleStatusSelect = (newStatus) => {
    if (onStatusChange) {
      onStatusChange(project, newStatus);
    }
    setShowStatusMenu(false);
  };

  const currentStatus = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = currentStatus.icon;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Quick Status Change Button - Icon style */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowStatusMenu(v => !v);
            }}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Change Status"
          >
            <StatusIcon className={`w-4 h-4 ${currentStatus.color}`} />
          </button>

          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-40 min-w-48">
                {STATUS_OPTIONS.map(opt => {
                  const config = STATUS_CONFIG[opt.value];
                  const Icon = config.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusSelect(opt.value)}
                      className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-sm transition-colors ${
                        status === opt.value
                          ? 'bg-gray-50 font-medium text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      {opt.label}
                      {status === opt.value && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

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
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
