'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Mail, Calendar, Eye, Link as LinkIcon, Trash2, Check } from 'lucide-react';

export default function ShareDialog({ 
  resourceType, 
  resourceId, 
  roomId,
  resourceName,
  isOpen, 
  onClose 
}) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    targetEmail: '',
    permissions: ['view'],
    expiryDays: '7',
    customExpiry: '',
  });

  const PERMISSION_OPTIONS = [
    { value: 'view', label: 'View Only' },
    { value: 'download', label: 'View & Download' },
    { value: 'comment', label: 'View & Comment' },
  ];

  const EXPIRY_OPTIONS = [
    { value: '1', label: '1 Day' },
    { value: '7', label: '7 Days' },
    { value: '30', label: '30 Days' },
    { value: 'custom', label: 'Custom Date' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen, resourceType, resourceId]);

  async function fetchShares() {
    try {
      const response = await fetch(`/api/dataroom/share?resourceType=${resourceType}&resourceId=${resourceId}`);
      if (response.ok) {
        const data = await response.json();
        setShares(data.shares || []);
      }
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShare() {
    try {
      const expiresAt = formData.expiryDays === 'custom' 
        ? formData.customExpiry 
        : new Date(Date.now() + parseInt(formData.expiryDays) * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch('/api/dataroom/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          roomId,
          targetEmail: formData.targetEmail,
          permissions: formData.permissions,
          expiresAt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateForm(false);
        setFormData({
          targetEmail: '',
          permissions: ['view'],
          expiryDays: '7',
          customExpiry: '',
        });
        fetchShares();
        
        // Show success message with link
        alert(`Share link created! Link: ${getShareUrl(data.shareToken)}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create share');
      }
    } catch (error) {
      console.error('Failed to create share:', error);
      alert('Failed to create share');
    }
  }

  async function handleRevokeShare(shareId) {
    if (!confirm('Are you sure you want to revoke this share link?')) return;

    try {
      const response = await fetch(`/api/dataroom/share/${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchShares();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to revoke share');
      }
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share');
    }
  }

  function getShareUrl(token) {
    return `${window.location.origin}/dataroom/shared/${token}`;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function togglePermission(perm) {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Share {resourceType}</h2>
            <p className="text-sm text-slate-500">{resourceName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading shares...</p>
            </div>
          ) : (
            <>
              {/* Active Shares */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Active Shares</h3>
                {shares.length === 0 ? (
                  <div className="bg-slate-50 rounded-lg p-8 text-center">
                    <LinkIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">No active shares</p>
                    <p className="text-sm text-slate-500 mt-1">Create a share link to invite external users</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shares.filter(s => !s.revokedAt).map((share) => (
                      <div key={share._id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Mail className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-slate-900">{share.targetEmail}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {share.permissions.map((p) => (
                                <span key={p} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  {p}
                                </span>
                              ))}
                            </div>
                            {share.expiresAt && (
                              <div className="flex items-center space-x-1 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                <span>Expires: {new Date(share.expiresAt).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRevokeShare(share._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Revoke"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Share Link */}
                        <div className="flex items-center space-x-2 bg-slate-50 rounded-lg p-2">
                          <input
                            type="text"
                            value={getShareUrl(share.shareToken)}
                            readOnly
                            className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
                          />
                          <button
                            onClick={() => copyToClipboard(getShareUrl(share.shareToken))}
                            className="p-2 hover:bg-slate-200 rounded"
                            title="Copy Link"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Share Form */}
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                >
                  <Mail className="w-5 h-5" />
                  <span>Invite External User</span>
                </button>
              ) : (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Share Link</h3>
                  
                  {/* Email Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.targetEmail}
                      onChange={(e) => setFormData({ ...formData, targetEmail: e.target.value })}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      The user will need to register/login to access the shared resource
                    </p>
                  </div>

                  {/* Permissions */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Access Level</label>
                    <div className="space-y-2">
                      {PERMISSION_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-center space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            type="radio"
                            name="permission"
                            checked={formData.permissions.includes(opt.value)}
                            onChange={() => setFormData({ ...formData, permissions: [opt.value] })}
                            className="text-blue-600"
                          />
                          <span className="text-slate-900">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Link Expires In</label>
                    <select
                      value={formData.expiryDays}
                      onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2"
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    
                    {formData.expiryDays === 'custom' && (
                      <input
                        type="datetime-local"
                        value={formData.customExpiry}
                        onChange={(e) => setFormData({ ...formData, customExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateShare}
                      disabled={!formData.targetEmail}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Share Link
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
