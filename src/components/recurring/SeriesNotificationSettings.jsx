'use client';

import { useState, useEffect } from 'react';
import { Mail, Eye, Clock, Users, Calendar, Settings, AlertCircle } from 'lucide-react';
import { getPatternDescription } from '../../lib/recurrence';

const SeriesNotificationSettings = ({ 
  value = {
    enabled: true,
    timing: 'immediate',
    includeUpcoming: 5,
    customMessage: ''
  },
  onChange,
  recurrencePattern = null,
  meetingTitle = '',
  participants = [],
  error = null
}) => {
  const [settings, setSettings] = useState(value);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    onChange?.(settings);
  }, [settings, onChange]);

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const Toggle = ({ label, name, checked, onChange, description }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <label htmlFor={name} className="text-sm font-medium text-gray-900 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <div className="ml-4">
        <input
          id={name}
          name={name}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
        <div
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer ${
            checked ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
          onClick={() => onChange({ target: { name, checked: !checked, type: 'checkbox' } })}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </div>
      </div>
    </div>
  );

  const generatePreviewEmail = () => {
    const patternDescription = recurrencePattern ? getPatternDescription(recurrencePattern) : 'Weekly on Mondays';
    const upcomingCount = settings.includeUpcoming || 5;
    
    return {
      subject: `Recurring Meeting Series: ${meetingTitle}`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">New Recurring Meeting Series</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to a recurring meeting series</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">${meetingTitle}</h2>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
                <span style="display: inline-block; width: 20px; height: 20px; background: #6366f1; border-radius: 50%; margin-right: 10px;"></span>
                Recurrence Pattern
              </h3>
              <p style="color: #6b7280; margin: 0; font-size: 14px;">${patternDescription}</p>
            </div>

            ${settings.customMessage ? `
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">${settings.customMessage}</p>
            </div>
            ` : ''}

            <div style="margin: 25px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px;">Next ${upcomingCount} Meetings</h3>
              <div style="space-y: 8px;">
                ${Array.from({ length: upcomingCount }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + (i + 1) * 7); // Weekly example
                  return `
                    <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                      <span style="color: #6b7280; font-size: 14px; min-width: 120px;">
                        ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span style="color: #374151; font-size: 14px;">10:00 AM - 11:00 AM</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #166534; margin: 0 0 10px 0; font-size: 16px;">What happens next?</h3>
              <ul style="color: #15803d; margin: 0; padding-left: 20px; font-size: 14px;">
                <li>You'll receive individual calendar invitations for each meeting</li>
                <li>Reminders will be sent before each meeting</li>
                <li>You can manage your participation for the entire series or individual meetings</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                View Series Details
              </a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is a series notification for recurring meetings. You will receive separate calendar invitations for each individual meeting.
              </p>
            </div>
          </div>
        </div>
      `
    };
  };

  const previewEmail = generatePreviewEmail();

  return (
    <div className="space-y-6">
      {/* Enable/Disable Series Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <Toggle
          label="Send Series Notification Email"
          name="enabled"
          checked={settings.enabled}
          onChange={(e) => updateSettings({ enabled: e.target.checked })}
          description="Send an overview email when the recurring series is created"
        />
      </div>

      {settings.enabled && (
        <>
          {/* Timing Options */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center mb-4">
              <Clock className="w-5 h-5 text-indigo-600 mr-2" />
              <h3 className="text-sm font-semibold text-gray-900">Notification Timing</h3>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timing"
                  value="immediate"
                  checked={settings.timing === 'immediate'}
                  onChange={(e) => updateSettings({ timing: e.target.value })}
                  className="mr-3 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Send immediately after series creation</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timing"
                  value="scheduled"
                  checked={settings.timing === 'scheduled'}
                  onChange={(e) => updateSettings({ timing: e.target.value })}
                  className="mr-3 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Send 1 day before first meeting</span>
              </label>
            </div>
          </div>

          {/* Content Options */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center mb-4">
              <Settings className="w-5 h-5 text-indigo-600 mr-2" />
              <h3 className="text-sm font-semibold text-gray-900">Email Content</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of upcoming meetings to show
                </label>
                <select
                  value={settings.includeUpcoming}
                  onChange={(e) => updateSettings({ includeUpcoming: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value={3}>Next 3 meetings</option>
                  <option value={5}>Next 5 meetings</option>
                  <option value={10}>Next 10 meetings</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom message (optional)
                </label>
                <textarea
                  value={settings.customMessage}
                  onChange={(e) => updateSettings({ customMessage: e.target.value })}
                  placeholder="Add a custom message to include in the series notification..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This message will appear in the series notification email
                </p>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Eye className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-sm font-semibold text-gray-900">Email Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {showPreview && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-medium text-gray-700">Subject:</span>
                    <span className="text-gray-900">{previewEmail.subject}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm mt-2">
                    <span className="font-medium text-gray-700">To:</span>
                    <span className="text-gray-900">
                      {participants.length > 0 
                        ? `${participants.slice(0, 2).join(', ')}${participants.length > 2 ? ` +${participants.length - 2} more` : ''}`
                        : 'Meeting participants'
                      }
                    </span>
                  </div>
                </div>

                {/* Email Body Preview */}
                <div 
                  className="p-4 max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewEmail.body }}
                />
              </div>
            )}

            <div className="mt-3 text-xs text-gray-500">
              Preview shows how the series notification email will appear to recipients
            </div>
          </div>

          {/* Participant Info */}
          {participants.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="flex items-center mb-2">
                <Users className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">
                  {participants.length} participant{participants.length !== 1 ? 's' : ''} will receive this notification
                </span>
              </div>
              <p className="text-xs text-blue-700">
                Each participant will also receive individual calendar invitations for each meeting in the series.
              </p>
            </div>
          )}
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default SeriesNotificationSettings;