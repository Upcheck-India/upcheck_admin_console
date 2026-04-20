'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function ExternalLoginPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.push('/dataroom/external/dashboard');
    }
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">External User Portal</h1>
          <p className="text-slate-600">Login for limited access to Upcheck</p>
        </div>

        {/* Clerk SignIn Component */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <SignIn
            routing="path"
            path="/dataroom/external/login"
            signUpUrl="/dataroom/external/register"
            afterSignInUrl="/dataroom/external/dashboard"
            afterSignUpUrl="/dataroom/external/dashboard"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'w-full shadow-none bg-transparent',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'py-3 border-slate-300',
                socialButtonsBlockButtonText: 'font-medium',
                formButtonPrimary: 'py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg',
                footerActionLink: 'hidden',
                identityPreviewEditButton: 'text-blue-600 hover:text-blue-700',
                formFieldLabel: 'text-sm font-medium text-slate-700',
                formFieldInput: 'w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                formFieldErrorText: 'text-red-600 text-sm',
                formFieldSuccessText: 'text-green-600 text-sm',
                footer: 'hidden',
                dividerLine: 'hidden',
                socialButtonsBlockButtonArrow: 'hidden',
              },
            }}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link
            href="/dataroom/auth-gate"
            className="flex items-center justify-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login options
          </Link>
        </div>

        {/* Info */}
        <div className="mt-4 text-center text-sm text-slate-600">
          <p>
            Don't have an account?{' '}
            <Link href="/dataroom/external/register" className="text-blue-600 hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>Your session will remain active for 7 days</p>
          <p className="mt-1">All activity is monitored and logged for security purposes</p>
        </div>
      </div>
    </div>
  );
}
