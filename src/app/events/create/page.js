'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeft, Video, Users, Calendar, Clock, Settings, Mail, AlertCircle, Check, ExternalLink, Repeat } from 'lucide-react';
import { RecurrencePatternSelector, SeriesNotificationSettings } from '../../../components/recurring';

const InputField = memo(({ label, name, type = 'text', value, onChange, required = false, error, ...props }) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-semibold text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {type === 'textarea' ? (
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={`block w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        {...props}
      />
    ) : (
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={`block w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        {...props}
      />
    )}
    {error && (
      <div className="flex items-center mt-1 text-sm text-red-600">
        <AlertCircle className="w-4 h-4 mr-1" />
        {error}
      </div>
    )}
  </div>
));

const CreateEventPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null,
    duration: '60',
    sendNotification: true,
    trackOpens: false,
    trackClicks: false,
    trackAck: false,
    inviteUpcheckBot: false,
    useInterstitialJoin: true,
    redirectDelay: 5,
    includeDirectMeetingLink: true,
    isRecurring: false,
  });
  const [recurrencePattern, setRecurrencePattern] = useState(null);
  const [seriesNotificationSettings, setSeriesNotificationSettings] = useState({
    enabled: true,
    sendImmediately: true,
  });
  const [zoomSettings, setZoomSettings] = useState({
    waiting_room: true,
    host_video: false,
    participant_video: false,
    mute_upon_entry: true,
    join_before_host: false,
    jbh_time: 5,
    auto_recording: 'none',
    allow_multiple_devices: true,
    meeting_authentication: true,
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [provider, setProvider] = useState('zoom');
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch('/api/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data.map(user => ({ value: user.email, label: `${user.username} (${user.email})` })));
      } catch (err) {
        setError('Could not load users. Please try again later.');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Validation function that doesn't cause re-renders
  const validateField = useCallback((name, value) => {
    switch (name) {
      case 'title':
        if (!value?.trim()) return 'Meeting title is required';
        if (value.length > 100) return 'Title must be less than 100 characters';
        return null;
      case 'description':
        if (!value?.trim()) return 'Meeting description is required';
        if (value.length > 500) return 'Description must be less than 500 characters';
        return null;
      case 'startTime':
        if (!value) return 'Start time is required';
        if (new Date(value) < new Date()) return 'Start time must be in the future';
        return null;
      case 'duration':
        if (!value || parseInt(value) < 1) return 'Duration must be at least 1 minute';
        if (parseInt(value) > 480) return 'Duration cannot exceed 8 hours';
        return null;
      default:
        return null;
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({ ...prev, [name]: newValue }));

    // Clear any existing error for this field when user starts typing
    setFieldErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleDateChange = useCallback((date) => {
    setFormData(prev => ({ ...prev, startTime: date }));

    // Clear any existing error for startTime when user selects a date
    setFieldErrors(prev => {
      if (prev.startTime) {
        const newErrors = { ...prev };
        delete newErrors.startTime;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleZoomSettingChange = useCallback((e) => {
    const { name, checked } = e.target;
    setZoomSettings(prev => ({ ...prev, [name]: checked }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields and collect errors
    const newErrors = {};
    const fieldsToValidate = ['title', 'description', 'startTime', 'duration'];

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    if (provider === 'google_meet') {
      const isValidMeet = typeof joinUrl === 'string' && /^https?:\/\//i.test(joinUrl) && joinUrl.includes('meet.google.com');
      if (!isValidMeet) {
        newErrors.joinUrl = 'Please provide a valid Google Meet link (https://meet.google.com/...)';
      }
    }

    if (selectedParticipants.length === 0) {
      newErrors.participants = 'Please select at least one participant.';
    }

    // Validate recurring pattern if recurring is enabled
    if (formData.isRecurring && !recurrencePattern) {
      newErrors.recurrencePattern = 'Please configure the recurrence pattern.';
    }

    // Update field errors state
    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setError('Please fix the errors above before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        zoomSettings,
        participants: selectedParticipants.map(p => p.value),
        provider,
        ...(provider === 'google_meet' ? { joinUrl } : {}),
      };

      // Choose API endpoint based on recurring or single meeting
      const apiEndpoint = formData.isRecurring ? '/api/events/recurring' : '/api/events';
      
      // Add recurring-specific data if needed
      if (formData.isRecurring) {
        payload.recurrencePattern = recurrencePattern;
        payload.seriesNotification = seriesNotificationSettings;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      const successParam = formData.isRecurring ? 'recurring_created=true' : 'created=true';
      router.push(`/events?${successParam}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: fieldErrors.participants ? '#ef4444' : state.isFocused ? '#6366f1' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#6366f1' : '#9ca3af',
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#e0e7ff',
      color: '#3730a3',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#3730a3',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#6366f1',
      '&:hover': {
        backgroundColor: '#c7d2fe',
        color: '#4338ca',
      },
    }),
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
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer ${checked ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          onClick={() => onChange({ target: { name, checked: !checked, type: 'checkbox' } })}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </div>
      </div>
    </div>
  );

  // InputField component is now defined at the top of the file

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/events')}
          className="inline-flex items-center mb-8 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Schedule a New Meeting</h1>
          <p className="text-gray-600">Create and configure your meeting. Choose Zoom or Google Meet as provider.</p>
        </div>

        {/* Provider Selection */}
        <div className="mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setProvider('zoom')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${provider === 'zoom' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Zoom
            </button>
            <button
              type="button"
              onClick={() => setProvider('google_meet')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${provider === 'google_meet' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Google Meet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meeting Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Video className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Meeting Details</h2>
              </div>
              <div className="space-y-6">
                <InputField
                  label="Meeting Title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter meeting title"
                  required
                  error={fieldErrors.title}
                />
                <InputField
                  label="Description / Agenda"
                  name="description"
                  type="textarea"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the meeting purpose and agenda"
                  rows={4}
                  required
                  error={fieldErrors.description}
                />
                <div className="text-xs text-gray-500 flex items-center">
                  <Check className="w-4 h-4 mr-1 text-green-500" />
                  Meeting details will be included in calendar invitations
                </div>
                {/* Meeting Link section inside Meeting Details */}
                {/* Zoom: show disabled shaded field indicating auto-generation */}
                <div className={`${provider === 'zoom' ? '' : 'hidden'}`}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Meeting Link
                  </label>
                  <input
                    type="text"
                    value="Will be generated automatically after scheduling"
                    disabled
                    className="block w-full px-4 py-3 border rounded-lg shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300"
                  />
                  <p className="mt-2 text-xs text-gray-500">Zoom meeting link will be auto-generated and emailed to participants.</p>
                </div>
                {/* Google Meet: ask for link with guidance */}
                <div className={`${provider === 'google_meet' ? '' : 'hidden'}`}>
                  <InputField
                    label="Google Meet Link"
                    name="joinUrl"
                    type="url"
                    value={joinUrl}
                    onChange={(e) => setJoinUrl(e.target.value)}
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    required={provider === 'google_meet'}
                    error={fieldErrors.joinUrl}
                  />
                  <div className="bg-green-50 border mt-4 border-green-200 rounded-lg p-4 text-sm text-green-800">
                    <p className="font-medium">How to get a Google Meet link:</p>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Click "Get Meet Link" to open Google Meet in a new tab.</li>
                      <li>Sign in if not already signed in.</li>
                      <li>Click "Create a meeting for later" and copy the link.</li>
                      <li>Paste the link above.</li>
                    </ol>
                    <a
                      href="https://meet.google.com/landing?hs=1&source=upcheck_admin&ref=events_create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center mt-3 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Get Meet Link
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Participants</h2>
              </div>
              <div className="space-y-4">
                <CreatableSelect
                  id="participants"
                  isMulti
                  closeMenuOnSelect={false}
                  options={users}
                  isLoading={loadingUsers}
                  value={selectedParticipants}
                  onChange={setSelectedParticipants}
                  placeholder="Search and select participants..."
                  noOptionsMessage={() => loadingUsers ? "Loading users..." : "No users found"}
                  loadingMessage={() => "Loading users..."}
                  createOptionPosition="first"
                  menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                  styles={{
                    ...customSelectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 })
                  }}
                  formatCreateLabel={(inputValue) => `Add external: ${inputValue}`}
                  isValidNewOption={(inputValue, selectValue, selectOptions) => {
                    const email = inputValue.trim();
                    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    const notDuplicate = ![...selectOptions, ...selectValue].some(o => o.value.toLowerCase() === email.toLowerCase());
                    return emailRe.test(email) && notDuplicate;
                  }}
                  onCreateOption={(inputValue) => {
                    const email = inputValue.trim();
                    const option = { value: email, label: email };
                    setSelectedParticipants(prev => [...prev, option]);
                  }}
                />
                <p className="text-xs text-gray-500">Type an email and press Enter to add as an external participant.</p>
                {fieldErrors.participants && (
                  <div className="flex items-center mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {fieldErrors.participants}
                  </div>
                )}
                <div className="text-xs text-gray-500 flex items-center">
                  <Check className="w-4 h-4 mr-1 text-green-500" />
                  {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} selected
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Schedule */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Schedule</h2>
              </div>
              <div className="space-y-6">
                {/* Recurring Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label htmlFor="isRecurring" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Make this a recurring meeting
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Create a series of meetings that repeat on a schedule
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      id="isRecurring"
                      name="isRecurring"
                      type="checkbox"
                      className="sr-only"
                      checked={formData.isRecurring}
                      onChange={handleInputChange}
                    />
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer ${
                        formData.isRecurring ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                      onClick={() => handleInputChange({ target: { name: 'isRecurring', checked: !formData.isRecurring, type: 'checkbox' } })}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          formData.isRecurring ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="startTime" className="block text-sm font-semibold text-gray-700">
                    {formData.isRecurring ? 'First Meeting Time' : 'Start Time'} <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={formData.startTime}
                    onChange={handleDateChange}
                    showTimeSelect
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className={`block w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${fieldErrors.startTime ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                      }`}
                    closeOnScroll={true}
                    placeholderText="Select date and time"
                    minDate={new Date()}
                    required
                  />
                  {fieldErrors.startTime && (
                    <div className="flex items-center mt-1 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {fieldErrors.startTime}
                    </div>
                  )}
                </div>
                <InputField
                  label="Duration"
                  name="duration"
                  type="number"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="60"
                  min="1"
                  max="480"
                  required
                  error={fieldErrors.duration}
                />
                <div className="text-xs text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Duration in minutes (max 8 hours)
                </div>
              </div>
            </div>

            {/* Recurring Pattern - Only show if recurring is enabled */}
            {formData.isRecurring && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                    <Repeat className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Recurrence Pattern</h2>
                </div>
                <RecurrencePatternSelector
                  value={recurrencePattern}
                  onChange={setRecurrencePattern}
                  startDate={formData.startTime}
                  error={fieldErrors.recurrencePattern}
                />
              </div>
            )}

            {/* Series Notification Settings - Only show if recurring is enabled */}
            {formData.isRecurring && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                    <Mail className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Series Notification</h2>
                </div>
                <SeriesNotificationSettings
                  value={seriesNotificationSettings}
                  onChange={setSeriesNotificationSettings}
                />
              </div>
            )}

            {/* Meeting Options - Zoom */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${provider !== 'zoom' ? 'hidden' : ''}`}>
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Settings className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Meeting Options</h2>
              </div>
              <div className="space-y-1 divide-y divide-gray-100">
                <Toggle
                  label="Waiting Room"
                  name="waiting_room"
                  checked={zoomSettings.waiting_room}
                  onChange={handleZoomSettingChange}
                  description="Participants wait for host approval"
                />
                <Toggle
                  label="Host Video On"
                  name="host_video"
                  checked={zoomSettings.host_video}
                  onChange={handleZoomSettingChange}
                  description="Start with host video enabled"
                />
                <Toggle
                  label="Participant Video On"
                  name="participant_video"
                  checked={zoomSettings.participant_video}
                  onChange={handleZoomSettingChange}
                  description="Start with participant video enabled"
                />
                <Toggle
                  label="Mute on Entry"
                  name="mute_upon_entry"
                  checked={zoomSettings.mute_upon_entry}
                  onChange={handleZoomSettingChange}
                  description="Mute participants when they join"
                />
                <Toggle
                  label="Join Before Host"
                  name="join_before_host"
                  checked={zoomSettings.join_before_host}
                  onChange={handleZoomSettingChange}
                  description="Allow participants to join early"
                />
                {zoomSettings.join_before_host && (
                  <div className="pl-4 pt-3 pb-1">
                    <label htmlFor="jbh_time" className="block text-sm font-medium text-gray-700 mb-2">
                      Join Before Host Time
                    </label>
                    <select
                      id="jbh_time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      value={zoomSettings.jbh_time}
                      onChange={(e) =>
                        setZoomSettings(prev => ({
                          ...prev,
                          jbh_time: parseInt(e.target.value),
                        }))
                      }
                    >
                      <option value={0}>Anytime</option>
                      <option value={5}>5 minutes before</option>
                      <option value={10}>10 minutes before</option>
                    </select>
                  </div>
                )}
                <div className="pt-3">
                  <label htmlFor="auto_recording" className="block text-sm font-medium text-gray-700 mb-2">
                    Automatic Recording
                  </label>
                  <select
                    id="auto_recording"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    value={zoomSettings.auto_recording}
                    onChange={(e) =>
                      setZoomSettings(prev => ({
                        ...prev,
                        auto_recording: e.target.value,
                      }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="local">Local</option>
                    <option value="cloud">Cloud</option>
                  </select>
                </div>
                <Toggle
                  label="Allow Multiple Devices"
                  name="allow_multiple_devices"
                  checked={zoomSettings.allow_multiple_devices}
                  onChange={handleZoomSettingChange}
                  description="Users can join from multiple devices"
                />
                <Toggle
                  label="Require Authentication"
                  name="meeting_authentication"
                  checked={zoomSettings.meeting_authentication}
                  onChange={handleZoomSettingChange}
                  description="Only authenticated users can join"
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Mail className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
              </div>
              <Toggle
                label="Send Email to Participants"
                name="sendNotification"
                checked={formData.sendNotification}
                onChange={handleInputChange}
                description="Send calendar invitations and reminders"
              />
              <div className="mt-2 pl-0">
                <Toggle
                  label="Track email opens (pixel)"
                  name="trackOpens"
                  checked={formData.trackOpens}
                  onChange={handleInputChange}
                  description="Embed a tiny tracking pixel to record when recipients open the email"
                />
                <Toggle
                  label="Track join button clicks"
                  name="trackClicks"
                  checked={formData.trackClicks}
                  onChange={handleInputChange}
                  description="Route the Join link through a tracker to record click events"
                />
                <Toggle
                  label="Manual read acknowledgment"
                  name="trackAck"
                  checked={formData.trackAck}
                  onChange={handleInputChange}
                  description="Adds an 'Acknowledge receipt' link in the email for users to confirm they've received/read it"
                />
              </div>
            </div>

            {/* Join Experience */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Settings className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Join Experience</h2>
              </div>
              <div className="space-y-2">
                <Toggle
                  label="Use interstitial Join page"
                  name="useInterstitialJoin"
                  checked={formData.useInterstitialJoin}
                  onChange={handleInputChange}
                  description="Show a setup screen, track the join, and auto-redirect to the meeting"
                />
                <div className={`pl-4 ${formData.useInterstitialJoin ? '' : 'opacity-50 pointer-events-none'}`}>
                  <InputField
                    label="Redirect delay (seconds)"
                    name="redirectDelay"
                    type="number"
                    value={formData.redirectDelay}
                    onChange={handleInputChange}
                    min="0"
                    max="30"
                    placeholder="5"
                  />
                </div>
                <Toggle
                  label="Include direct meeting link in email"
                  name="includeDirectMeetingLink"
                  checked={formData.includeDirectMeetingLink}
                  onChange={handleInputChange}
                  description="Adds a visible fallback link in case the Join button cannot load"
                />
                <div className="text-xs text-gray-500">
                  The email Join button will point to our interstitial page when enabled; otherwise it will link directly to the meeting.
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${provider !== 'google_meet' ? 'hidden' : ''}`}>
              <div className="flex items-center mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                  <Video className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Upcheck Bot <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 align-middle">Locked beta</span></h2>
              </div>
              <div className="opacity-60 pointer-events-none">
                <Toggle
                  label="Invite Upcheck Bot"
                  name="inviteUpcheckBot"
                  checked={false}
                  onChange={() => { }}
                  description="Automatically join Google Meet at start time with the Upcheck bot (locked beta)"
                />
              </div>
            </div>

          </div>

          {/* Bottom Section */}
          <div className="lg:col-span-3">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700 font-medium">Error: {error}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-center text-sm text-gray-500 mb-6">
                <span className="mr-2">Provider:</span>
                <span className="font-medium">{provider === 'zoom' ? 'Zoom' : 'Google Meet'}</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || loadingUsers}
                  className="px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Scheduling...
                    </>
                  ) : (
                    'Schedule Meeting'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;