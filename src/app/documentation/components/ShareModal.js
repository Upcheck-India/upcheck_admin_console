'use client';

import React, { useState, useEffect } from 'react';
import { X, Link, Users, Clock, Globe, Lock, Copy, Check, Trash2, AlertCircle, User } from 'lucide-react';

const EXPIRY_OPTIONS = [
  { value: '1h', label: '1 hour', seconds: 3600 },
  { value: '24h', label: '24 hours', seconds: 86400 },
  { value: '7d', label: '7 days', seconds: 604800 },
  { value: '30d', label: '30 days', seconds: 2592000 },
  { value: 'never', label: 'Never expires', seconds: null },
];

export default function ShareModal({ isOpen, onClose, file, projectId }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState('');

  // Share settings
  const [isPublic, setIsPublic] = useState(false);
  const [expiry, setExpiry] = useState('24h');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [requirePassword, setRequirePassword] = useState(false);
  const [sharePassword, setSharePassword] = useState('');

  // Fetch project members
  useEffect(() => {
    if (isOpen && projectId && projectId !== 'general') {
      const fetchMembers = async () => {
        try {
          const response = await fetch(`/api/projects/${projectId}`);
          if (response.ok) {
            const project = await response.json();
            setAllMembers(project.members || []);
          }
        } catch (err) {
          console.error('Error fetching members:', err);
        }
      };
      fetchMembers();
    }
  }, [isOpen, projectId]);

  // Create share link on mount
  useEffect(() => {
    if (isOpen && file) {
      createShareLink();
    }
    return () => {
      setShareData(null);
      setCopied(false);
    };
  }, [isOpen, file]);

  const createShareLink = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: file._id,
          isPublic: false,
          allowedMembers: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create share link');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateShareLink = async () => {
    try {
      setLoading(true);
      setError('');

      const expiryOption = EXPIRY_OPTIONS.find(e => e.value === expiry);

      const response = await fetch(`/api/share/${shareData._id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic,
          expirySeconds: expiryOption?.seconds,
          allowedMembers: selectedMembers,
          requirePassword: requirePassword ? true : null,
          password: requirePassword ? sharePassword : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareData(data);
        alert('Share settings updated!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update share link');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    const shareUrl = `${window.location.origin}/shared/${shareData.token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      prompt('Copy this link:', shareUrl);
    }
  };

  const toggleMember = (memberEmail) => {
    setSelectedMembers(prev =>
      prev.includes(memberEmail)
        ? prev.filter(m => m !== memberEmail)
        : [...prev, memberEmail]
    );
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this share link?')) return;

    try {
      const response = await fetch(`/api/share/${shareData._id}/delete`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onClose();
        alert('Share link deleted');
      } else {
        alert('Failed to delete share link');
      }
    } catch (err) {
      alert('Error deleting share link');
    }
  };

  if (!isOpen || !file) return null;

  const shareUrl = shareData?.token ? `${window.location.origin}/shared/${shareData.token}` : '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Link className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Share File</h3>
              <p className="text-sm text-gray-500 truncate max-w-[250px]">{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Share Link Display */}
          {shareData && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Share Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Public Access Toggle */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isPublic ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <Globe className={`w-4 h-4 ${
                  isPublic ? 'text-blue-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Public Access</p>
                <p className="text-xs text-gray-500">Anyone with the link can view</p>
              </div>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isPublic ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {isPublic && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Public links can be accessed by anyone. Use with caution for sensitive files.
              </span>
            </div>
          )}

          {/* Expiry Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Link Expiry
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXPIRY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiry(option.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-colors ${
                    expiry === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${
                    expiry === option.value ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    expiry === option.value ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection */}
          {allMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Restrict to Specific Members
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {allMembers.map(member => (
                  <button
                    key={member.email || member.user}
                    type="button"
                    onClick={() => toggleMember(member.email || member.user)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      selectedMembers.includes(member.email || member.user)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedMembers.includes(member.email || member.user)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedMembers.includes(member.email || member.user) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 flex-1 text-left">
                      {member.user || member.email}
                    </span>
                    <span className="text-xs text-gray-400">{member.role}</span>
                  </button>
                ))}
              </div>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Password Protection */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                requirePassword ? 'bg-amber-50' : 'bg-gray-50'
              }`}>
                <Lock className={`w-4 h-4 ${
                  requirePassword ? 'text-amber-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Password Required</p>
                <p className="text-xs text-gray-500">Visitors must enter a password</p>
              </div>
            </div>
            <button
              onClick={() => setRequirePassword(!requirePassword)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                requirePassword ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  requirePassword ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {requirePassword && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Share Password
              </label>
              <input
                type="text"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Visitors will need to enter this password to access the file
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Link
          </button>
          <button
            onClick={updateShareLink}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings & Update Link'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
