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
    const finalData = {
      ...formData,
      participants: selectedParticipants.map(p => p.value),
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
        {/* Form fields are identical to the create page for consistency */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="4" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"></textarea>
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
