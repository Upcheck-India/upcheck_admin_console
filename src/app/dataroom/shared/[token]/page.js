'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, FileText, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

export default function SharedResourcePage({ params }) {
  const router = useRouter();
  const { token } = params;
  
  const [loading, setLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    validateShareToken();
    checkAuthentication();
  }, [token]);

  async function validateShareToken() {
    try {
      const response = await fetch(`/api/dataroom/share/validate?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setShareInfo(data.share);
      } else {
        setError(data.error || 'Invalid or expired share link');
      }
    } catch (err) {
      setError('Failed to validate share link');
    } finally {
      setLoading(false);
    }
  }

  async function checkAuthentication() {
    try {
      const response = await fetch('/api/dataroom/external-auth/me');
      if (response.ok) {
        setIsAuthenticated(true);
      }
    } catch (err) {
      setIsAuthenticated(false);
    }
  }

  async function handleAccessResource() {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Redirect to the actual resource
    if (shareInfo.resourceType === 'document') {
      router.push(`/dataroom/documents/${shareInfo.resourceId}?shareToken=${token}`);
    } else if (shareInfo.resourceType === 'folder') {
      router.push(`/dataroom/folders/${shareInfo.resourceId}?shareToken=${token}`);
    } else if (shareInfo.resourceType === 'room') {
      router.push(`/dataroom/rooms/${shareInfo.resourceId}?shareToken=${token}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Validating share link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dataroom')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Data Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Shared Resource</h1>
          <p className="text-slate-600">You've been invited to access a shared {shareInfo?.resourceType}</p>
        </div>

        {/* Resource Info */}
        <div className="bg-slate-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{shareInfo?.resourceName}</h2>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-600">
              <Lock className="w-5 h-5" />
              <span className="font-medium">Permissions:</span>
              <div className="flex flex-wrap gap-2">
                {shareInfo?.permissions.map((perm) => (
                  <span key={perm} className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                    {perm}
                  </span>
                ))}
              </div>
            </div>

            {shareInfo?.expiresAt && (
              <div className="flex items-center space-x-2 text-slate-600">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Expires:</span>
                <span>{new Date(shareInfo.expiresAt).toLocaleString()}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 text-slate-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Shared with:</span>
              <span>{shareInfo?.targetEmail}</span>
            </div>
          </div>
        </div>

        {/* Authentication Status */}
        {!isAuthenticated && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium mb-2">Authentication Required</p>
            <p className="text-yellow-700 text-sm">
              You need to sign in or create an account to access this shared resource.
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAccessResource}
          className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg"
        >
          {isAuthenticated ? 'Access Resource' : 'Sign In to Access'}
        </button>

        {/* Auth Modal */}
        {showAuthModal && (
          <ExternalAuthModal
            targetEmail={shareInfo?.targetEmail}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setIsAuthenticated(true);
              setShowAuthModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ExternalAuthModal({ targetEmail, onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    email: targetEmail || '',
    password: '',
    name: '',
    organization: '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' 
        ? '/api/dataroom/external-auth/login'
        : '/api/dataroom/external-auth/register';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Access
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Please explain why you need access..."
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-blue-600 hover:underline text-sm"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
