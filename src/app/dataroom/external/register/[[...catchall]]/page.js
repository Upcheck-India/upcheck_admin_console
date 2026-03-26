'use client';

import { SignUp, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function ExternalRegisterPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.push('/dataroom/external/dashboard');
    }
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create External User Account</h1>
          <p className="text-slate-600">Register for limited access to Upcheck</p>
        </div>

        {/* Clerk SignUp Component */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <SignUp
            routing="path"
            path="/dataroom/external/register"
            signInUrl="/dataroom/external/login"
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
                badge: 'hidden',
                header: 'hidden',
              },
            }}
          />
        </div>

        <div className="mt-4 text-center text-sm text-slate-600">
          <p>
            Already have an account?{' '}
            <Link href="/dataroom/external/login" className="text-blue-600 hover:underline font-medium">
              Login here
            </Link>
          </p>
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

        {/* Security Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Security Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Your session will remain active for 7 days for security purposes</li>
            <li>• All activity is monitored and logged</li>
            <li>• You can only access documents and rooms you have been granted permission to</li>
            <li>• Unauthorized access attempts will be blocked and reported</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
