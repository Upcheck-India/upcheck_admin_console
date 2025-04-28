'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function FullScreenWarning({ warningCount, maxWarnings, onDismiss, onResume }) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mr-3" />
          <h2 className="text-xl font-bold text-gray-900">Full Screen Warning</h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            You have exited full-screen mode. This is a warning. Too many warning will result in your test being revoked.
          </p>
          <p className="text-gray-700 mb-4">
            <strong>Important:</strong> If violated too many times, your test will be automatically revoked and you will not be able to complete it.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-amber-800 text-sm">
              Please return to full-screen mode to continue your test. This warning will close in {countdown} seconds.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Dismiss
          </button>
          <button
            onClick={onResume}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Resume Full Screen
          </button>
        </div>
      </div>
    </div>
  );
}