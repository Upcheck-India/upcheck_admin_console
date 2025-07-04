'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeft, Video, Users, Calendar, Clock, Settings, Mail } from 'lucide-react';

const CreateEventPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null,
    duration: '60',
    sendNotification: true,
  });
  const [zoomSettings, setZoomSettings] = useState({
    waiting_room: true,
    host_video: false,
    participant_video: false,
    mute_upon_entry: true,
    join_before_host: false,
    jbh_time: 5, // Default to 5 minutes if join_before_host is true
    auto_recording: 'none',
    allow_multiple_devices: true,
    meeting_authentication: true,
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleZoomSettingChange = (e) => {
    const { name, checked } = e.target;
    setZoomSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startTime || new Date(formData.startTime) < new Date()) {
      setError('Please select a valid start time.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          zoomSettings,
          participants: selectedParticipants.map(p => p.value),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      router.push('/events?created=true');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const Toggle = ({ label, name, checked, onChange }) => (
    <label htmlFor={name} className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="relative">
        <input id={name} name={name} type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={`block w-10 h-6 rounded-full ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
      </div>
    </label>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <button onClick={() => router.push('/events')} className="inline-flex items-center mb-6 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Schedule a New Meeting</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Video className="w-6 h-6 mr-3 text-indigo-600"/>Meeting Details</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description / Agenda</label>
                  <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={4} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required></textarea>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Users className="w-6 h-6 mr-3 text-indigo-600"/>Participants</h2>
              <Select
                id="participants"
                isMulti
                closeMenuOnSelect={false}
                options={users}
                isLoading={loadingUsers}
                value={selectedParticipants}
                onChange={setSelectedParticipants}
                classNamePrefix="select"
                placeholder="Search for users to invite..."
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Calendar className="w-6 h-6 mr-3 text-indigo-600"/>Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <DatePicker
                    selected={formData.startTime}
                    onChange={(date) => setFormData(p => ({...p, startTime: date}))}
                    showTimeSelect
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    closeOnScroll={true}
                    placeholderText="Select date and time"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    id="duration"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    min="1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Settings className="w-6 h-6 mr-3 text-indigo-600"/>Meet Options</h2>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Waiting Room</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.waiting_room}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        waiting_room: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Host Video On</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.host_video}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        host_video: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Participant Video On</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.participant_video}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        participant_video: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Mute on Entry</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.mute_upon_entry}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        mute_upon_entry: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Join Before Host</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.join_before_host}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        join_before_host: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {zoomSettings.join_before_host && (
                <div className="space-y-2">
                  <label htmlFor="jbh_time" className="text-gray-700 block">Join Before Host Time</label>
                  <select
                    id="jbh_time"
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={zoomSettings.jbh_time}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        jbh_time: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value={0}>Anytime</option>
                    <option value={5}>5 minutes before</option>
                    <option value={10}>10 minutes before</option>
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="auto_recording" className="text-gray-700 block">Automatic Recording</label>
                <select
                  id="auto_recording"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={zoomSettings.auto_recording}
                  onChange={(e) =>
                    setZoomSettings({
                      ...zoomSettings,
                      auto_recording: e.target.value,
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="local">Local</option>
                  <option value="cloud">Cloud</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Allow Multiple Devices</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.allow_multiple_devices}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        allow_multiple_devices: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Require Authentication</span>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={zoomSettings.meeting_authentication}
                    onChange={(e) =>
                      setZoomSettings({
                        ...zoomSettings,
                        meeting_authentication: e.target.checked,
                      })
                    }
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Mail className="w-6 h-6 mr-3 text-indigo-600"/>Notifications</h2>
              <Toggle label="Send Email to Participants" name="sendNotification" checked={formData.sendNotification} onChange={handleInputChange} />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="lg:col-span-3 mt-4">
            {error && <p className="text-red-600 text-sm mb-4 bg-red-100 p-3 rounded-md">Error: {error}</p>}
            <div className="flex items-center justify-center text-xs text-gray-500 my-4">
              <span>Powered by</span>
              <img src="/zoom.png" alt="Zoom logo" className="h-5 w-auto mx-1.5" />
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button type="button" onClick={() => router.back()} className="mr-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting || loadingUsers} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {submitting ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventPage;
