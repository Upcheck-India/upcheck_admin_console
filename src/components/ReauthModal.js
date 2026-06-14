'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, KeyRound, Fingerprint, Loader2, X, AlertTriangle } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

/**
 * A modal that forces the user to confirm their identity before performing
 * a sensitive action (like adding/removing a passkey or generating backup codes).
 *
 * @param {boolean} isOpen Whether the modal is visible
 * @param {function} onClose Callback when the user cancels/closes the modal
 * @param {function} onSuccess Callback when re-authentication is successfully granted
 * @param {boolean} hasPasskeys Whether the user has at least one passkey registered
 */
export default function ReauthModal({ isOpen, onClose, onSuccess, hasPasskeys }) {
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Verification failed');
      }

      toast.success('Identity verified.');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasskeyAuth = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      // 1. Get step-up authentication options from the server.
      // Unlike login, we don't send a username. The server uses the current session.
      const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body = step-up mode
      });

      const optionsData = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(optionsData.message || optionsData.error || 'Failed to start passkey auth');
      }

      // 2. Pass options to the browser to prompt the user
      let assertion;
      try {
        assertion = await startAuthentication(optionsData);
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Passkey prompt cancelled or no matching passkey found on this device.');
        }
        throw err;
      }

      // 3. Send the assertion back to the dedicated passkey reauth endpoint
      const verifyRes = await fetch('/api/auth/reauth/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: assertion }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData.message || verifyData.error || 'Passkey verification failed');
      }

      toast.success('Identity verified via passkey.');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center space-x-2 text-slate-200">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 id="reauth-title" className="text-lg font-semibold">Security Verification</h2>
          </div>
          <button 
            onClick={onClose}
            disabled={isVerifying}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-300 leading-relaxed text-center">
            You are attempting a sensitive action. Please confirm your identity to continue.
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasPasskeys && (
            <div className="space-y-3">
              <button
                onClick={handlePasskeyAuth}
                disabled={isVerifying}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-white/10 hover:bg-white/15 text-white rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying && password === '' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5" />
                )}
                <span className="font-medium">Use Passkey</span>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-medium uppercase tracking-wider">Or</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reauth-password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="reauth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoFocus
                  disabled={isVerifying}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying && password !== '' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>Verify Password</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
