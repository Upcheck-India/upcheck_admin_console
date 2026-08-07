'use client';

// The OAuth consent / authorize screen. Reached when an application sends the
// user to /api/oauth/v1/authorize; that endpoint validates the request and
// redirects here with ?rid=. A logged-in admin (or api.manage holder) reviews
// the app + requested scopes and approves or denies. Approval mints the code and
// the browser is redirected back to the application.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import { KeyRound, ShieldCheck, Lock, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

function ConsentInner() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin' || (Array.isArray(user.perms) && user.perms.includes('api.manage')));
  const params = useSearchParams();
  const rid = params.get('rid') || '';

  const [state, setState] = useState({ loading: true, req: null, error: '' });
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    if (!isAdmin || !rid) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/oauth/v1/authorize/request?rid=${encodeURIComponent(rid)}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) setState({ loading: false, req: data, error: '' });
      else setState({ loading: false, req: null, error: data.error_description || data.error || 'This authorization request is not available.' });
    })();
    return () => { cancelled = true; };
  }, [isAdmin, rid]);

  async function decide(decision) {
    setSubmitting(decision);
    try {
      const res = await fetch('/api/oauth/v1/authorize/decision', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rid, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirect) { window.location.href = data.redirect; return; }
      setState((s) => ({ ...s, error: data.error_description || data.error || 'Could not complete the request.' }));
    } finally {
      setSubmitting('');
    }
  }

  if (authLoading || (isAdmin && state.loading)) {
    return <Centered><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></Centered>;
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  if (state.error) {
    return (
      <Card>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-rose-50 text-rose-600"><AlertTriangle className="w-7 h-7" /></div>
          <h1 className="text-lg font-bold text-slate-900">Authorization unavailable</h1>
          <p className="text-slate-500 text-sm">{state.error}</p>
          <p className="text-slate-400 text-xs">Restart the connection from the application to try again.</p>
        </div>
      </Card>
    );
  }

  const { app, scopes, redirectUri } = state.req;
  let redirectHost = redirectUri;
  try { redirectHost = new URL(redirectUri).host; } catch { /* ignore */ }

  return (
    <Card>
      <div className="flex flex-col items-center text-center mb-5">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white mb-3"><KeyRound className="w-7 h-7" /></div>
        <h1 className="text-xl font-bold text-slate-900">Authorize {app.name}</h1>
        <p className="text-slate-500 text-sm mt-1">
          <b>{app.name}</b> wants read-only access to your Upcheck ERP data.
          {app.isFirstParty && <span className="ml-1 inline-flex items-center gap-1 text-emerald-600"><ShieldCheck className="w-3.5 h-3.5" />First-party</span>}
        </p>
        {app.description && <p className="text-slate-400 text-xs mt-1 max-w-sm">{app.description}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mb-4">
        <div className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase bg-slate-50 rounded-t-xl">This will allow the app to:</div>
        {scopes.map((s) => (
          <div key={s.id} className={`flex items-start gap-3 px-4 py-3 ${s.sensitive ? 'bg-amber-50/60' : ''}`}>
            <Lock className={`w-4 h-4 mt-0.5 shrink-0 ${s.sensitive ? 'text-amber-600' : 'text-indigo-500'}`} />
            <div>
              <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                {s.label}
                {s.sensitive && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" />Sensitive</span>}
              </div>
              <div className="text-xs text-slate-500">{s.description}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1 justify-center mb-5">
        <ExternalLink className="w-3.5 h-3.5" />You will be returned to <span className="font-mono text-slate-500">{redirectHost}</span>
      </p>

      <div className="flex gap-3">
        <button onClick={() => decide('deny')} disabled={!!submitting} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50">
          {submitting === 'deny' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Deny'}
        </button>
        <button onClick={() => decide('approve')} disabled={!!submitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50">
          {submitting === 'approve' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Authorize'}
        </button>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-4">Signed in as {user.username || user.email} · Read-only access · You can revoke this anytime in the Developer console.</p>
    </Card>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">{children}</div>;
}
function Card({ children }) {
  return (
    <Centered>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-7 m-4">{children}</div>
    </Centered>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<Centered><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></Centered>}>
      <ConsentInner />
    </Suspense>
  );
}
