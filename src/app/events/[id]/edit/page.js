'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const EditEventPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null,
    duration: '60',
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('zoom');
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    // Fetch all users for the participants dropdown
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'include' });
        const data = await response.json();
        setAllUsers(data.map(u => ({ value: u.email, label: u.email })));
      } catch (err) {
        setError('Failed to load users.');
      }
    };

    // Fetch the event data to pre-fill the form
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${id}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch event data.');
        const eventData = await response.json();

        // Security check: only host can edit
        if (user && eventData.host !== user.email) {
            router.push(`/events/${id}`); // Redirect if not host
            return;
        }

        setFormData({
          title: eventData.title,
          description: eventData.description,
          startTime: new Date(eventData.startTime),
          duration: eventData.duration.toString(),
        });
        setSelectedParticipants(eventData.participants.map(p => ({ value: p, label: p })));
        setProvider(eventData.provider || 'zoom');
        setJoinUrl(eventData.joinUrl || eventData.zoomMeetingUrl || '');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    if (user) { // Ensure user is loaded before checking host status
        fetchEvent();
    }

  }, [id, user, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate Google Meet link if applicable
    if (provider === 'google_meet') {
      const isValidMeet = typeof joinUrl === 'string' && /^https?:\/\//i.test(joinUrl) && joinUrl.includes('meet.google.com');
      if (!isValidMeet) {
        setError('Please provide a valid Google Meet link (https://meet.google.com/...)');
        return;
      }
    }

    const finalData = {
      ...formData,
      participants: selectedParticipants.map(p => p.value),
      provider,
      ...(provider === 'google_meet' ? { joinUrl } : {}),
    };

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event.');
      }

      router.push(`/events/${id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Edit Event</h1>
      {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {/* Provider Selection */}
        <div>
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
        {/* Form fields are identical to the create page for consistency */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="4" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"></textarea>
        </div>
        {/* Meeting Link inside Meeting Details */}
        {/* Zoom: disabled shaded field */}
        <div className={`${provider === 'zoom' ? '' : 'hidden'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
          <input
            type="text"
            value="Will be generated automatically after scheduling"
            disabled
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">Zoom meeting link will be auto-generated and emailed to participants.</p>
        </div>
        {/* Google Meet: ask for link with guidance */}
        <div className={`${provider === 'google_meet' ? '' : 'hidden'}`}>
          <label htmlFor="joinUrl" className="block text-sm font-medium text-gray-700 mb-1">Google Meet Link</label>
          <input
            type="url"
            id="joinUrl"
            name="joinUrl"
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="https://meet.google.com/xyz-abcd-efg"
            required={provider === 'google_meet'}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          <div className="mt-3 p-4 rounded-md bg-green-50 border border-green-200 text-sm text-green-800">
            <p className="font-medium">How to get a Google Meet link:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Click <a href="https://meet.google.com/landing?hs=1&source=upcheck_admin&ref=events_edit" target="_blank" rel="noopener noreferrer" className="underline font-medium">Create Meet</a> to open Google Meet in a new tab.</li>
              <li>Sign in and create a new meeting.</li>
              <li>Copy the meeting link and paste it above.</li>
            </ol>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
          <Select
            isMulti
            options={allUsers}
            value={selectedParticipants}
            onChange={setSelectedParticipants}
            className="mt-1"
            classNamePrefix="select"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <DatePicker
              selected={formData.startTime}
              onChange={(date) => setFormData(p => ({...p, startTime: date}))}
              showTimeSelect
              dateFormat="MMMM d, yyyy h:mm aa"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input type="number" id="duration" name="duration" value={formData.duration} onChange={handleInputChange} min="1" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-4">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Save Changes</button>
        </div>
      </form>
    </div>
  );
};

export default EditEventPage;
