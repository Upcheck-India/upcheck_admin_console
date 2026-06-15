'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { Calendar, Clock, Users, Video, Info, ArrowLeft, Copy, Check, Trash2, AlertTriangle, Pencil, Download, Eye, MousePointer, MailCheck, FileText, Upload, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  
  // MOM file upload states
  const [momFiles, setMomFiles] = useState([]);
  const [isUploadingMom, setIsUploadingMom] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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
            setMomFiles(data.momDocuments || []);
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
        const res = await fetch('/api/users?limit=500', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const usersArray = data.users || [];
        setInternalEmails(usersArray.map(u => u.email?.toLowerCase()).filter(Boolean));
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

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleMomUpload(e.dataTransfer.files[0]);
    }
  };

  const handleMomUpload = async (file) => {
    if (!file) return;

    // Validate size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    // Validate extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      toast.error('Only PDF and DOCX files are allowed.');
      return;
    }

    setIsUploadingMom(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/events/${id}/mom`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload MOM');
      }

      toast.success(data.message || 'MOM document uploaded successfully!');
      
      const updatedMomDocs = [...momFiles, data.mom];
      setMomFiles(updatedMomDocs);
      setEvent(prev => ({
        ...prev,
        momDocuments: updatedMomDocs
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploadingMom(false);
    }
  };

  const handleMomDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this MOM document?')) return;

    try {
      const response = await fetch(`/api/events/${id}/mom?fileId=${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete MOM');
      }

      toast.success(data.message || 'MOM document deleted successfully.');
      
      const updatedMomDocs = momFiles.filter(doc => doc.fileId !== fileId);
      setMomFiles(updatedMomDocs);
      setEvent(prev => ({
        ...prev,
        momDocuments: updatedMomDocs
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'An error occurred during deletion.');
    }
  };

  const handleMomDownload = (fileId, filename) => {
    const link = document.createElement('a');
    link.href = `/api/events/${id}/mom?fileId=${fileId}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

            {/* Moments of the Meeting (MOM) Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Moments of the Meeting (MOM)
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload and manage official minutes/moments documents for this meeting.
                  </p>
                </div>
                
                {/* Recommended Hint */}
                {momFiles.length <= 1 && (
                  <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs px-3 py-1.5 rounded-full">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span>💡 <strong>Recommendation:</strong> Uploading a single consolidated MOM is recommended.</span>
                  </div>
                )}
                {momFiles.length > 1 && (
                  <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs px-3 py-1.5 rounded-full">
                    <span>💡 Only one MOM document is recommended ({momFiles.length}/3 uploaded).</span>
                  </div>
                )}
              </div>

              {/* MOM List */}
              {momFiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {momFiles.map((doc) => {
                    const isPdf = doc.filename.toLowerCase().endsWith('.pdf');
                    const uploadDate = new Date(doc.uploadedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                    const canDelete = user && (user.email.toLowerCase() === (event.host || '').toLowerCase() || user.email.toLowerCase() === (doc.uploadedBy || '').toLowerCase());
                    
                    return (
                      <div key={doc.fileId} className="flex flex-col justify-between p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-lg shrink-0 ${isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatBytes(doc.size || 0)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <div className="min-w-0 pr-2">
                            <p className="truncate text-gray-600 font-medium" title={`Uploaded by ${doc.uploadedBy}`}>
                              Uploaded by: <span className="text-gray-900 font-semibold">{doc.uploadedBy}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{uploadDate}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMomDownload(doc.fileId, doc.filename)}
                              className="p-1.5 hover:bg-gray-100 hover:text-indigo-600 rounded-md transition-colors"
                              title="Download document"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleMomDelete(doc.fileId)}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload Dropzone */}
              {canJoinMeeting && momFiles.length < 3 ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                      : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    type="file"
                    id="mom-file-upload"
                    className="hidden"
                    accept=".pdf,.docx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleMomUpload(e.target.files[0]);
                      }
                    }}
                    disabled={isUploadingMom}
                  />
                  
                  {isUploadingMom ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                      <p className="font-medium text-gray-700">Uploading and scanning document...</p>
                      <p className="text-xs text-gray-500 mt-1">This runs magic checks and antivirus scans for security</p>
                    </div>
                  ) : (
                    <label htmlFor="mom-file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                      <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-3 hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-gray-700 text-sm">
                        Drag & drop file here, or <span className="text-indigo-600 hover:underline">browse</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        PDF or DOCX only (Max 5MB) • Up to 3 files allowed
                      </p>
                    </label>
                  )}
                </div>
              ) : (
                !canJoinMeeting ? (
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center text-sm text-gray-500">
                    Only participants of the meeting can upload MOM documents.
                  </div>
                ) : momFiles.length >= 3 ? (
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center text-sm text-gray-500">
                    Maximum limit of 3 MOM documents has been uploaded for this meeting.
                  </div>
                ) : null
              )}
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
