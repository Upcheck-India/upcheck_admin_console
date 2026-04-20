'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Loader2, ExternalLink } from 'lucide-react';

function JoinMeetingContent() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();

  const meetingId = params?.meetingId;
  const meetingUrl = sp.get('meetingUrl') || '';
  const email = sp.get('email') || '';
  const delay = Math.max(0, Number(sp.get('delay') || 5));

  const isValidUrl = useMemo(() => {
    try {
      const u = new URL(meetingUrl);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, [meetingUrl]);

  const [seconds, setSeconds] = useState(delay);

  useEffect(() => {
    // Best-effort tracking (do not block UX)
    const payload = { meetingId, email, meetingUrl, at: new Date().toISOString(), ua: navigator.userAgent };
    fetch('/api/meetings/track-join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [meetingId, email, meetingUrl]);

  useEffect(() => {
    if (!isValidUrl) return;
    if (seconds <= 0) {
      window.location.href = meetingUrl;
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, meetingUrl, isValidUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 mb-3">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Setting up your meeting…</h1>
          <p className="text-slate-600">We are preparing things and will take you to the meeting automatically.</p>

          <div className="mt-6 text-sm text-slate-600">
            {isValidUrl ? (
              <>
                <div>Redirecting in <span className="font-semibold text-slate-900">{seconds}s</span>…</div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    onClick={() => (window.location.href = meetingUrl)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Go now
                  </button>
                  <a
                    href={meetingUrl}
                    className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                    target="_self"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Open direct link
                  </a>
                </div>
              </>
            ) : (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                Missing or invalid meeting link. Please contact the organizer.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JoinMeetingInterstitial() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <JoinMeetingContent />
    </Suspense>
  );
}
