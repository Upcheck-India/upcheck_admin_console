'use client';

import { useState, useEffect, useCallback, use as usePromise } from 'react';
import {
  Clock, MapPin, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Loader2, Check, ArrowLeft, CalendarPlus, User,
} from 'lucide-react';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const localTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtLongDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function downloadIcs(content, title) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'booking').replace(/[^a-z0-9]+/gi, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BookingPage({ params }) {
  const { id } = usePromise(params);

  const [eventType, setEventType] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [viewY, setViewY] = useState(today.getFullYear());
  const [viewM, setViewM] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({ inviteeName: '', inviteeEmail: '', notes: '' });
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/scheduling/public/${id}`);
        const data = await res.json();
        if (!res.ok) { setLoadError(data.error || 'This booking link is not available.'); return; }
        setEventType(data.eventType);
      } catch {
        setLoadError('Something went wrong loading this page.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loadSlots = useCallback(async (dateStr) => {
    setSlotsLoading(true);
    setSlots([]);
    try {
      const res = await fetch(`/api/scheduling/public/${id}/slots?date=${dateStr}`);
      const data = await res.json();
      setSlots(res.ok ? (data.slots || []) : []);
    } finally {
      setSlotsLoading(false);
    }
  }, [id]);

  const pickDate = (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    loadSlots(dateStr);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.inviteeName.trim()) { setFormError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.inviteeEmail)) { setFormError('Please enter a valid email.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/scheduling/public/${id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, start: selectedSlot.start }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Could not complete the booking.');
        // The slot may have just been taken — refresh.
        if (res.status === 409 && selectedDate) loadSlots(selectedDate);
        return;
      }
      setBooking(data.booking);
      setConfirmation({ booking: data.booking, ics: data.ics });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md text-center">
          <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Booking unavailable</h1>
          <p className="text-gray-500 text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  // Confirmation screen
  if (confirmation) {
    const b = confirmation.booking;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">You're booked!</h1>
          <p className="text-gray-500 text-sm mb-5">A calendar invite is ready below.</p>

          <div className="text-left bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
            <p className="font-semibold text-gray-900">{b.eventTypeTitle} with {b.ownerName}</p>
            <p className="text-sm text-gray-600 flex items-center gap-2"><Clock className="h-4 w-4" /> {fmtLongDate(b.startTime)}, {fmtTime(b.startTime)}</p>
            <p className="text-xs text-gray-400">Times in your timezone ({localTz})</p>
            {b.location && <p className="text-sm text-gray-600 flex items-center gap-2"><MapPin className="h-4 w-4" /> {b.location}</p>}
          </div>

          {confirmation.ics && (
            <button onClick={() => downloadIcs(confirmation.ics, b.eventTypeTitle)} className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Month grid
  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const canGoPrev = viewY > today.getFullYear() || (viewY === today.getFullYear() && viewM > today.getMonth());

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
          {/* Left: event details */}
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-100 bg-gradient-to-br from-blue-50 to-cyan-50">
            <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5"><User className="h-4 w-4" /> {eventType.ownerName}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{eventType.title}</h1>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> {eventType.durationMinutes} minutes</p>
              {eventType.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-600" /> {eventType.location}</p>}
            </div>
            {eventType.description && <p className="mt-4 text-sm text-gray-600 whitespace-pre-line">{eventType.description}</p>}
          </div>

          {/* Right: pick a time, or fill the form */}
          <div className="p-6">
            {!selectedSlot ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Select a date &amp; time</h2>
                  <div className="flex items-center gap-1">
                    <button disabled={!canGoPrev} onClick={() => { const m = viewM - 1; if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m); }}
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm font-medium text-gray-700 w-32 text-center">{MONTHS[viewM]} {viewY}</span>
                    <button onClick={() => { const m = viewM + 1; if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m); }}
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAY_LABELS.map((w) => <div key={w} className="text-center text-xs font-medium text-gray-400 py-1">{w}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((d, i) => {
                    if (d === null) return <div key={`e${i}`} />;
                    const ds = toDateStr(viewY, viewM, d);
                    const isPast = ds < todayStr;
                    const isToday = ds === todayStr;
                    const isSelected = ds === selectedDate;
                    return (
                      <button
                        key={ds}
                        disabled={isPast}
                        onClick={() => pickDate(ds)}
                        className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                          isSelected ? 'bg-blue-600 text-white'
                            : isPast ? 'text-gray-300 cursor-not-allowed'
                            : isToday ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <div className="mt-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">{fmtLongDate(selectedDate + 'T00:00')}</p>
                    {slotsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">No available times on this day.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                          {slots.map((s) => (
                            <button key={s.start} onClick={() => setSelectedSlot(s)}
                              className="px-2 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors">
                              {fmtTime(s.start)}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Times shown in your timezone ({localTz})</p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={submit}>
                <button type="button" onClick={() => setSelectedSlot(null)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {fmtLongDate(selectedSlot.start)}, {fmtTime(selectedSlot.start)} ({eventType.durationMinutes} min)
                </div>

                {formError && <div className="bg-red-50 text-red-700 text-sm p-2 rounded mb-3">{formError}</div>}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your name *</label>
                    <input value={form.inviteeName} onChange={(e) => setForm({ ...form, inviteeName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" value={form.inviteeEmail} onChange={(e) => setForm({ ...form, inviteeEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                      placeholder="Anything that will help prepare for the meeting" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm booking
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
