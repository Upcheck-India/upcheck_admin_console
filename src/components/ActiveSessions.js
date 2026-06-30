'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Laptop, 
  ShieldAlert, 
  LogOut, 
  Loader2, 
  RefreshCw, 
  Mail, 
  ShieldCheck, 
  Globe, 
  MapPin 
} from 'lucide-react';

const deviceIcons = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
  laptop: Laptop,
  unknown: Laptop
};

export default function ActiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [limit, setLimit] = useState(1);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [isUpdatingAlerts, setIsUpdatingAlerts] = useState(false);
  const [isRevoking, setIsRevoking] = useState(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/profile/devices');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions(data.trustedDevices || []);
          setLimit(data.maxConcurrentSessions || 1);
          setEmailAlerts(data.emailAlertsOnNewLogin !== false);
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const updateSessionLimit = async (newLimit) => {
    setIsUpdatingLimit(true);
    try {
      const response = await fetch('/api/profile/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxConcurrentSessions: newLimit })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setLimit(newLimit);
        toast.success(`Concurrent session limit set to ${newLimit === 999 ? 'Unlimited' : newLimit}`);
      } else {
        toast.error(data.error || 'Failed to update concurrent session limit');
      }
    } catch (error) {
      console.error('Error updating limit:', error);
      toast.error('Connection error. Please try again.');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const toggleEmailAlerts = async (val) => {
    setIsUpdatingAlerts(true);
    try {
      const response = await fetch('/api/profile/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAlertsOnNewLogin: val })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setEmailAlerts(val);
        toast.success(val ? 'Email alerts enabled for logins from new devices/locations' : 'New login email alerts disabled');
      } else {
        toast.error(data.error || 'Failed to update notification settings');
      }
    } catch (error) {
      console.error('Error toggling email alerts:', error);
      toast.error('Connection error. Please try again.');
    } finally {
      setIsUpdatingAlerts(false);
    }
  };

  const handleRevoke = async (sessionId) => {
    if (!confirm('Are you sure you want to end this session? The device will be logged out immediately.')) {
      return;
    }
    setIsRevoking(sessionId);
    try {
      const response = await fetch('/api/profile/devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: sessionId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Session terminated successfully');
        fetchSessions();
      } else {
        toast.error(data.error || 'Failed to terminate session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Connection error');
    } finally {
      setIsRevoking(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm('Are you sure you want to log out of all other devices? This will terminate all active sessions except the current one.')) {
      return;
    }
    setIsRevokingOthers(true);
    try {
      const response = await fetch('/api/profile/devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAllOthers: true })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('All other sessions terminated');
        fetchSessions();
      } else {
        toast.error(data.error || 'Failed to revoke other sessions');
      }
    } catch (error) {
      console.error('Error revoking other sessions:', error);
      toast.error('Connection error');
    } finally {
      setIsRevokingOthers(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Loading active sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Section */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-blue-600" />
          Security Manager & Settings
        </h3>

        {/* Concurrent Limits Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            CONCURRENT SESSIONS LIMIT
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { val: 1, label: '1 Session', desc: 'Recommended security' },
              { val: 2, label: '2 Sessions', desc: 'Web + Mobile app' },
              { val: 999, label: 'Unlimited', desc: 'Multiple devices' }
            ].map(opt => (
              <button
                key={opt.val}
                disabled={isUpdatingLimit}
                onClick={() => updateSessionLimit(opt.val)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                  limit === opt.val
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Email Alerts Toggle */}
        <div className="flex items-start justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-slate-500" />
              New Login Email Notifications
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Receive alert emails immediately if someone logs into your account from a new location or unrecognized device.
            </p>
          </div>
          <div className="flex items-center h-5">
            <input
              id="email-alerts"
              type="checkbox"
              disabled={isUpdatingAlerts}
              checked={emailAlerts}
              onChange={(e) => toggleEmailAlerts(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>

      {/* Sessions List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100 flex items-center">
            Active Logged-In Sessions
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Devices that are currently signed into your account.
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeOthers}
            disabled={isRevokingOthers}
            className="self-start sm:self-center inline-flex items-center px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all"
          >
            {isRevokingOthers ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
            ) : (
              <LogOut className="w-3 h-3 mr-1.5" />
            )}
            Log out all other devices
          </button>
        )}
      </div>

      {/* Sessions Grid */}
      <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No active sessions found.
          </div>
        ) : (
          sessions.map((session) => {
            const Icon = deviceIcons[session.deviceType] || Laptop;
            return (
              <div key={session.id} className="p-4 flex items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-950 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                <div className="flex items-start sm:items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${session.isCurrent ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {session.name}
                      </span>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {session.location}
                      </span>
                      <span>•</span>
                      <span className="font-mono">{session.ip}</span>
                      <span>•</span>
                      <span>
                        Active: {formatDistanceToNow(new Date(session.lastUsed))} ago
                      </span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    disabled={isRevoking !== null}
                    onClick={() => handleRevoke(session.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/20"
                    title="Terminate session"
                  >
                    {isRevoking === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
