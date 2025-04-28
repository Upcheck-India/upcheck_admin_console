import { useState, useEffect, useCallback, useRef } from 'react';

export default function useTestFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const maxWarnings = 5;
  const warningTimeoutRef = useRef(null);

  // Check if browser is in fullscreen mode
  useEffect(() => {
    const handleFullScreenChange = () => {
      const fullScreenElement = 
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      
      setIsFullScreen(!!fullScreenElement);
      
      // If exited fullscreen without using our exit function, show warning
      if (!fullScreenElement && warningCount < maxWarnings) {
        setShowWarning(true);
        setWarningCount(prev => prev + 1);
        
        // Clear any existing timeout
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current);
        }
        
        // Auto-hide warning after 10 seconds
        warningTimeoutRef.current = setTimeout(() => {
          setShowWarning(false);
        }, 10000);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
      
      // Clear timeout on unmount
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [warningCount]);

  // Enter fullscreen mode
  const enterFullScreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setShowWarning(false);
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  }, []);

  // Exit fullscreen mode
  const exitFullScreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  }, []);

  // Reset warning count
  const resetWarningCount = useCallback(() => {
    setWarningCount(0);
  }, []);

  // Dismiss warning
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
  }, []);

  return { 
    isFullScreen, 
    enterFullScreen, 
    exitFullScreen, 
    warningCount, 
    showWarning, 
    dismissWarning,
    resetWarningCount,
    isRevoked: warningCount >= maxWarnings 
  };
}