'use client';

import { useAuth, SignOutButton, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, CheckCircle, LogOut, Clock, User, Mail, AlertTriangle } from 'lucide-react';

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

export default function ExternalUserDashboard() {
  const { isSignedIn, user, isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hasSessionConflict, setHasSessionConflict] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for session conflict (internal admin session vs external Clerk session)
  useEffect(() => {
    if (mounted && isLoaded) {
      const hasAdminToken = getCookie('admin_token');

      if (hasAdminToken && isSignedIn) {
        // Session conflict detected - sign out from Clerk
        setHasSessionConflict(true);
        clerk.signOut({ redirectUrl: '/dataroom/external/login' });
      }
    }
  }, [mounted, isLoaded, isSignedIn, clerk]);

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn && mounted && !hasSessionConflict) {
      router.push('/dataroom/external/login');
    }
  }, [isLoaded, isSignedIn, mounted, hasSessionConflict, router]);

  if (!mounted || !isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSignedIn && !hasSessionConflict) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">External User Portal</h1>
              <p className="text-xs text-slate-500">Limited Access Session</p>
            </div>
          </div>
          <SignOutButton>
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
          {/* Success Banner */}
          <div className="bg-emerald-500 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">You are logged in</h2>
            <p className="text-emerald-100">Your session is active and authorized</p>
          </div>

          {/* User Info */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Session Details</h3>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* User Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Signed in as</p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.emailAddresses?.[0]?.emailAddress || 'User'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Status Card */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Session Status</p>
                    <p className="text-base font-semibold text-emerald-700">Active</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Info List */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Email Address</p>
                  <p className="text-sm text-slate-600">{user?.primaryEmailAddress?.emailAddress || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Session Duration</p>
                  <p className="text-sm text-slate-600">7 days (expires on {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()})</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Access Level</p>
                  <p className="text-sm text-slate-600">External User - Limited Access</p>
                  <p className="text-xs text-slate-500 mt-1">You can only access shared resources and documents you have been granted permission to view.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Exclusivity Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-2">Single Session Policy</h4>
              <p className="text-sm text-amber-800">
                For security reasons, only one session is allowed at a time. If you log in as an internal staff member,
                your external user session will be automatically ended, and vice versa.
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* What You Can Access */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              What You Can Access
            </h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Documents and rooms shared with you</li>
              <li>• Resources granted by Upcheck staff</li>
              <li>• Your profile and session settings</li>
            </ul>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Important Notice
            </h4>
            <ul className="text-sm text-amber-800 space-y-2">
              <li>• Only one session allowed per device</li>
              <li>• All activity is monitored and logged</li>
              <li>• Session expires after 7 days of inactivity</li>
            </ul>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Need help or have questions?{' '}
            <a href="mailto:support@upcheck.in" className="text-blue-600 hover:underline font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
