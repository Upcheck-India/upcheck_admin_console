'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import {
  Clock, Calendar, Users, FileText, AlertCircle, CheckCircle, X, User, Mail,
  Loader2, ExternalLink, Eye
} from 'lucide-react';

const STATUS_CONFIG = {
  Backlog: { label: 'Backlog', color: 'bg-gray-100 text-gray-800' },
  'To Do': { label: 'To Do', color: 'bg-blue-100 text-blue-800' },
  'In Progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  Done: { label: 'Done', color: 'bg-green-100 text-green-800' },
};

const TYPE_COLORS = {
  Feature: 'bg-blue-500',
  Bug: 'bg-red-500',
  Chore: 'bg-yellow-500',
  Epic: 'bg-purple-500',
};

export default function PublicSharePage() {
  const params = useParams();
  const { slug } = params;

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shareLink, setShareLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  // Visitor info modal
  const [showVisitorModal, setShowVisitorModal] = useState(true);
  const [visitorInfo, setVisitorInfo] = useState({ name: '', email: '' });
  const [visitorSubmitted, setVisitorSubmitted] = useState(false);

  // Fetch shared project data
  useEffect(() => {
    const fetchSharedProject = async () => {
      try {
        const res = await fetch(`/api/share/s/${slug}`);
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 410) {
            setExpired(true);
            setError('This share link has expired');
          } else if (res.status === 404) {
            setError('Share link not found or inactive');
          } else {
            setError(data.error || 'Failed to load shared project');
          }
          setLoading(false);
          return;
        }

        setProject(data.project);
        setSprints(data.sprints);
        setTasks(data.tasks);
        setShareLink(data.shareLink);
      } catch (err) {
        console.error('Error fetching shared project:', err);
        setError('Failed to load shared project');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchSharedProject();
    }
  }, [slug]);

  // Countdown timer for expiration
  useEffect(() => {
    if (!shareLink?.expiresAt) return;

    const updateCountdown = () => {
      const end = new Date(shareLink.expiresAt);
      const now = new Date();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeLeft(`${minutes}m remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [shareLink?.expiresAt]);

  const handleVisitorSubmit = (skip) => {
    if (!skip && (!visitorInfo.name || !visitorInfo.email)) {
      return;
    }
    // Here you could send the visitor info to your backend
    // await fetch('/api/share/visitor', { method: 'POST', body: JSON.stringify({ slug, ...visitorInfo }) });
    setVisitorSubmitted(true);
    setShowVisitorModal(false);
  };

  const getColumnTasks = (status) => tasks.filter(t => t.status === status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {expired ? 'Link Expired' : 'Link Not Available'}
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          {shareLink?.expiresAt && (
            <p className="text-sm text-gray-500">
              This link expired on {new Date(shareLink.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{project.name} - Shared Project</title>
        <meta name="description" content={`Viewing shared project: ${project.name}`} />
      </Head>

      {/* Visitor Info Modal */}
      {showVisitorModal && !visitorSubmitted && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleVisitorSubmit(true);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Visitor Information</h3>
              <button
                onClick={() => handleVisitorSubmit(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Optional: Please provide your name and email to help the project team track visitors.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="h-4 w-4 inline mr-1" />
                  Name
                </label>
                <input
                  type="text"
                  value={visitorInfo.name}
                  onChange={(e) => setVisitorInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={visitorInfo.email}
                  onChange={(e) => setVisitorInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleVisitorSubmit(true)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleVisitorSubmit(false)}
                  disabled={!visitorInfo.name || !visitorInfo.email}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Eye className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              </div>
              {project.description && (
                <p className="text-gray-600 mt-2">{project.description}</p>
              )}
              {shareLink && (
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <FileText className="h-4 w-4" />
                    {shareLink.name}
                  </span>
                  {shareLink.expiresAt && (
                    <span className={`flex items-center gap-1 ${
                      timeLeft === 'Expired' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      <Clock className="h-4 w-4" />
                      {timeLeft}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                project.status === 'active' ? 'bg-green-100 text-green-700' :
                project.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {project.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Sprint Tabs */}
        {sprints.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sprints</h2>
            <div className="flex flex-wrap gap-3">
              {sprints.map(sprint => (
                <div
                  key={sprint._id}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[200px]"
                >
                  <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
                  {(sprint.startDate || sprint.endDate) && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {sprint.startDate && new Date(sprint.startDate).toLocaleDateString()}
                      {sprint.endDate && (
                        <> - {new Date(sprint.endDate).toLocaleDateString()}</>
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-gray-600">
                    {tasks.filter(t => t.sprintId === sprint._id).length} tasks
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Board */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks Board</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const columnTasks = getColumnTasks(status);
              return (
                <div key={status} className="bg-gray-100 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
                    {config.label}
                    <span className="text-sm font-normal bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                      {columnTasks.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {columnTasks.map(task => (
                      <TaskCard key={task._id} task={task} showUserNames={shareLink?.settings?.showUserNames} />
                    ))}
                    {columnTasks.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-sm text-gray-500 text-center">
            This is a public view of the project. Some information may be hidden based on share settings.
          </p>
        </div>
      </footer>
    </div>
  );
}

function TaskCard({ task, showUserNames }) {
  const typeColor = TYPE_COLORS[task.type] || 'bg-gray-500';

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-800 text-sm pr-2">{task.title}</h4>
        <span className={`${typeColor} text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0`}>
          {task.type}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        {task.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {task.assignees && task.assignees.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {showUserNames
              ? task.assignees.map(a => a.username || 'Anonymous').join(', ')
              : `${task.assignees.length} assignee(s)`}
          </span>
        )}
      </div>
    </div>
  );
}
