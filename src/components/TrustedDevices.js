'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  Loader2, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Monitor, 
  AlertTriangle, 
  X, 
  Info,
  MapPin,
  Clock,
  Fingerprint,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  MonitorSmartphone
} from 'lucide-react';

const deviceIcons = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
  laptop: Laptop,
  unknown: Laptop
};

const deviceTypeMap = {
  mobile: 'Mobile Device',
  desktop: 'Desktop Computer',
  tablet: 'Tablet',
  laptop: 'Laptop',
  unknown: 'Unknown Device'
};

export default function TrustedDevices() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);
  const [biometricError, setBiometricError] = useState(null);
  const [biometricDevices, setBiometricDevices] = useState([]);
  const [currentDeviceInfo, setCurrentDeviceInfo] = useState(null);
  const [isCurrentDeviceTrusted, setIsCurrentDeviceTrusted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeviceDetails, setShowDeviceDetails] = useState({});

  // Enhanced device detection with more details
  const getDeviceInfo = useCallback(() => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let deviceType = 'unknown';
    let deviceName = 'Unknown Device';
    
    // More precise device detection
    const isWindows = /(Win32|Win64|Windows|WinCE)/i.test(platform);
    const isMac = /(Macintosh|MacIntel|MacPPC|Mac68K)/i.test(platform);
    const isLinux = /(X11|Linux)/i.test(platform);
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /(iPad|iPhone|iPod)/i.test(userAgent);
    const isTablet = /(iPad|tablet|playbook|silk)|(android(?!.*mobi))/i.test(userAgent);
    const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent);

    if (isTablet) {
      deviceType = 'tablet';
      if (isIOS) deviceName = 'iPad';
      else if (isAndroid) deviceName = 'Android Tablet';
      else deviceName = 'Tablet';
    } else if (isMobile) {
      deviceType = 'mobile';
      if (/iPhone/i.test(userAgent)) deviceName = 'iPhone';
      else if (isAndroid) deviceName = 'Android Phone';
      else deviceName = 'Mobile Device';
    } else if (isMac) {
      deviceType = 'laptop';
      deviceName = 'Mac';
    } else if (isWindows) {
      deviceType = 'desktop';
      // More specific Windows version detection
      if (/Windows NT 10.0/i.test(userAgent)) deviceName = 'Windows 10/11';
      else if (/Windows NT 6.3/i.test(userAgent)) deviceName = 'Windows 8.1';
      else if (/Windows NT 6.2/i.test(userAgent)) deviceName = 'Windows 8';
      else if (/Windows NT 6.1/i.test(userAgent)) deviceName = 'Windows 7';
      else deviceName = 'Windows PC';
    } else if (isLinux) {
      deviceType = 'desktop';
      // Try to detect common Linux distributions
      if (/Ubuntu/i.test(userAgent)) deviceName = 'Ubuntu';
      else if (/Fedora/i.test(userAgent)) deviceName = 'Fedora';
      else if (/Debian/i.test(userAgent)) deviceName = 'Debian';
      else if (/CentOS/i.test(userAgent)) deviceName = 'CentOS';
      else if (/Arch/i.test(userAgent)) deviceName = 'Arch Linux';
      else deviceName = 'Linux PC';
    }
    
    // Enhanced browser detection with version
    let browser = 'Unknown';
    let browserVersion = '';
    let match;
    
    // Check for Edge first (since it includes Chrome in its user agent)
    if ((match = userAgent.match(/Edg\/(\d+\.\d+)/i))) {
      browser = 'Microsoft Edge';
      browserVersion = match[1];
    }
    // Check for other Chromium-based browsers
    else if ((match = userAgent.match(/(OPR|Brave|Vivaldi|Yandex|DuckDuckGo|SamsungBrowser)\/(\d+\.\d+)/i))) {
      const browserMap = {
        'OPR': 'Opera',
        'Brave': 'Brave',
        'Vivaldi': 'Vivaldi',
        'Yandex': 'Yandex',
        'DuckDuckGo': 'DuckDuckGo',
        'SamsungBrowser': 'Samsung Internet'
      };
      browser = browserMap[match[1]] || 'Chromium-based Browser';
      browserVersion = match[2];
    }
    // Check for Chrome (must come after other Chromium-based browsers)
    else if ((match = userAgent.match(/(?:Chrome|CriOS)\/(\d+\.\d+)/i))) {
      browser = userAgent.includes('CriOS') ? 'Chrome (iOS)' : 'Chrome';
      browserVersion = match[1];
    }
    // Firefox
    else if ((match = userAgent.match(/Firefox\/(\d+\.\d+)/i))) {
      browser = 'Firefox';
      browserVersion = match[1];
    }
    // Safari (must come after Chrome check)
    else if ((match = userAgent.match(/Version\/(\d+\.\d+).*Safari\//i))) {
      browser = 'Safari';
      browserVersion = match[1];
    }
    
    // Add version to browser string if available
    if (browserVersion) {
      browser = `${browser} ${browserVersion}`;
    }
    
    // Get more detailed platform information
    const platformInfo = {
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      logicalProcessors: navigator.hardwareConcurrency || 'Unknown',
      deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
      screenColorDepth: `${window.screen.colorDepth}-bit`,
      pixelRatio: window.devicePixelRatio || 1,
      timezoneOffset: new Date().getTimezoneOffset() / -60, // in hours
      doNotTrack: navigator.doNotTrack === '1' || navigator.msDoNotTrack === '1',
      cookiesEnabled: navigator.cookieEnabled,
      pdfViewerEnabled: window.navigator.pdfViewerEnabled || false,
      webGLVendor: (() => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';
          }
        } catch (e) {}
        return 'Unknown';
      })()
    };

    return {
      type: deviceType,
      name: deviceName,
      browser: `${browser} (${navigator.platform})`,
      platform: `${platform}${navigator.userAgentData ? ` (${navigator.userAgentData.platform})` : ''}`,
      language: navigator.languages ? navigator.languages.join(', ') : navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height} (${window.innerWidth}x${window.innerHeight} viewport)`,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      cpuCores: navigator.hardwareConcurrency || 'Unknown',
      deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
      userAgent: navigator.userAgent,
      ...platformInfo,
      // Add a more friendly display name
      displayName: `${browser} on ${deviceName} (${screen.width}x${screen.height})`,
      // Add a unique fingerprint for the device (not cryptographically secure, just for display)
      fingerprint: (() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText(browser, 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText(deviceName, 4, 17);
        return canvas.toDataURL().slice(-16, -4);
      })()
    };
  }, []);

  // Enhanced device fingerprinting
  const generateDeviceFingerprint = useCallback(async () => {
    try {
      // Try to load FingerprintJS Pro first, then fallback to free version
      let FingerprintJS;
      try {
        FingerprintJS = await import('@fingerprintjs/fingerprintjs-pro');
      } catch {
        FingerprintJS = await import('@fingerprintjs/fingerprintjs');
      }
      
      const fp = await FingerprintJS.load({
        monitoring: false,
        debug: process.env.NODE_ENV === 'development',
      });
      
      const result = await fp.get({
        extendedResult: true,
      });
      
      return result.visitorId;
    } catch (error) {
      console.warn('FingerprintJS failed, using fallback method:', error);
      
      // Enhanced fallback fingerprinting
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        navigator.hardwareConcurrency,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.cookieEnabled,
        navigator.doNotTrack,
        navigator.maxTouchPoints || 0
      ].join('|');
      
      // Create hash of the fingerprint
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }, []);

  // Check if WebAuthn is available
  useEffect(() => {
    const checkBiometricSupport = async () => {
      try {
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsBiometricAvailable(isAvailable);
      } catch (error) {
        console.error('Error checking WebAuthn support:', error);
        setIsBiometricAvailable(false);
      }
    };
    
    checkBiometricSupport();
  }, []);

  // Fetch biometric devices
  const fetchBiometricDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/webauthn/devices', {
        credentials: 'include', // Include credentials for auth
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Fetched biometric devices:', data.devices);
        setBiometricDevices(data.devices || []);
      } else {
        console.error('Failed to fetch biometric devices:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error || 'Unknown error'
        });
        setBiometricDevices([]);
        toast.error('Failed to load biometric devices');
      }
    } catch (error) {
      console.error('Error fetching biometric devices:', error);
      setBiometricDevices([]);
      toast.error('Error loading biometric devices');
    }
  }, []);

  // Register a new biometric device
  const registerBiometricDevice = async () => {
    if (!deviceName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    try {
      setIsRegisteringBiometric(true);
      setBiometricError(null);

      // Get registration options from server
      console.log('Fetching WebAuthn registration options...');
      const optionsResponse = await fetch('/api/auth/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!optionsResponse.ok) {
        let errorDetails = 'Unknown error';
        try {
          const errorData = await optionsResponse.json();
          errorDetails = errorData.message || JSON.stringify(errorData);
        } catch (e) {
          errorDetails = optionsResponse.statusText;
        }
        console.error('Failed to get registration options:', {
          status: optionsResponse.status,
          statusText: optionsResponse.statusText,
          details: errorDetails
        });
        throw new Error(`Failed to get registration options: ${errorDetails}`);
      }

      const options = await optionsResponse.json();
      console.log('Received registration options:', {
        rp: options.rp,
        user: {
          ...options.user,
          id: options.user?.id ? `${options.user.id.substring(0, 10)}...` : 'undefined'
        },
        challenge: options.challenge ? `${options.challenge.substring(0, 10)}...` : 'undefined',
        pubKeyCredParams: options.pubKeyCredParams?.length
      });
      
      // Convert base64url to Uint8Array
      const base64URLToUint8Array = (base64URL) => {
        const padding = '='.repeat((4 - base64URL.length % 4) % 4);
        const base64 = base64URL.replace(/\-/g, '+').replace(/_/g, '/') + padding;
        const rawData = atob(base64);
        const output = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
          output[i] = rawData.charCodeAt(i);
        }
        return output;
      };
      
      options.challenge = base64URLToUint8Array(options.challenge);
      options.user.id = base64URLToUint8Array(options.user.id);
      
      // Ensure proper types for WebAuthn API
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(cred => ({
          ...cred,
          id: base64URLToUint8Array(cred.id)
        }));
      }

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: options
      });

      // Helper function to convert ArrayBuffer to Base64URL
      const bufferToBase64URL = (buffer) => {
        const bytes = new Uint8Array(buffer);
        return btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      };

      // Prepare credential data for the server
      const credentialData = {
        id: credential.id,
        rawId: bufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64URL(credential.response.attestationObject),
          clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
          // Include transports if available
          transports: credential.response.getTransports ? credential.response.getTransports() : []
        },
        deviceName: deviceName,
        deviceType: 'biometric'
      };
      
      console.log('Sending credential data to server:', {
        ...credentialData,
        response: {
          ...credentialData.response,
          // Don't log the full attestation object
          attestationObject: credentialData.response.attestationObject ? 
            credentialData.response.attestationObject.substring(0, 30) + '...' : null
        }
      });

      // Verify the credential with the server
      const verifyResponse = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialData })
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        const error = new Error(errorData.message || 'Failed to verify registration');
        error.type = errorData.type || 'verification_failed';
        error.details = errorData.details || {};
        throw error;
      }

      toast.success('Biometric authentication registered successfully');
      setDeviceName('');
      setIsAdding(false);
      fetchDevices();
      fetchBiometricDevices();
    } catch (error) {
      console.error('Error in biometric device registration:', {
        name: error.name,
        message: error.message,
        type: error.type,
        details: error.details,
        stack: error.stack
      });
      
      // Set user-friendly error message based on error type
      let errorMessage = 'Failed to register biometric authentication';
      let showOriginalError = false;
      
      if (error.message.includes('Failed to get registration options')) {
        errorMessage = 'Failed to start registration process. Please try again.';
      } else if (error.message.includes('challenge') || error.type === 'challenge_mismatch') {
        errorMessage = 'Session expired. Please try the registration again.';
      } else if (error.message.includes('NotAllowedError') || error.type === 'invalid_data') {
        errorMessage = 'Registration was cancelled or timed out. Please try again.';
      } else if (error.type === 'verification_failed') {
        errorMessage = 'Verification failed. The security challenge did not match.';
      } else {
        // For other errors, show the original message in development
        errorMessage = process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'An error occurred during registration. Please try again.';
        showOriginalError = true;
      }
      
      setBiometricError(errorMessage);
      toast.error(showOriginalError ? error.message : errorMessage);
    } finally {
      setIsRegisteringBiometric(false);
    }
  };

  // Remove a biometric device
  const removeBiometricDevice = async (credentialId) => {
    if (!credentialId) {
      console.error('No credential ID provided for removal');
      toast.error('Cannot remove device: Missing device identifier');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this biometric device? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('Removing biometric device with ID:', credentialId);
      const response = await fetch(`/api/auth/webauthn/devices/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove device');
      }

      console.log('Successfully removed device:', result);
      toast.success('Biometric device removed successfully');
      
      // Refresh the list of devices
      await fetchBiometricDevices();
    } catch (error) {
      console.error('Error removing biometric device:', {
        error,
        credentialId,
        message: error.message,
        stack: error.stack
      });
      toast.error(`Failed to remove device: ${error.message || 'Unknown error'}`);
    }
  };

  // Fetch trusted devices with enhanced error handling
  const fetchDevices = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      
      const response = await fetch('/api/profile/devices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch devices');
      }
      
      const data = await response.json();
      
      const currentId = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      
      setCurrentDeviceId(currentId);
      setCurrentDeviceInfo(deviceInfo);
      
      const isTrusted = data.devices.some(device => device.id === currentId);
      setIsCurrentDeviceTrusted(isTrusted);
      
      // Sort devices by last used date
      const sortedDevices = (data.devices || []).sort((a, b) => 
        new Date(b.lastUsed || b.addedAt) - new Date(a.lastUsed || a.addedAt)
      );
      
      setDevices(sortedDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error(error.message || 'Failed to load trusted devices');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [generateDeviceFingerprint, getDeviceInfo]);

  // Add current device with enhanced validation
  const addCurrentDevice = useCallback(async () => {
    if (!deviceName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    if (deviceName.trim().length < 2) {
      toast.error('Device name must be at least 2 characters');
      return;
    }

    if (deviceName.trim().length > 50) {
      toast.error('Device name must be less than 50 characters');
      return;
    }

    try {
      setIsAdding(true);
      const deviceId = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      
      const response = await fetch('/api/profile/devices', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          deviceId,
          deviceName: deviceName.trim(),
          deviceType: deviceInfo.type,
          deviceInfo: {
            browser: deviceInfo.browser,
            platform: deviceInfo.platform,
            language: deviceInfo.language,
            timezone: deviceInfo.timezone,
            screenResolution: deviceInfo.screenResolution,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add device');
      }
      
      await fetchDevices(false);
      setDeviceName('');
      setShowAddModal(false);
      toast.success('Device added successfully');
    } catch (error) {
      console.error('Error adding device:', error);
      toast.error(error.message || 'Failed to add device');
    } finally {
      setIsAdding(false);
    }
  }, [deviceName, generateDeviceFingerprint, getDeviceInfo, fetchDevices]);

  // Remove device with confirmation
  const removeDevice = useCallback(async (deviceId, deviceName) => {
    if (!confirm(`Are you sure you want to remove "${deviceName}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/profile/devices', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ deviceId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to remove device');
      }
      
      await fetchDevices(false);
      toast.success('Device removed successfully');
    } catch (error) {
      console.error('Error removing device:', error);
      toast.error(error.message || 'Failed to remove device');
    }
  }, [fetchDevices]);

  // Refresh devices
  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    await fetchDevices(false);
    setIsRefreshing(false);
    toast.success('Devices refreshed');
  }, [fetchDevices]);

  // Toggle device details
  const toggleDeviceDetails = useCallback((deviceId) => {
    setShowDeviceDetails(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Auto-suggest device name based on current device
  useEffect(() => {
    if (currentDeviceInfo && !deviceName) {
      const suggestedName = `${currentDeviceInfo.name} (${currentDeviceInfo.browser})`;
      setDeviceName(suggestedName);
    }
  }, [currentDeviceInfo, deviceName]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading trusted devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Trusted Devices</h2>
              <p className="text-sm text-gray-600">
                Manage devices that can access your account securely
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInfo(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Learn more about trusted devices"
            >
              <Info className="h-5 w-5" />
            </button>
            <button
              onClick={refreshDevices}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh devices"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Current Device Status */}
      {currentDeviceInfo && (
        <div className={`border rounded-xl p-6 ${isCurrentDeviceTrusted 
          ? 'bg-green-50 border-green-200' 
          : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isCurrentDeviceTrusted 
                ? 'bg-green-100 text-green-600' 
                : 'bg-amber-100 text-amber-600'
              }`}>
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Current Device: {currentDeviceInfo.name}
                </h3>
                <p className={`text-sm ${isCurrentDeviceTrusted 
                  ? 'text-green-700' 
                  : 'text-amber-700'
                }`}>
                  {isCurrentDeviceTrusted 
                    ? 'This device is trusted and recognized' 
                    : 'This device is not yet trusted'
                  }
                </p>
              </div>
            </div>
            {!isCurrentDeviceTrusted && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Trust This Device
              </button>
            )}
          </div>
        </div>
      )}

      {/* Biometric Authentication Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium flex items-center text-gray-900">
            <Fingerprint className="w-5 h-5 mr-2 text-blue-600" />
            Biometric Authentication
          </h3>
          {isBiometricAvailable ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Available
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <XCircle className="w-3 h-3 mr-1" />
              Not Available
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Secure your account with biometric authentication using your device's fingerprint sensor.
          This allows you to log in without entering your password.
        </p>
        
        {biometricError && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-md">
            {biometricError}
          </div>
        )}

        {isAdding ? (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
                Device Name
              </label>
              <input
                type="text"
                id="deviceName"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="e.g., John's iPhone"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={registerBiometricDevice}
                disabled={isRegisteringBiometric || !deviceName.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isRegisteringBiometric ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Fingerprint className="-ml-1 mr-2 h-4 w-4" />
                    Register Biometric
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  setIsAdding(false);
                  setBiometricError(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Registered Biometric Devices</h4>
            
            {biometricDevices.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {biometricDevices.map((device) => {
                  const addedDate = new Date(device.addedAt);
                  const lastUsedDate = device.lastUsed ? new Date(device.lastUsed) : null;
                  
                  return (
                    <li key={device.id || device.credentialID} className="py-3 flex justify-between items-center">
                      <div className="flex items-center">
                        <MonitorSmartphone className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {device.deviceName || 'Biometric Device'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Added {formatDistanceToNow(addedDate, { addSuffix: true })}
                            {lastUsedDate && (
                              <span className="ml-2">
                                • Last used {formatDistanceToNow(lastUsedDate, { addSuffix: true })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {device.transports && device.transports.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {device.transports.join(', ')}
                          </span>
                        )}
                        <button
                          onClick={() => removeBiometricDevice(device.credentialID || device.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          title="Remove device"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-4 text-sm text-gray-500">
                No biometric devices registered yet.
              </div>
            )}
            
            {isBiometricAvailable && !isAdding && (
              <div className="mt-4">
                <button
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Biometric Device
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Devices List */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl">
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-3 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trusted devices</h3>
            <p className="text-gray-600 mb-6">
              Add your current device to get started with trusted device management.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add This Device
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {devices.map((device) => {
              const DeviceIcon = deviceIcons[device.deviceType] || deviceIcons.unknown;
              const isCurrentDevice = device.id === currentDeviceId;
              const showDetails = showDeviceDetails[device.id];
              
              return (
                <div key={device.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`p-3 rounded-lg ${isCurrentDevice 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        <DeviceIcon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h4 className="font-medium text-gray-900">{device.name}</h4>
                          {isCurrentDevice && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Current Device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Fingerprint className="h-4 w-4 mr-1" />
                            {deviceTypeMap[device.deviceType] || 'Unknown Device'}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Added {formatDistanceToNow(new Date(device.addedAt), { addSuffix: true })}
                          </span>
                          {device.lastUsed && (
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Last used {formatDistanceToNow(new Date(device.lastUsed), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleDeviceDetails(device.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View device details"
                      >
                        {showDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => removeDevice(device.id, device.name)}
                        disabled={isCurrentDevice && devices.length === 1}
                        className={`p-2 rounded-lg transition-colors ${
                          isCurrentDevice && devices.length === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={isCurrentDevice && devices.length === 1 
                          ? 'Cannot remove your only trusted device' 
                          : 'Remove device'
                        }
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Device Details */}
                  {showDetails && device.deviceInfo && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-3">Device Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {device.deviceInfo.browser && (
                          <div>
                            <span className="text-gray-600">Browser:</span>
                            <span className="ml-2 text-gray-900">{device.deviceInfo.browser}</span>
                          </div>
                        )}
                        {device.deviceInfo.platform && (
                          <div>
                            <span className="text-gray-600">Platform:</span>
                            <span className="ml-2 text-gray-900">{device.deviceInfo.platform}</span>
                          </div>
                        )}
                        {device.deviceInfo.language && (
                          <div>
                            <span className="text-gray-600">Language:</span>
                            <span className="ml-2 text-gray-900">{device.deviceInfo.language}</span>
                          </div>
                        )}
                        {device.deviceInfo.timezone && (
                          <div>
                            <span className="text-gray-600">Timezone:</span>
                            <span className="ml-2 text-gray-900">{device.deviceInfo.timezone}</span>
                          </div>
                        )}
                        {device.deviceInfo.screenResolution && (
                          <div>
                            <span className="text-gray-600">Screen:</span>
                            <span className="ml-2 text-gray-900">{device.deviceInfo.screenResolution}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Device ID:</span>
                          <span className="ml-2 text-gray-900 font-mono text-xs">
                            {device.id.substring(0, 4)}xxxxxxxxxxxxxxxx
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowAddModal(false)}></div>
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Add This Device</h3>
                    <p className="text-sm text-gray-600">Make this device trusted for easier access</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Device Name
                  </label>
                  <input
                    type="text"
                    id="device-name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter a name for this device"
                    onKeyDown={(e) => e.key === 'Enter' && addCurrentDevice()}
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Choose a name that helps you identify this device later
                  </p>
                </div>

                {currentDeviceInfo && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-2 text-blue-500" />
                      Device Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-start">
                          <Monitor className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Device</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {currentDeviceInfo?.name || 'Unknown'}
                              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                                {currentDeviceInfo?.type || 'Unknown'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Browser</p>
                            <p className="text-gray-600 dark:text-gray-400">{currentDeviceInfo?.browser || 'Unknown'}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Platform</p>
                            <p className="text-gray-600 dark:text-gray-400">{currentDeviceInfo?.platform || 'Unknown'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start">
                          <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Resolution</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {currentDeviceInfo?.screenResolution || 'Unknown'}
                              {currentDeviceInfo?.pixelRatio && ` (${currentDeviceInfo.pixelRatio}x)`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Timezone</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {currentDeviceInfo?.timezone || 'Unknown'}
                              {currentDeviceInfo?.timezoneOffset && ` (UTC${currentDeviceInfo.timezoneOffset >= 0 ? '+' : ''}${currentDeviceInfo.timezoneOffset})`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6H5m2 6H5M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">System</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {currentDeviceInfo?.cpuCores && `${currentDeviceInfo.cpuCores} cores`}
                              {currentDeviceInfo?.deviceMemory && ` • ${currentDeviceInfo.deviceMemory} RAM`}
                              {currentDeviceInfo?.colorDepth && ` • ${currentDeviceInfo.colorDepth}-bit`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {currentDeviceInfo?.isTouchDevice && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Touch device detected
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-amber-900">Security Notice</h4>
                      <p className="text-sm text-amber-800 mt-1">
                        Only add devices you personally own and use regularly. 
                        This device will be able to access your account more easily.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  onClick={addCurrentDevice}
                  disabled={isAdding || !deviceName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAdding ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </span>
                  ) : (
                    'Add Device'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowInfo(false)}></div>
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Info className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">About Trusted Devices</h3>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">How It Works</h4>
                  <p>
                    Trusted devices use advanced fingerprinting technology to create a unique identifier 
                    for each device. This allows you to stay logged in on devices you use regularly.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Benefits</h4>
                  <ul className="space-y-1 text-green-800">
                    <li>• Faster access to your account</li>
                    <li>• Reduced need for repeated authentication</li>
                    <li>• Better security than simple "remember me" cookies</li>
                    <li>• Device-specific access tracking</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-2">Security Guidelines</h4>
                  <ul className="space-y-1 text-amber-800">
                    <li>• Only add devices you personally own</li>
                    <li>• Remove devices you no longer use</li>
                    <li>• Avoid adding public or shared computers</li>
                    <li>• Review your trusted devices regularly</li>
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Technical Details</h4>
                  <p className="text-gray-600">
                    We use browser fingerprinting and device characteristics to create unique identifiers. 
                    This information is stored securely and used only for device recognition purposes.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowInfo(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Got it, thanks!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}