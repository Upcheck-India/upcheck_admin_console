'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function TestCompleted() {
  useEffect(() => {
    // Exit fullscreen mode if active
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Test Completed
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w-sm mx-auto">
          Thank you for completing the test. Our team will review your submission and get back to you soon.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Please make note of your applicant ID for future reference. You may receive further instructions via the email address you provided.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-center text-sm text-gray-500">
              You can now close this window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}