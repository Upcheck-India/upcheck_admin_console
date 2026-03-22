'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Download, Eye, Lock, FileText } from 'lucide-react';

export default function SharedResourcePage() {
  const params = useParams();
  const router = useRouter();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndFetchResource();
  }, [params.id]);

  const checkAuthAndFetchResource = async () => {
    try {
      // Check if user is authenticated
      const authCheck = await fetch('/api/auth/check', { credentials: 'include' });
      
      if (!authCheck.ok) {
        // Not authenticated, redirect to login with return URL
        const currentUrl = encodeURIComponent(window.location.pathname);
        router.push(`/login?redirect=${currentUrl}`);
        return;
      }

      // Fetch resource details
      const response = await fetch(`/api/shared/${params.id}`);
      const data = await response.json();

      if (response.ok) {
        setResource(data);
        
        // Check if resource requires password
        if (data.isPasswordProtected && !authenticated) {
          setShowPasswordPrompt(true);
        } else {
          setAuthenticated(true);
        }
      } else {
        setError(data.error || 'Resource not found');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load resource');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/shared/${params.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        setAuthenticated(true);
        setShowPasswordPrompt(false);
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Verification failed');
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/shared/${params.id}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authenticated ? password : undefined })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resource.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      setError('Download failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">Password Protected</h2>
          <p className="text-gray-600 text-center mb-6">
            This resource is password protected. Please enter the password to access.
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{resource.name}</h1>
                <p className="text-blue-100 mt-1">Shared Resource</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">File Size</p>
                <p className="font-medium">{resource.fileSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{resource.mimeType || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Uploaded By</p>
                <p className="font-medium">{resource.uploadedBy?.username || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Views</p>
                <p className="font-medium">{resource.views || 0}</p>
              </div>
            </div>

            {resource.description && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-700">{resource.description}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
