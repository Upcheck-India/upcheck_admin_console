'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Lock, Download, AlertCircle, Loader2, FileText, CheckCircle2,
  X, Eye, EyeOff, ExternalLink, Globe, User, Clock
} from 'lucide-react';

export default function SharedResourcePage() {
  const params = useParams();
  const token = params.token;

  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verified, setVerified] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchShareData();
  }, [token]);

  const fetchShareData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/share/${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load shared resource');
      } else {
        setShareData(data);

        // Check if user has access or needs password
        if (!data.hasAccess && !data.requiresPassword) {
          // No access and no password option - show error
          setError('You do not have permission to access this shared file. Check your authentication or contact the owner for access.');
        } else if (!data.requiresPassword) {
          // No password required - grant access
          setVerified(true);
        }
        // If requiresPassword is true, show password screen (handled below)
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const response = await fetch(`/api/share/${token}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setVerified(true);
        setPasswordError('');
      } else {
        const data = await response.json();
        setPasswordError(data.error || 'Incorrect password');
      }
    } catch (err) {
      setPasswordError('Network error. Please try again.');
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const resource = shareData?.resource;

      if (!resource) return;

      // Handle external storage
      if (resource.externalUrl) {
        window.open(resource.externalUrl, '_blank');
      } else {
        // Download from server using the secure shared download endpoint
        window.location.href = `/api/share/${token}/download`;
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading shared resource...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {shareData?.hasAccess === false ? 'Access Denied' : 'Unable to Access'}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!verified && shareData?.requiresPassword && shareData?.hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Password Required</h2>
            <p className="text-gray-500 text-sm">
              This shared file is protected with a password
            </p>
          </div>

          {shareData?.resource && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{shareData.resource.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(shareData.resource.fileSize)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Enter Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); if (e.key === 'Escape') window.location.reload(); }}
                  placeholder="Enter the password"
                  className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={handlePasswordSubmit}
              disabled={!password}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unlock File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Shared File</h1>
                <p className="text-sm text-white/80">You have access to view and download this file</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* File Info */}
            {shareData?.resource && (
              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="w-7 h-7 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 truncate mb-1">
                      {shareData.resource.name}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {formatFileSize(shareData.resource.fileSize)}
                      </span>
                      {shareData.resource.mimeType && (
                        <span>{shareData.resource.mimeType}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Share Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Shared by</p>
                  <p className="text-sm font-medium text-gray-900">
                    {shareData?.createdBy?.username || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Expires</p>
                  <p className="text-sm font-medium text-gray-900">
                    {shareData?.expiresAt
                      ? new Date(shareData.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preparing download...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download File
                </>
              )}
            </button>

            {shareData?.resource?.externalUrl && (
              <p className="text-xs text-gray-500 text-center mt-4">
                This file is stored externally. Clicking download will open it in a new tab.
              </p>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600">
            <Lock className="w-4 h-4 inline mr-1.5" />
            This is a secure shared link. Please do not forward it to others.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
