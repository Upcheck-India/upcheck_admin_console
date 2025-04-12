'use client';
import { AlertCircle, CodeXml } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UnauthorizedAccess() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-6">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
        <div className="space-y-4 text-sm text-gray-600">
          <p className="flex items-center">
            <CodeXml className="h-4 w-4 mr-2" />
            Please contact the admin if you think this is a mistake.
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={() => router.push('/console')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
