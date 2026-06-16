'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeft, Video, Users, Calendar, Clock, AlertCircle } from 'lucide-react';

const EditEventPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null,
    duration: '60',
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchTeams = async () => {
      try {
        setLoadingTeams(true);
        const response = await fetch('/api/teams?limit=500', {
          headers: {
            'x-user-role': user.role,
            'x-user-id': user.id || user._id,
          },
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setTeams(data.teams || []);
        }
      } catch (err) {
        console.error('Failed to load teams:', err);
      } finally {
        setLoadingTeams(false);
      }
    };
    fetchTeams();
  }, [user]);

  const handleTeamsChange = (selectedOptions) => {
    const prevTeams = selectedTeams;
    const nextTeams = selectedOptions || [];
    setSelectedTeams(nextTeams);

    // Find added/removed teams
    const addedTeams = nextTeams.filter(t => !prevTeams.some(pt => pt.value === t.value));
    const removedTeams = prevTeams.filter(pt => !nextTeams.some(t => t.value === pt.value));

    let updatedParticipants = [...selectedParticipants];

    addedTeams.forEach(teamOpt => {
      const teamObj = teams.find(t => t._id === teamOpt.value);
      if (teamObj && teamObj.members) {
        teamObj.members.forEach(member => {
          if (member && member.email) {
            const email = member.email.toLowerCase();
            if (!updatedParticipants.some(p => p.value.toLowerCase() === email)) {
              updatedParticipants.push({
                value: member.email,
                label: `${member.username || member.email.split('@')[0]} (${member.email})`
              });
            }
          }
        });
      }
    });

    removedTeams.forEach(teamOpt => {
      const teamObj = teams.find(t => t._id === teamOpt.value);
      if (teamObj && teamObj.members) {
        teamObj.members.forEach(member => {
          if (member && member.email) {
            const email = member.email.toLowerCase();
            const inOtherTeam = nextTeams.some(remainingTeamOpt => {
              const remainingTeamObj = teams.find(t => t._id === remainingTeamOpt.value);
              return remainingTeamObj && remainingTeamObj.members && 
                     remainingTeamObj.members.some(m => m && m.email && m.email.toLowerCase() === email);
            });

            if (!inOtherTeam) {
              updatedParticipants = updatedParticipants.filter(p => p.value.toLowerCase() !== email);
            }
          }
        });
      }
    });

    setSelectedParticipants(updatedParticipants);
  };
  // --- Bug Fix #1.3: Separate loading states for auth vs event data ---
  // Previously a single `loading` state caused the page to hang if user wasn't
  // loaded yet, because fetchEvent() was gated on `user` being truthy.
  const [eventLoading, setEventLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [provider, setProvider] = useState('zoom');
  const [joinUrl, setJoinUrl] = useState('');
  const [existingZoomUrl, setExistingZoomUrl] = useState('');

  // Fetch all users for the participants dropdown (no auth dependency)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users?limit=500', { credentials: 'include' });
        const data = await response.json();
        const usersArray = data.users || [];
        setAllUsers(usersArray.map(u => ({ value: u.email, label: `${u.username || u.email} (${u.email})` })));
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    fetchUsers();
  }, []);

  // --- Bug Fix #1.3: Wait for auth to complete before fetching event ---
  // Previously user could be null on first render (auth is async), causing
  // fetchEvent to never run and the page to show "Loading..." forever.
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve first

    if (!user) {
      // Not authenticated — redirect to login
      router.push('/login');
      return;
    }

    const fetchEvent = async () => {
      setEventLoading(true);
      try {
        const response = await fetch(`/api/events/${id}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch event data.');
        const eventData = await response.json();

        // Security check: only host can edit
        if (eventData.host !== user.email) {
          router.push(`/events/${id}`); // Redirect non-hosts back to detail page
          return;
        }

        setFormData({
          title: eventData.title,
          description: eventData.description,
          startTime: new Date(eventData.startTime),
          duration: eventData.duration.toString(),
        });
        setSelectedParticipants(eventData.participants.map(p => ({ value: p, label: p })));
        if (eventData.teams) {
          setSelectedTeams(eventData.teams.map(t => ({ value: t, label: t })));
        } else {
          setSelectedTeams([]);
        }
        setProvider(eventData.provider || 'zoom');
        setJoinUrl(eventData.joinUrl || '');
        // Store existing Zoom URL separately for display purposes
        setExistingZoomUrl(eventData.zoomMeetingUrl || eventData.joinUrl || '');
      } catch (err) {
        setError(err.message);
      } finally {
        setEventLoading(false);
      }
    };

    fetchEvent();
  }, [id, user, authLoading, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    if (!formData.title?.trim()) { setError('Meeting title is required.'); return; }
    if (!formData.description?.trim()) { setError('Meeting description is required.'); return; }
    if (!formData.startTime) { setError('Start time is required.'); return; }
    if (!formData.duration || parseInt(formData.duration) < 1) { setError('Duration must be at least 1 minute.'); return; }
    if (parseInt(formData.duration) > 300) { setError('Duration cannot exceed 300 minutes.'); return; }

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
      teams: selectedTeams.map(t => t.label),
      provider,
      ...(provider === 'google_meet' ? { joinUrl } : {}),
    };

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  // --- Bug Fix #1.3 + #3.15: Styled loading state that handles auth loading too ---
  if (authLoading || eventLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading event details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push(`/events/${id}`)}
          className="inline-flex items-center mb-8 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Event
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Meeting</h1>
          <p className="text-gray-600">Update the details for this scheduled meeting.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Video className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Meeting Provider</h2>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setProvider('zoom')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${provider === 'zoom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 hover:bg-white'}`}
              >
                Zoom
              </button>
              <button
                type="button"
                onClick={() => setProvider('google_meet')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${provider === 'google_meet' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 hover:bg-white'}`}
              >
                Google Meet
              </button>
            </div>
          </div>

          {/* Meeting Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Video className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Meeting Details</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">
                  Meeting Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">
                  Description / Agenda <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  required
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* --- Bug Fix #1.4: Show actual existing Zoom link instead of misleading placeholder --- */}
              <div className={provider === 'zoom' ? '' : 'hidden'}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Link</label>
                <input
                  type="text"
                  value={existingZoomUrl || 'Zoom link is preserved from original meeting'}
                  disabled
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The existing Zoom meeting link is preserved. Zoom meetings cannot be re-generated on edit.
                </p>
              </div>

              <div className={provider === 'google_meet' ? '' : 'hidden'}>
                <label htmlFor="joinUrl" className="block text-sm font-semibold text-gray-700 mb-1">
                  Google Meet Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  id="joinUrl"
                  name="joinUrl"
                  value={joinUrl}
                  onChange={(e) => setJoinUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abcd-efg"
                  required={provider === 'google_meet'}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <div className="mt-3 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                  <p className="font-medium">How to get a Google Meet link:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Click <a href="https://meet.google.com/landing?hs=1&source=upcheck_admin&ref=events_edit" target="_blank" rel="noopener noreferrer" className="underline font-medium">Create Meet</a> to open Google Meet in a new tab.</li>
                    <li>Sign in and create a new meeting.</li>
                    <li>Copy the meeting link and paste it above.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
            </div>
            <div className="space-y-4">
              {/* Select Teams */}
              <div>
                <label htmlFor="teams" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Add Members from Groups/Teams
                </label>
                <Select
                  id="teams"
                  isMulti
                  options={teams.map(team => ({ value: team._id, label: team.name }))}
                  isLoading={loadingTeams}
                  value={selectedTeams}
                  onChange={handleTeamsChange}
                  placeholder="Select teams..."
                  closeMenuOnSelect={false}
                  menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                />
              </div>

              <div className="border-t border-gray-150 my-2 pt-2">
                <label htmlFor="participants" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Individual Participants
                </label>
              </div>

              <CreatableSelect
                isMulti
              options={allUsers}
              value={selectedParticipants}
              onChange={setSelectedParticipants}
              placeholder="Search users or add external emails"
              createOptionPosition="first"
              menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
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
            <p className="text-xs text-gray-500 mt-2">Type an email and press Enter to add as an external participant.</p>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startTime" className="block text-sm font-semibold text-gray-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  selected={formData.startTime}
                  onChange={(date) => setFormData(p => ({ ...p, startTime: date }))}
                  showTimeSelect
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label htmlFor="duration" className="block text-sm font-semibold text-gray-700 mb-1">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  min="1"
                  max="300"
                  required
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" /> Max 300 minutes (5 hours)
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push(`/events/${id}`)}
                className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEventPage;
