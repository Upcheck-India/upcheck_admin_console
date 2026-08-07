'use client';

// Developer console for "Upcheck ERP Data OAuth".
// Register & manage first-party applications, verify them, see connected apps,
// and review the audit log. Cookie-authenticated; the server (requireOAuthAdmin)
// is authoritative — this UI mirrors its validation only for fast feedback.
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import { SCOPES } from '../../../lib/oauth/scopes';
import {
  KeyRound, Plus, ShieldCheck, ShieldAlert, Ban, RefreshCw, Trash2, Copy, Check,
  X, ArrowLeft, PlugZap, ScrollText, BookOpen, AlertTriangle, Building2, Loader2,
} from 'lucide-react';

// --- client-side redirect-uri validation (mirror of server rules) ---
function validateRedirect(raw) {
  const v = (raw || '').trim();
  if (!v) return 'Required';
  if (v.includes('*')) return 'No wildcards — register each exact URI';
  let u;
  try { u = new URL(v); } catch { return 'Must be an absolute URL (https://…)'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'Must use https';
  if (u.hash) return 'No fragment (#…) allowed';
  if (u.username || u.password) return 'No credentials in the URL';
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !loopback) return 'https required (http only for localhost)';
  return null;
}

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  revoked: 'bg-rose-50 text-rose-700 border-rose-200',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copied' : label || 'Copy'}
    </button>
  );
}

export default function DeveloperConsolePage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin' || (Array.isArray(user.perms) && user.perms.includes('api.manage')));

  const [tab, setTab] = useState('apps');
  const [apps, setApps] = useState([]);
  const [grants, setGrants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [secretReveal, setSecretReveal] = useState(null); // { client, isRotation }
  const [busyId, setBusyId] = useState('');

  const loadApps = useCallback(async () => {
    const res = await fetch('/api/organization/oauth/clients', { credentials: 'include' });
    if (res.ok) setApps((await res.json()).clients || []);
    else if (res.status === 403 || res.status === 401) setError('You do not have permission to manage the API ecosystem.');
  }, []);
  const loadGrants = useCallback(async () => {
    const res = await fetch('/api/organization/oauth/grants', { credentials: 'include' });
    if (res.ok) setGrants((await res.json()).grants || []);
  }, []);
  const loadAudit = useCallback(async () => {
    const res = await fetch('/api/organization/oauth/audit', { credentials: 'include' });
    if (res.ok) setAudit((await res.json()).entries || []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => { setLoading(true); await Promise.all([loadApps(), loadGrants(), loadAudit()]); setLoading(false); })();
  }, [isAdmin, loadApps, loadGrants, loadAudit]);

  async function doAction(app, action) {
    setBusyId(app.id);
    try {
      let res;
      if (action === 'verify') res = await fetch(`/api/organization/oauth/clients/${app.id}/verify`, { method: 'POST', credentials: 'include' });
      else if (action === 'rotate') res = await fetch(`/api/organization/oauth/clients/${app.id}/secret`, { method: 'POST', credentials: 'include' });
      else if (action === 'suspend' || action === 'activate')
        res = await fetch(`/api/organization/oauth/clients/${app.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action === 'suspend' ? 'suspended' : 'active' }) });
      else if (action === 'revoke') res = await fetch(`/api/organization/oauth/clients/${app.id}`, { method: 'DELETE', credentials: 'include' });
      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        if (action === 'rotate' && data.client?.clientSecret) setSecretReveal({ client: data.client, isRotation: true });
        await loadApps();
      } else {
        const d = await res?.json().catch(() => ({}));
        alert(d?.error || 'Action failed');
      }
    } finally {
      setBusyId('');
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/organization" className="p-2 rounded-lg hover:bg-white/70 text-slate-500"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white"><KeyRound className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Upcheck ERP Data OAuth</h1>
            <p className="text-slate-500 text-sm">Register apps and grant them read-only access to Upcheck ERP data.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-6 mb-6 border-b border-slate-200">
          {[
            { id: 'apps', label: 'Applications', icon: <Building2 className="w-4 h-4" /> },
            { id: 'connected', label: 'Connected apps', icon: <PlugZap className="w-4 h-4" /> },
            { id: 'audit', label: 'Audit log', icon: <ScrollText className="w-4 h-4" /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.icon}{t.label}
            </button>
          ))}
          <Link href="/organization/api/docs" className="ml-auto flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-indigo-700">
            <BookOpen className="w-4 h-4" />Documentation
          </Link>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-indigo-600" /></div>
        ) : tab === 'apps' ? (
          <AppsTab apps={apps} onRegister={() => setShowRegister(true)} onAction={doAction} busyId={busyId} />
        ) : tab === 'connected' ? (
          <ConnectedTab grants={grants} onRevoke={async (g) => { if (confirm(`Disconnect "${g.appName}"? Its tokens will be revoked immediately.`)) { await fetch(`/api/organization/oauth/grants/${g.grantId}`, { method: 'DELETE', credentials: 'include' }); await loadGrants(); } }} />
        ) : (
          <AuditTab audit={audit} />
        )}
      </div>

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onCreated={(client) => { setShowRegister(false); setSecretReveal({ client, isRotation: false }); loadApps(); }}
        />
      )}
      {secretReveal && <SecretRevealModal {...secretReveal} onClose={() => setSecretReveal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AppsTab({ apps, onRegister, onAction, busyId }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{apps.length} application{apps.length === 1 ? '' : 's'} registered</p>
        <button onClick={onRegister} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" />Register application
        </button>
      </div>
      {apps.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No applications yet. Register your first app to issue API access.
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-semibold text-slate-900 truncate">{app.name}</h3>
                    <StatusBadge status={app.status} />
                  </div>
                  {app.description && <p className="text-sm text-slate-500 mt-1">{app.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {app.allowedScopes.map((s) => <code key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s}</code>)}
                  </div>
                  <div className="mt-3 text-xs text-slate-400 font-mono break-all">
                    client_id: <span className="text-slate-600">{app.clientId}</span> · secret ····{app.secretLast4}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Redirect URIs: <span className="text-slate-600">{app.redirectUris.join('  ·  ')}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {app.status === 'pending' && (
                    <ActionBtn onClick={() => onAction(app, 'verify')} busy={busyId === app.id} color="emerald" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Verify</ActionBtn>
                  )}
                  {app.status === 'active' && (
                    <ActionBtn onClick={() => onAction(app, 'suspend')} busy={busyId === app.id} color="orange" icon={<Ban className="w-3.5 h-3.5" />}>Suspend</ActionBtn>
                  )}
                  {app.status === 'suspended' && (
                    <ActionBtn onClick={() => onAction(app, 'activate')} busy={busyId === app.id} color="emerald" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Activate</ActionBtn>
                  )}
                  {app.status !== 'revoked' && (
                    <>
                      <ActionBtn onClick={() => { if (confirm('Rotate the client secret? The current secret stops working for new tokens immediately.')) onAction(app, 'rotate'); }} busy={busyId === app.id} color="slate" icon={<RefreshCw className="w-3.5 h-3.5" />}>Rotate secret</ActionBtn>
                      <ActionBtn onClick={() => { if (confirm(`Revoke "${app.name}"? This permanently disables it and revokes all its tokens.`)) onAction(app, 'revoke'); }} busy={busyId === app.id} color="rose" icon={<Trash2 className="w-3.5 h-3.5" />}>Revoke</ActionBtn>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, busy, color, icon, children }) {
  const colors = {
    emerald: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    orange: 'text-orange-700 border-orange-200 hover:bg-orange-50',
    rose: 'text-rose-700 border-rose-200 hover:bg-rose-50',
    slate: 'text-slate-600 border-slate-200 hover:bg-slate-50',
  };
  return (
    <button disabled={busy} onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-50 ${colors[color]}`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}{children}
    </button>
  );
}

function ConnectedTab({ grants, onRevoke }) {
  if (!grants.length) return <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200"><PlugZap className="w-10 h-10 mx-auto mb-3 opacity-40" />No apps are currently connected.</div>;
  return (
    <div className="space-y-3">
      {grants.map((g) => (
        <div key={g.grantId} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2"><h3 className="font-semibold text-slate-900">{g.appName}</h3><StatusBadge status={g.status} /></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{g.scopes.map((s) => <code key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s}</code>)}</div>
            <p className="text-xs text-slate-400 mt-2">Last used: {g.lastUsedAt ? new Date(g.lastUsedAt).toLocaleString() : '—'}</p>
          </div>
          {g.status === 'active' && (
            <button onClick={() => onRevoke(g)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50">
              <Ban className="w-3.5 h-3.5" />Disconnect
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditTab({ audit }) {
  if (!audit.length) return <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200"><ScrollText className="w-10 h-10 mx-auto mb-3 opacity-40" />No audit entries yet.</div>;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr><th className="text-left px-4 py-2.5 font-medium">When</th><th className="text-left px-4 py-2.5 font-medium">Action</th><th className="text-left px-4 py-2.5 font-medium">Client</th><th className="text-left px-4 py-2.5 font-medium">Actor</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {audit.map((e) => (
            <tr key={e.id} className={e.ok ? '' : 'bg-rose-50/40'}>
              <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{e.at ? new Date(e.at).toLocaleString() : '—'}</td>
              <td className="px-4 py-2.5"><code className="text-xs text-indigo-700">{e.action}</code></td>
              <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{e.clientId || '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{e.actor?.username || e.actor?.email || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RegisterModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [redirects, setRedirects] = useState(['']);
  const [scopes, setScopes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const redirectErrors = redirects.map((r) => (r.trim() ? validateRedirect(r) : null));
  const cleanRedirects = redirects.map((r) => r.trim()).filter(Boolean);
  const canSubmit = name.trim() && cleanRedirects.length > 0 && redirectErrors.every((e) => !e) && scopes.length > 0;

  async function submit() {
    setFormError('');
    if (!canSubmit) { setFormError('Fix the highlighted fields before continuing.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/organization/oauth/clients', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), homepageUrl: homepageUrl.trim(), ownerEmail: ownerEmail.trim(), redirectUris: cleanRedirects, scopes }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.client) onCreated(data.client);
      else setFormError(data.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Register application" wide>
      <div className="space-y-5">
        <Field label="Application name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Upcheck Mobile" className="input" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this app does and why it needs HR data" className="input" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Homepage URL"><input value={homepageUrl} onChange={(e) => setHomepageUrl(e.target.value)} placeholder="https://app.example.com" className="input" /></Field>
          <Field label="Owner email"><input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="team@example.com" className="input" /></Field>
        </div>

        <Field label="Redirect URIs" required
          hint="Where users return after authorizing. Matched EXACTLY — https only (http allowed for localhost), no fragments, no wildcards.">
          <div className="space-y-2">
            {redirects.map((r, i) => (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <input value={r} onChange={(e) => setRedirects(redirects.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://app.example.com/oauth/callback" className={`input ${redirectErrors[i] ? 'border-rose-300' : ''}`} />
                  {redirects.length > 1 && <button onClick={() => setRedirects(redirects.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600"><X className="w-4 h-4" /></button>}
                </div>
                {redirectErrors[i] && <p className="text-xs text-rose-600 mt-1">{redirectErrors[i]}</p>}
              </div>
            ))}
            <button onClick={() => setRedirects([...redirects, ''])} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add another URI</button>
          </div>
        </Field>

        <Field label="Scopes" required hint="What the app may read. Grant the minimum it needs.">
          <div className="space-y-2">
            {SCOPES.map((s) => (
              <label key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${scopes.includes(s.id) ? (s.sensitive ? 'border-amber-300 bg-amber-50/60' : 'border-indigo-300 bg-indigo-50/50') : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={scopes.includes(s.id)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s.id] : scopes.filter((x) => x !== s.id))} className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{s.label}</span>
                    <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{s.id}</code>
                    {s.sensitive && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" />Sensitive</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          The app starts in <b>pending</b> and must be <b>verified</b> by an admin before it can obtain tokens.
        </div>

        {formError && <p className="text-sm text-rose-600">{formError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={!canSubmit || submitting} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Create application
          </button>
        </div>
      </div>
      <style jsx>{`.input{width:100%;border:1px solid #e2e8f0;border-radius:0.75rem;padding:0.6rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:#a5b4fc;box-shadow:0 0 0 3px rgba(99,102,241,.1)}`}</style>
    </Modal>
  );
}

function SecretRevealModal({ client, isRotation, onClose }) {
  return (
    <Modal onClose={onClose} title={isRotation ? 'New client secret' : 'Application created'}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>Copy the client secret now — it is shown <b>once</b> and cannot be retrieved later. Store it somewhere secure.</div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Client ID</label>
          <div className="flex items-center gap-2 mt-1"><code className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-all">{client.clientId}</code><CopyButton value={client.clientId} /></div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Client secret</label>
          <div className="flex items-center gap-2 mt-1"><code className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-all">{client.clientSecret}</code><CopyButton value={client.clientSecret} /></div>
        </div>
        <div className="flex justify-end pt-2"><button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold">I&apos;ve saved it</button></div>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && <span className="text-rose-500"> *</span>}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
