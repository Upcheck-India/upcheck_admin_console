'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { RecurringMeetingManager } from '../../../components/recurring';

const RecurringMeetingsPage = () => {
  const router = useRouter();
  const [notification, setNotification] = useState(null);

  // Check for success messages from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('created') === 'true') {
      setNotification({ message: 'Recurring meeting series created successfully!', type: 'success' });
      // Clean up URL
      window.history.replaceState({}, '', '/events/recurring');
    }

    // Auto-hide notification after 5 seconds
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleEdit = useCallback((seriesId, type = 'series') => {
    if (type === 'series') {
      router.push(`/events/recurring/${seriesId}/edit`);
    } else {
      router.push(`/events/${seriesId}/edit`);
    }
  }, [router]);

  const handleDelete = useCallback(async (seriesId) => {
    if (!confirm('Are you sure you want to delete this recurring series? This will cancel all future meetings.')) {
      return;
    }

    try {
      const response = await fetch(`/api/events/recurring/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete series');
      }

      showNotification('Recurring series deleted successfully');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    }
  }, []);

  // --- Bug Fix #1.5: handleToggleActive previously sent isActive: undefined when
  // forceActive was null. JSON.stringify strips undefined values so the backend
  // received an empty object and nothing changed — but success toast still showed.
  // Now we always send an explicit boolean.
  const handleToggleActive = useCallback(async (seriesId, currentIsActive, forceActive = null) => {
    try {
      const newIsActive = forceActive !== null ? forceActive : !currentIsActive;
      const response = await fetch(`/api/events/recurring/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: newIsActive
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update series');
      }

      const action = newIsActive ? 'activated' : 'paused';
      showNotification(`Recurring series ${action} successfully`);
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    }
  }, []);

  const handleSendNotification = useCallback(async (seriesId) => {
    try {
      const response = await fetch(`/api/events/recurring/${seriesId}/notify`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }

      showNotification('Series notification sent successfully');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    }
  }, []);

  return (
    <div className="bg-background min-h-screen text-text-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              href="/events"
              className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-blue-500 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Events
            </Link>
          </div>
          
          <Link
            href="/events/recurring/create"
            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Recurring Meeting
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Recurring Meetings</h1>
          <p className="text-text-secondary">Manage your recurring meeting series and individual instances</p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'error' 
              ? 'bg-red-500/10 border-red-500/20 text-red-500' 
              : 'bg-green-500/10 border-green-500/20 text-green-500'
          }`}>
            <div className="flex items-center">
              {notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Recurring Meeting Manager */}
        <div className="bg-surface rounded-xl shadow-sm border border-border-default p-6">
          <RecurringMeetingManager
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
            onSendNotification={handleSendNotification}
          />
        </div>
      </div>
    </div>
  );
};

export default RecurringMeetingsPage;