'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Send, ArrowLeft, FileText } from 'lucide-react';

function RequestAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resourceType = searchParams.get('type') || 'document';
  const resourceId = searchParams.get('id');
  const roomId = searchParams.get('roomId');

  const [formData, setFormData] = useState({ reason: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [resource, setResource] = useState(null);

  useEffect(() => {
    if (resourceId && resourceType === 'document') {
      fetchDocumentInfo();
    } else if (resourceId && resourceType === 'room') {
      fetchRoomInfo();
    }
  }, [resourceId, resourceType]);

  async function fetchDocumentInfo() {
    try {
      const response = await fetch(`/api/dataroom/documents/${resourceId}`);
      if (response.ok) {
        const data = await response.json();
        setResource(data);
      }
    } catch (error) {
      console.error('Failed to fetch document:', error);
    }
  }

  async function fetchRoomInfo() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${resourceId}`);
      if (response.ok) {
        const data = await response.json();
        setResource(data);
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/dataroom/permissions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          roomId: roomId || resourceId,
          reason: formData.reason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to submit access request');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted</h2>
          <p className="text-slate-600 mb-6">
            Your access request has been submitted. You will be notified once it's reviewed by an administrator.
          </p>
          <button
            onClick={() => router.push('/dataroom')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Data Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Request Access</h1>
              <p className="text-sm text-slate-500">Submit a request to access this resource</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          {/* Access Denied Notice */}
          <div className="flex items-start space-x-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
            <Lock className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Access Required</h3>
              <p className="text-sm text-yellow-800">
                You don't have permission to access this {resourceType}. Request access below and an administrator will review your request.
              </p>
            </div>
          </div>

          {/* Resource Info */}
          {resource && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{resource.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{resource.description || 'No description'}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                    <span>Type: {resourceType}</span>
                    {resource.documentType && <span>Category: {resource.documentType}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Request Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for Access <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Please explain why you need access to this resource..."
                rows="5"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Provide a clear business justification for your access request
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.reason.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>{loading ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </div>
          </form>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">What happens next?</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Your request will be sent to the room administrators</li>
              <li>• You'll receive an email notification when your request is reviewed</li>
              <li>• Approved requests grant immediate access</li>
              <li>• All requests are logged for audit purposes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RequestAccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <RequestAccessContent />
    </Suspense>
  );
}
