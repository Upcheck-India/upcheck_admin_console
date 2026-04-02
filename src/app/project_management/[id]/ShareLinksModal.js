'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Link2, Clock, Calendar, Users, FileText, CheckCircle, Trash2, Loader2, Eye, ExternalLink, Globe, Monitor, Tablet, Smartphone } from 'lucide-react';

const ShareLinksModal = ({ projectId, onClose }) => {
  const [shareLinks, setShareLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingVisitors, setViewingVisitors] = useState(null); // Share link ID to view visitors
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    expiresAt: '',
    showSprints: [],
    includeProductBoard: true,
    showUserNames: true,
    showDescriptions: true,
    showDueDates: true,
  });
  const [sprints, setSprints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fetch share links and sprints
  useEffect(() => {
    fetchShareLinks();
    fetchSprints();
  }, [projectId]);

  const fetchShareLinks = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch share links');
      const data = await res.json();
      setShareLinks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSprints = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch sprints');
      const data = await res.json();
      setSprints(data);
      setFormData(prev => ({ ...prev, showSprints: data.map(s => s._id) }));
    } catch (err) {
      console.error('Error fetching sprints:', err);
    }
  };

  const handleCreateLink = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create share link');
      }

      const newLink = await res.json();
      setShareLinks(prev => [newLink, ...prev]);
      setShowCreateForm(false);
      setFormData({
        name: '',
        expiresAt: '',
        showSprints: sprints.map(s => s._id),
        includeProductBoard: true,
        showUserNames: true,
        showDescriptions: true,
        showDueDates: true,
      });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchVisitors = async (shareLink) => {
    setVisitorsLoading(true);
    try {
      const res = await fetch(`/api/share/s/${shareLink.slug}/visitors`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch visitors');
      const data = await res.json();
      setVisitors(data);
      setViewingVisitors(shareLink);
    } catch (err) {
      alert(`Error fetching visitors: ${err.message}`);
    } finally {
      setVisitorsLoading(false);
    }
  };

  const handleRevokeLink = async (shareId) => {
    if (!window.confirm('Are you sure you want to revoke this share link?')) return;

    setDeletingId(shareId);
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links/${shareId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to revoke share link');
      }

      setShareLinks(prev => prev.filter(link => link._id !== shareId));
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = (slug) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/share/s/${slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(slug);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const end = new Date(expiresAt);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Share Project</h2>
            <p className="text-sm text-gray-500 mt-1">Create public share links for your project</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Create New Link Button or Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
            >
              <Link2 className="h-5 w-5" />
              Create New Share Link
            </button>
          ) : (
            <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create Share Link</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Stakeholder View, Client Preview"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Expiration (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
                </div>

                {/* Sprints Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="h-4 w-4 inline mr-1" />
                    Sprints to Include
                  </label>
                  <div className="mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.includeProductBoard}
                        onChange={(e) => setFormData(prev => ({ ...prev, includeProductBoard: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Include Product Board (Backlog tasks)</span>
                    </label>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
                    {sprints.map(sprint => (
                      <label key={sprint._id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.showSprints.includes(sprint._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, showSprints: [...prev.showSprints, sprint._id] }));
                            } else {
                              setFormData(prev => ({ ...prev, showSprints: prev.showSprints.filter(id => id !== sprint._id) }));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{sprint.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Display Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-1" />
                    Display Options
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showUserNames}
                        onChange={(e) => setFormData(prev => ({ ...prev, showUserNames: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show team member names</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showDescriptions}
                        onChange={(e) => setFormData(prev => ({ ...prev, showDescriptions: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show task descriptions</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showDueDates}
                        onChange={(e) => setFormData(prev => ({ ...prev, showDueDates: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show due dates</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateLink}
                    disabled={isSubmitting || !formData.name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Share Links */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Active Share Links</h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : shareLinks.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No share links created yet</p>
            ) : (
              shareLinks.map(link => (
                <div
                  key={link._id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{link.name}</h4>
                        {!link.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {baseUrl}/share/s/{link.slug}
                          </code>
                        </span>
                        {link.expiresAt && (
                          <span className={`flex items-center gap-1 ${
                            getTimeRemaining(link.expiresAt) === 'Expired'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }`}>
                            <Clock className="h-3 w-3" />
                            {getTimeRemaining(link.expiresAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {link.settings.showSprints?.length > 0 && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {link.settings.showSprints.length} sprint(s)
                          </span>
                        )}
                        {link.settings.showUserNames && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Names visible
                          </span>
                        )}
                        {!link.settings.showUserNames && (
                          <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Names hidden
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchVisitors(link)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="View visitors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleCopyLink(link.slug)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Copy link"
                      >
                        {copiedId === link.slug ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevokeLink(link._id)}
                        disabled={deletingId === link._id}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Revoke link"
                      >
                        {deletingId === link._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visitors Modal */}
        {viewingVisitors && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingVisitors(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative flex flex-col"
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Visitors</h2>
                  <p className="text-sm text-gray-500">{viewingVisitors.name} - {visitors.length} visit(s)</p>
                </div>
                <button onClick={() => setViewingVisitors(null)} className="text-gray-500 hover:text-gray-800">
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                {visitorsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : visitors.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No visitors yet</p>
                ) : (
                  <div className="space-y-3">
                    {visitors.map((visit, index) => (
                      <div
                        key={visit._id || index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-grow">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="font-semibold text-gray-900">
                                {visit.name || 'Anonymous'}
                                {visit.email && visit.email !== 'Anonymous' && (
                                  <span className="text-gray-500 font-normal"> - {visit.email}</span>
                                )}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Globe className="h-4 w-4" />
                                <span>IP: {visit.ip || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Monitor className="h-4 w-4" />
                                <span>{visit.browser} on {visit.os}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                {visit.device === 'Mobile' ? (
                                  <Smartphone className="h-4 w-4" />
                                ) : visit.device === 'Tablet' ? (
                                  <Tablet className="h-4 w-4" />
                                ) : (
                                  <Monitor className="h-4 w-4" />
                                )}
                                <span>{visit.device}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="h-4 w-4" />
                                <span>{new Date(visit.visitedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareLinksModal;
