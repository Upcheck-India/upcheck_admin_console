'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { RecurrencePatternSelector, SeriesNotificationSettings } from '../../../../../components/recurring';

const EditRecurringSeriesPage = () => {
  const router = useRouter();
  const params = useParams();
  const seriesId = params.seriesId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const [seriesData, setSeriesData] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    participants: [],
    teams: [],
  });
  const [recurrencePattern, setRecurrencePattern] = useState(null);
  const [seriesNotificationSettings, setSeriesNotificationSettings] = useState({
    enabled: true,
    sendImmediately: false,
  });

  // Fetch series data
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/events/recurring/${seriesId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch series data');
        }

        const data = await response.json();
        setSeriesData(data);
        
        // Populate form data
        setFormData({
          title: data.title || '',
          description: data.description || '',
          duration: data.duration || 60,
          participants: data.participants || [],
          teams: data.teams || [],
        });
        
        setRecurrencePattern(data.recurrencePattern);
        setSeriesNotificationSettings(data.seriesNotification || {
          enabled: true,
          sendImmediately: false,
        });
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (seriesId) {
      fetchSeries();
    }
  }, [seriesId]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...formData,
        recurrencePattern,
        seriesNotification: seriesNotificationSettings,
      };

      const response = await fetch(`/api/events/recurring/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update series');
      }

      setNotification({ message: 'Series updated successfully!', type: 'success' });
      
      // Redirect back to recurring meetings page after a short delay
      setTimeout(() => {
        router.push('/events/recurring');
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading series data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !seriesData) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Error Loading Series</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/events/recurring"
                className="text-red-600 hover:text-red-700 font-medium"
              >
                ← Back to Recurring Meetings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/events/recurring"
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Recurring Meetings
          </Link>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Recurring Series</h1>
          <p className="text-gray-600">Modify the recurring meeting series settings</p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-green-50 border-green-200 text-green-800'
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

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Series Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Series Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  max="480"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Recurrence Pattern */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recurrence Pattern</h2>
            <RecurrencePatternSelector
              value={recurrencePattern}
              onChange={setRecurrencePattern}
              startDate={seriesData?.startTime ? new Date(seriesData.startTime) : new Date()}
            />
          </div>

          {/* Series Notification Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Series Notification</h2>
            <SeriesNotificationSettings
              value={seriesNotificationSettings}
              onChange={setSeriesNotificationSettings}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRecurringSeriesPage;