'use client';

import React, { useState, useEffect } from 'react';
import { X, Folder, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function MoveModal({ isOpen, file, currentProjectId, currentFolderId, onClose, onMove }) {
  const [projects, setProjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedProject, setSelectedProject] = useState(currentProjectId);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedProject) {
      fetchFolders();
    }
  }, [selectedProject, isOpen]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects([{ _id: 'general', name: 'General' }, ...data]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchFolders = async () => {
    try {
      setLoadingFolders(true);
      const response = await fetch(`/api/documentation/folders?projectId=${selectedProject}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.filter(f => !f.parentId)); // Only root folders
      } else {
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleMove = async () => {
    setLoading(true);
    try {
      await onMove(file, selectedProject, selectedFolder);
    } catch (error) {
      console.error('Error moving file:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const isSameLocation = selectedProject === currentProjectId && selectedFolder === currentFolderId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Move File</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* File info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">Moving</p>
            <p className="font-medium text-gray-900">{file.name}</p>
          </div>

          {/* Select Project */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedFolder(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Folder (optional)
            </label>
            {loadingFolders ? (
              <div className="flex items-center gap-2 text-gray-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading folders...</span>
              </div>
            ) : folders.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 py-3">
                <Folder className="w-4 h-4" />
                <span>No folders in this project</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                    selectedFolder === null
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Folder className="w-5 h-5" />
                  <span className="font-medium">Root (no folder)</span>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder._id}
                    onClick={() => setSelectedFolder(folder._id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                      selectedFolder === folder._id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Folder className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Warning for same location */}
          {isSameLocation && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Same Location</p>
                <p className="text-xs text-amber-600 mt-0.5">The file is already in this location.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={loading || isSameLocation}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Move File
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
