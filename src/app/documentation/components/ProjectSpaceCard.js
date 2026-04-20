'use client';

import React from 'react';
import { 
  Folder, Users, Clock, Activity,
  Play, Pause, Lightbulb, Archive, XCircle,
  FileText
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
  // Bug fix: 'archived' was missing — cards with this status fell through to
  // STATUS_CONFIG.active and showed a green "Active" badge incorrectly
  archived: {
    label: 'Archived',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Archive,
    description: 'No longer active'
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
  isGeneral = false 
}) {
  // Bug fix: onStatusChange, onSettings, onDelete props removed.
  // All card actions are handled exclusively by ProjectCardActions, which
  // page.jsx renders as an absolute overlay (top-4 right-4) on each card.
  // Having a second ⋮ menu inside the card caused two icon menus to appear
  // side-by-side on every card.

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
                onError={e => { e.currentTarget.style.display = 'none'; }}
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

          {/* Bug fix: the card's own ⋮ dropdown (Settings, Delete, Change Status)
              has been removed. ProjectCardActions rendered as an absolute overlay
              in page.jsx already provides all these actions. Two menus on the same
              card caused the double-icon problem shown in the screenshot. */}
        </div>

        {/* Status Badge — display only, no interaction */}
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