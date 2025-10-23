'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react';

export default function OAuthSuccessPage() {
  useEffect(() => {
    // Auto-redirect to mail after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = '/mail';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-green-200">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Connection Successful!
          </h1>

          <p className="text-gray-600 mb-6">
            Your Gmail account has been connected successfully. You can now send emails from your personal Gmail account through the Mail page.
          </p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-blue-700">
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">Ready to send emails</span>
            </div>
            <p className="text-blue-600 text-sm mt-1">
              Emails sent from the Mail page will now use your Gmail account.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/mail"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm w-full justify-center"
            >
              <Mail className="w-4 h-4" />
              Go to Mail
              <ArrowRight className="w-4 h-4" />
            </a>

            <p className="text-xs text-gray-500">
              Automatically redirecting in 3 seconds...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
