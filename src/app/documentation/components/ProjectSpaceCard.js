'use client';

import React from 'react';
import { 
  Folder, Users, Clock, Activity, MoreVertical, 
  Settings, Trash2, Play, Pause, Lightbulb, Archive, XCircle,
  FileText, GitBranch
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Play,
    description: 'Currently in development'
  },
  ideation: {
    label: 'Ideation',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Lightbulb,
    description: 'In planning phase'
  },
  paused: {
    label: 'Paused',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Pause,
    description: 'Temporarily on hold'
  },
  shelved: {
    label: 'Shelved',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Archive,
    description: 'Archived for later'
  },
  dismissed: {
    label: 'Dismissed',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
    description: 'No longer pursued'
  }
};

export default function ProjectSpaceCard({ 
  project, 
  stats = {},
  onStatusChange,
  onSettings,
  onDelete,
  isGeneral = false 
}) {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  
  const status = project.status || 'active';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <Link 
            href={`/documentation/${project._id}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            {project.logo ? (
              <img 
                src={project.logo} 
                alt={project.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isGeneral ? 'bg-blue-100' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}>
                <Folder className={`w-5 h-5 ${isGeneral ? 'text-blue-600' : 'text-white'}`} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-sm text-gray-500 truncate">{project.description}</p>
              )}
            </div>
          </Link>

          {!isGeneral && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1.5 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-44">
                  <button
                    onClick={() => { setShowStatusMenu(!showStatusMenu); }}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <StatusIcon className="w-4 h-4 mr-2" />
                    Change Status
                  </button>
                  <button
                    onClick={() => { onSettings(project); setShowDropdown(false); }}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={() => { onDelete(project); setShowDropdown(false); }}
                    className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              )}

              {showStatusMenu && showDropdown && (
                <div className="absolute right-full top-0 mr-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-40">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          onStatusChange(project, key);
                          setShowDropdown(false);
                          setShowStatusMenu(false);
                        }}
                        className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 ${
                          status === key ? 'bg-gray-50 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Badge */}
        {!isGeneral && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 bg-gray-50/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-gray-900">{stats.fileCount || 0}</span>
            <p className="text-xs text-gray-500">Files</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
              <Folder className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-gray-900">{stats.folderCount || 0}</span>
            <p className="text-xs text-gray-500">Folders</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {project.members?.length || 0}
            </span>
            <p className="text-xs text-gray-500">Members</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {formatDate(project.updatedAt || project.createdAt)}</span>
        </div>
        {stats.recentActivity && (
          <div className="flex items-center gap-1 text-blue-600">
            <Activity className="w-3.5 h-3.5" />
            <span>Recent activity</span>
          </div>
        )}
      </div>
    </div>
  );
}
