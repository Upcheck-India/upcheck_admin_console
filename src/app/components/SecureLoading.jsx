// src/components/SecureLoading.js
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const SecureLoading = () => {
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  // Generic loading messages that don't reveal system details
  const loadingStates = [
    'Initializing...',
    'Establishing secure connection...',
    'Verifying credentials...',
    'Checking permissions...',
    'Processing request...',
    'Its taking a longer time...',
  ];

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % loadingStates.length;
      setLoadingMessage(loadingStates[currentIndex]);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full mx-4">
        <div className="flex flex-col items-center space-y-6">
          {/* Animated logo placeholder */}
          <div className="w-16 h-16 bg-blue-500 rounded-lg animate-pulse" />
          
          {/* Spinner */}
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          
          {/* Loading message */}
          <div className="text-center space-y-3">
            <p className="text-gray-600 text-sm font-medium">
              {loadingMessage}
            </p>
            
            {/* Loading bar */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full animate-loading-bar" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Add required styles to your global CSS */}
      <style jsx global>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          50% { width: 70%; }
          80% { width: 90%; }
          95% { width: 95%; }
          100% { width: 0%; }
        }
        
        .animate-loading-bar {
          animation: loading-bar 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SecureLoading;