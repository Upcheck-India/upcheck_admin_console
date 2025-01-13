// src/components/DashboardContentLoader.js
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const DashboardContentLoader = () => {
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const loadingPhases = [
    { message: 'Setting up your workspace...', duration: 1500 },
    { message: 'Loading your profile...', duration: 1200 },
    { message: 'Fetching recent posts...', duration: 1800 },
    { message: 'Preparing dashboard elements...', duration: 1400 },
    { message: 'Almost there...', duration: 1000 }
  ];

  useEffect(() => {
    let timeoutId;
    
    const advancePhase = () => {
      if (loadingPhase < loadingPhases.length - 1) {
        timeoutId = setTimeout(() => {
          setLoadingPhase(prev => prev + 1);
        }, loadingPhases[loadingPhase].duration);
      }
    };

    advancePhase();
    return () => clearTimeout(timeoutId);
  }, [loadingPhase]);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 1;
        return next > 100 ? 0 : next;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="min-h-[60vh] bg-white rounded-lg shadow-md p-8">
      <div className="max-w-2xl mx-auto">
        {/* Loading animation section */}
        <div className="space-y-8">
          {/* Progress indicator */}
          <div className="flex items-center justify-center mb-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>

          {/* Loading message */}
          <div className="text-center">
            <p className="text-gray-600 text-lg font-medium animate-fade-in">
              {loadingPhases[loadingPhase].message}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Loading cards placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3].map((item) => (
              <div 
                key={item} 
                className="bg-gray-50 rounded-lg p-4 space-y-3 animate-pulse"
              >
                <div className="h-32 bg-gray-200 rounded-md" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="flex gap-2 mt-4">
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default DashboardContentLoader;