'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  FileText,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

const PERMISSION_LABELS = {
  view: 'View',
  comment: 'Comment',
  edit: 'Edit',
  download: 'Download',
  print: 'Print',
};

const PROTECTION_BLURB = {
  none: 'This link can be opened by anyone who has it.',
  collect_email: 'Tell us who you are before opening this.',
  verify_email: 'We will email you a code to confirm your address.',
  external_account: 'This link is for registered external users.',
};

export default function SharedResourcePage({ params }) {
  const router = useRouter();
  const { token } = use(params);

  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/dataroom/share/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (ok) setShare(body.share);
        else setError(body.error || 'This share link is not valid.');
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const openResource = useCallback(
    (type, id) => {
      // No token in the URL: the session lives in an httpOnly cookie the
      // access call set. A token in a link is a credential in browser history,
      // in referrer headers, and in whatever the recipient pastes to a
      // colleague.
      const destination = {
        document: `/dataroom/documents/${id}/view`,
        folder: `/dataroom/folders/${id}`,
        room: `/dataroom/rooms/${id}`,
      }[type];
      router.push(destination || '/dataroom');
    },
    [router],
  );

  async function submit(extra = {}) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/dataroom/share/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, email: email || undefined, code: code || undefined, ...extra }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body.codeSent) {
        setCodeSent(true);
        setNotice(`We sent a code to ${email}. It expires in 15 minutes.`);
        return;
      }

      if (!res.ok) {
        setNotice(body.error || 'Could not open this link.');
        return;
      }

      openResource(body.resourceType, body.resourceId);
    } catch {
      setNotice('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-slate-600">Checking this link…</p>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell tone="error">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">This link cannot be opened</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/dataroom/auth-gate"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign in instead
          </Link>
        </div>
      </Shell>
    );
  }

  const returnTo = typeof window === 'undefined' ? '' : window.location.pathname;

  return (
    <Shell>
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{share.resourceName}</h1>
        <p className="text-slate-600">A shared {share.resourceType} in the Upcheck data room</p>
      </div>

      <div className="bg-slate-50 rounded-lg p-6 mb-6 space-y-3">
        <div className="flex items-start gap-2 text-slate-600">
          <Lock className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">You may:</span>
            {share.permissions.map((p) => (
              <span key={p} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm rounded-full">
                {PERMISSION_LABELS[p] || p}
              </span>
            ))}
          </div>
        </div>

        {share.expiresAt && (
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-5 h-5 shrink-0" />
            <span className="font-medium">Expires:</span>
            <span>{new Date(share.expiresAt).toLocaleString()}</span>
          </div>
        )}

        <div className="flex items-start gap-2 text-slate-600">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <span>{PROTECTION_BLURB[share.protection] || PROTECTION_BLURB.none}</span>
        </div>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {share.needsExternalAccount ? (
        <div className="space-y-3">
          <button
            onClick={() => submit()}
            disabled={busy}
            className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium text-lg flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}
            Open
          </button>
          <p className="text-center text-sm text-slate-600">
            Not signed in?{' '}
            <Link
              href={`/dataroom/external/login?redirect=${encodeURIComponent(returnTo)}`}
              className="text-blue-600 hover:underline font-medium"
            >
              Sign in as an external user
            </Link>
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // A `verify_email` link takes two passes: the first asks for a
            // code, the second spends it.
            submit(share.needsCode && !codeSent ? { requestCode: true } : {});
          }}
          className="space-y-4"
        >
          {share.needsEmail && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Your email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={codeSent}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                />
              </div>
            </div>
          )}

          {share.needsCode && codeSent && (
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
                Access code
              </label>
              <input
                id="code"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 tracking-[0.4em] text-center font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium text-lg flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}
            {share.needsCode && !codeSent ? 'Send me a code' : 'Open'}
          </button>

          {share.needsCode && codeSent && (
            <button
              type="button"
              onClick={() => submit({ requestCode: true })}
              disabled={busy}
              className="w-full text-sm text-blue-600 hover:underline disabled:opacity-60"
            >
              Send another code
            </button>
          )}
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        Access through this link is recorded, and it can be revoked at any time.
      </p>
    </Shell>
  );
}

function Shell({ children, tone = 'default' }) {
  const bg =
    tone === 'error'
      ? 'from-red-50 to-orange-50'
      : 'from-blue-50 to-indigo-50';
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-2xl w-full">{children}</div>
    </div>
  );
}
