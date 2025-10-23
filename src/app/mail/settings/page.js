'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Settings, Mail, Link2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield, Clock, ExternalLink, Info } from 'lucide-react';

export default function MailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ connected: false, email: '', lastSync: null });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/mail/oauth/status', { 
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load connection status');
      }
      
      const data = await res.json();
      setStatus({ 
        connected: !!data.connected, 
        email: data.email || '',
        lastSync: data.lastSync || null
      });
    } catch (err) {
      console.error('Status load error:', err);
      setError(err.message || 'Unable to load connection status. Please try again.');
      setStatus({ connected: false, email: '', lastSync: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    
    // Auto-refresh status every 30 seconds if connected
    const interval = setInterval(() => {
      if (status.connected) {
        loadStatus();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadStatus, status.connected]);

  const handleConnect = () => {
    setConnecting(true);
    setError('');
    // Store current URL to return after OAuth
    sessionStorage.setItem('oauth_return_url', window.location.href);
    window.location.href = '/api/mail/oauth/start';
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setError('');
      const res = await fetch('/api/mail/oauth/disconnect', { 
        method: 'POST', 
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to disconnect');
      }
      
      await loadStatus();
      setShowDisconnectConfirm(false);
    } catch (err) {
      console.error('Disconnect error:', err);
      setError(err.message || 'Unable to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setError('');
      const res = await fetch('/api/mail/oauth/test', { 
        method: 'POST',
        credentials: 'include' 
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Connection test failed');
      }
      
      const data = await res.json();
      alert(data.message || 'Connection test successful!');
      await loadStatus();
    } catch (err) {
      console.error('Test error:', err);
      setError(err.message || 'Connection test failed. Please try reconnecting.');
    } finally {
      setTestingConnection(false);
    }
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return null;
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mail Settings</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Manage your email integration and security preferences
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button 
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 transition-colors"
              aria-label="Dismiss error"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main Settings Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Gmail Connection Section */}
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl shadow-lg">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Gmail Integration</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Send emails directly from your Gmail account using secure OAuth 2.0 authentication. 
                  Your credentials are never stored—only encrypted access tokens.
                </p>
              </div>
            </div>

            {/* Status Display */}
            <div className="mt-6 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              {loading ? (
                <div className="flex items-center gap-3 py-2">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">Checking connection status...</span>
                </div>
              ) : status.connected ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-7 h-7 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-semibold text-gray-900">Connected</span>
                        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Active
                        </span>
                      </div>
                      {status.email && (
                        <div className="text-sm text-gray-600 font-medium truncate">{status.email}</div>
                      )}
                      {status.lastSync && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Last verified {formatLastSync(status.lastSync)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions for Connected State */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingConnection ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Test Connection
                        </>
                      )}
                    </button>
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Manage in Google
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Not Connected</p>
                      <p className="text-sm text-gray-600">
                        Connect your Gmail account to start sending emails from your ERP console.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-5 h-5" />
                        Connect Gmail Account
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>You'll be redirected to Google to securely authorize access. We only request permission to send emails on your behalf.</span>
                    </p>
                    <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span>Note: Proceed with 'Visit (Unsafe) warning if prompted, this is merely due to verification delay and completely safe to proceed.'</span>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {status.connected && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-red-600 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Disconnect
                </button>
                <button
                  onClick={loadStatus}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Checking...' : 'Refresh Status'}
                </button>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <a
                href="/mail"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <Mail className="w-4 h-4" />
                Back to Mail
              </a>
            </div>
          </div>

          {/* Security & Privacy Section */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-t border-gray-200">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-3">Security & Privacy</h3>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2"></span>
                    <span>Your Google data usage is strictly limited to sending emails on your behalf</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2"></span>
                    <span>We never read, store, or access your inbox or personal messages</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2"></span>
                    <span>OAuth tokens are encrypted at rest and in transit using industry-standard protocols</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2"></span>
                    <span>You can revoke access at any time from this page or your Google Account settings</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2"></span>
                    <span>All API requests use secure HTTPS connections with certificate pinning</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Disconnect Confirmation Modal */}
        {showDisconnectConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertCircle className="w-7 h-7 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Disconnect Gmail?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    You won't be able to send emails from <strong className="text-gray-900">{status.email}</strong> until you reconnect. 
                    This will revoke our access to your Gmail account.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  disabled={disconnecting}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-200"
                >
                  {disconnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Disconnect
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong className="font-semibold">Note:</strong> This configuration applies only to your personal mail account and will not affect system or admin emails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}