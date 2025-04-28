'use client';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function TestRevoked() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">Test Revoked</h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Your test has been automatically revoked because you exited full-screen mode too many times.
          </p>
          <p className="text-gray-700 mb-4">
            This is a security measure to ensure the integrity of the testing process.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">
              Please contact the recruitment team if you believe this was an error or if you would like to request another opportunity to take the test.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Link 
            href="/recruitment"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}