'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { Calendar, Clock, Users, Video, Info, ArrowLeft, Copy, Check, Trash2, AlertTriangle, Pencil, Download } from 'lucide-react';

const EventDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchEvent = async () => {
        try {
          const response = await fetch(`/api/events/${id}`, { credentials: 'include' });
          if (!response.ok) {
            if (response.status === 404) {
              setError('Event not found.');
            } else {
              throw new Error('Failed to fetch event details');
            }
          } else {
            const data = await response.json();
            setEvent(data);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchEvent();
    }
  }, [id]);

  const canJoinMeeting = user && event && (event.host === user.email || event.participants.includes(user.email));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(event.joinUrl || event.zoomMeetingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete event.');
      }

      router.push('/events?deleted=true');
    } catch (err) {
      setError(err.message);
      setIsDeleteModalOpen(false);
    }
  };

  if (loading || authLoading) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-50"><p>Loading event details...</p></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-50"><p className="text-red-500">Error: {error}</p></div>;
  }

  if (!event) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-50"><p>Event not found.</p></div>;
  }

  const eventDate = new Date(event.startTime);

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/events')} className="inline-flex items-center mb-6 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        {user && event && user.email === event.host && (
          <div className="flex justify-end items-center gap-4 mb-4">
            <button onClick={() => router.push(`/events/${id}/edit`)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <Pencil className="w-4 h-4 mr-2" />
              Edit Event
            </button>
            <button onClick={() => setIsDeleteModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Event
            </button>
          </div>
        )}

        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
            <p className="text-md text-gray-600 mb-6">Hosted by <span className="font-semibold">{event.host}</span></p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Details */}
              <div className="space-y-6">
                <div>
                  <h2 className="font-semibold text-lg text-gray-800 mb-2 flex items-center"><Info className="w-5 h-5 mr-2 text-indigo-600"/>Details</h2>
                  <p className="text-gray-700">{event.description}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center"><Calendar className="w-5 h-5 mr-2 text-indigo-600"/>Schedule</h3>
                  <p className="text-gray-700">{new Date(event.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center"><Clock className="w-5 h-5 mr-2 text-indigo-600"/>Duration</h3>
                  <p className="text-gray-700">{event.duration} minutes</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-600"/>Participants ({event.participants.length})</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {event.participants.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="bg-gray-50 p-6 rounded-lg shadow-inner flex flex-col">
                <div className="flex-grow">
                  <h2 className="font-semibold text-lg text-gray-800 mb-4 flex items-center"><Video className="w-5 h-5 mr-2 text-indigo-600"/>Meeting Access</h2>
                  {canJoinMeeting ? (
                    <div className="mt-6 space-y-4">
                      <button
                        onClick={() => window.open(event.joinUrl || event.zoomMeetingUrl, '_blank')}
                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <Video className="w-5 h-5 mr-2" />
                        Join Meeting
                      </button>
                      <a href={`/api/events/${id}/ics`} download className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                          <Download className="w-5 h-5 mr-2" />
                          Add to Calendar
                      </a>
                      <button onClick={handleCopyLink} className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        {isCopied ? <Check className="w-5 h-5 mr-2 text-green-500" /> : <Copy className="w-5 h-5 mr-2" />}
                        {isCopied ? 'Link Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  ) : (
                    <div className="w-full p-4 rounded-md bg-yellow-100 text-yellow-800">
                      <p className="font-semibold">Access Restricted</p>
                      <p className="text-sm">This is a private meeting. Only the host and invited participants can join.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-end text-xs text-gray-500">
            <span>Provider:</span>
            <span className="ml-1.5 font-medium">{event.provider === 'google_meet' ? 'Google Meet' : 'Zoom'}</span>
          </div>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-2xl max-w-sm w-full">
            <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500"/>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Delete Event</h3>
                <p className="mt-2 text-sm text-gray-500">Are you sure you want to delete "{event.title}"? This action cannot be undone.</p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetailPage;
