'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { Calendar, Clock, Users, Video, Info, ArrowLeft, Copy, Check, Trash2, AlertTriangle, Pencil, Download, Eye, MousePointer, MailCheck } from 'lucide-react';

const EventDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [internalEmails, setInternalEmails] = useState([]);
  const [forcingBot, setForcingBot] = useState(false);
  const [forceMsg, setForceMsg] = useState('');

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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setInternalEmails(data.map(u => u.email?.toLowerCase()).filter(Boolean));
      } catch {}
    };
    fetchUsers();
  }, []);

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

  const handleForceBotJoin = async () => {
    try {
      setForceMsg('');
      setForcingBot(true);
      const res = await fetch(`/api/events/${id}/bot/join`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger bot join');
      }
      setForceMsg('Bot join requested.');
    } catch (e) {
      setForceMsg(e.message || 'Failed to trigger bot join');
    } finally {
      setForcingBot(false);
      setTimeout(() => setForceMsg(''), 4000);
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

  // Split participants into internal vs external
  const participants = Array.isArray(event.participants) ? event.participants : [];
  const internal = participants.filter(p => internalEmails.includes((p || '').toLowerCase()));
  const external = participants.filter(p => !internalEmails.includes((p || '').toLowerCase()));
  const tracking = Array.isArray(event.tracking) ? event.tracking : [];
  const openCount = tracking.filter(t => t.openedAt).length;
  const clickCount = tracking.filter(t => t.clickedAt).length;
  const ackCount = tracking.filter(t => t.ackAt).length;

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
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-indigo-600"/>
                    Participants ({participants.length})
                  </h3>
                  {external.length > 0 ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Internal ({internal.length})</p>
                        {internal.length === 0 ? (
                          <p className="text-sm text-gray-500">None</p>
                        ) : (
                          <ul className="list-disc list-inside text-gray-700">
                            {internal.map((p, i) => <li key={`in-${i}`}>{p}</li>)}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">External ({external.length})</p>
                        <ul className="list-disc list-inside text-gray-700">
                          {external.map((p, i) => <li key={`ex-${i}`}>{p}</li>)}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <ul className="list-disc list-inside text-gray-700">
                      {participants.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                </div>

                {(event.trackOpens || event.trackClicks || event.trackAck) && (
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                      <MailCheck className="w-5 h-5 mr-2 text-indigo-600"/>
                      Delivery & Engagement
                    </h3>
                    <div className="mb-3 text-sm text-gray-600 flex items-center gap-4">
                      {event.trackOpens && (
                        <span className="inline-flex items-center gap-1"><Eye className="w-4 h-4"/> Opens: {openCount}/{participants.length}</span>
                      )}
                      {event.trackClicks && (
                        <span className="inline-flex items-center gap-1"><MousePointer className="w-4 h-4"/> Clicks: {clickCount}/{participants.length}</span>
                      )}
                      {event.trackAck && (
                        <span className="inline-flex items-center gap-1"><Check className="w-4 h-4"/> Acknowledged: {ackCount}/{participants.length}</span>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-md border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                            {event.trackOpens && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opened</th>
                            )}
                            {event.trackClicks && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicked</th>
                            )}
                            {event.trackAck && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acknowledged</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {participants.map((email, i) => {
                            const rec = tracking.find(t => t.email === email);
                            return (
                              <tr key={`trk-${i}`} className="text-sm">
                                <td className="px-4 py-2 text-gray-800">{email}</td>
                                <td className="px-4 py-2 text-gray-600">{rec?.sentAt ? new Date(rec.sentAt).toLocaleString() : (event.sendNotification ? 'Sent' : '—')}</td>
                                {event.trackOpens && (
                                  <td className="px-4 py-2">{rec?.openedAt ? <span className="text-green-700">{new Date(rec.openedAt).toLocaleString()}</span> : <span className="text-gray-400">—</span>}</td>
                                )}
                                {event.trackClicks && (
                                  <td className="px-4 py-2">{rec?.clickedAt ? <span className="text-blue-700">{new Date(rec.clickedAt).toLocaleString()}</span> : <span className="text-gray-400">—</span>}</td>
                                )}
                                {event.trackAck && (
                                  <td className="px-4 py-2">{rec?.ackAt ? <span className="text-indigo-700">{new Date(rec.ackAt).toLocaleString()}</span> : <span className="text-gray-400">—</span>}</td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Tracking is optional and respects recipients' email clients. Some clients block pixels by default. Refresh this page after recipients interact with the email to see updates.</p>
                  </div>
                )}
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
                      {user && event && user.email === event.host && event.provider === 'google_meet' && (
                        <button
                          onClick={handleForceBotJoin}
                          disabled={forcingBot}
                          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          {forcingBot ? 'Requesting...' : 'Force Bot Join'}
                        </button>
                      )}
                      <a href={`/api/events/${id}/ics`} download className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                          <Download className="w-5 h-5 mr-2" />
                          Add to Calendar
                      </a>
                      <button onClick={handleCopyLink} className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        {isCopied ? <Check className="w-5 h-5 mr-2 text-green-500" /> : <Copy className="w-5 h-5 mr-2" />}
                        {isCopied ? 'Link Copied!' : 'Copy Link'}
                      </button>
                      {forceMsg && (
                        <div className="text-xs text-gray-600 text-center">{forceMsg}</div>
                      )}
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
