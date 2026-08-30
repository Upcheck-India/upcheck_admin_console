'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';

/**
 * Share-link editor.
 *
 * Audience and protection are presented as two separate questions because they
 * are two separate questions. "Anyone with the link, but tell me your email"
 * and "only these three people, and prove it by signing in" are both real
 * settings; a single combined dropdown cannot express either without lying
 * about the other.
 */

const PERMISSIONS = [
  { id: 'view', label: 'View', hint: 'Open and read in the browser' },
  { id: 'comment', label: 'Comment', hint: 'Leave comments on the document' },
  { id: 'download', label: 'Download', hint: 'Save the original file' },
  { id: 'print', label: 'Print', hint: 'Print a watermarked copy' },
];

const PROTECTIONS = [
  {
    id: 'none',
    label: 'No email needed',
    hint: 'Anyone holding the link opens it. Nothing is recorded about who they are.',
  },
  {
    id: 'collect_email',
    label: 'Collect email',
    hint: 'Ask for an address and record it. Not verified — treat it as a name tag, not proof.',
  },
  {
    id: 'verify_email',
    label: 'Collect and verify email',
    hint: 'Email a one-time code to that address before opening. Proves the address.',
  },
  {
    id: 'external_account',
    label: 'Registered external user',
    hint: 'Requires a signed-in external portal account. The strongest option.',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ShareLinkEditor({ resourceType, resourceId, roomId, onClose }) {
  const [links, setLinks] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '',
    permissions: ['view'],
    audience: 'restricted',
    protection: 'collect_email',
    allowedEmails: [],
    allowedRoles: [],
    allowedUserIds: [],
    expiresAt: '',
  });
  const [emailDraft, setEmailDraft] = useState('');

  const roles = useMemo(
    () => [...new Set(orgUsers.map((u) => u.role).filter(Boolean))].sort(),
    [orgUsers],
  );

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({ resourceType, resourceId });
    const res = await fetch(`/api/dataroom/share?${query}`, { credentials: 'include' });
    if (res.ok) setLinks((await res.json()).shares || []);
  }, [resourceType, resourceId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      refresh(),
      fetch('/api/dataroom/org-users?limit=200', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        // Listing org members is admin-only. A room manager who is not a
        // platform admin can still share by email; they just do not get the
        // member picker.
        .catch(() => ({ users: [] }))
        .then((d) => {
          if (!cancelled) setOrgUsers(d.users || []);
        }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const toggle = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  function addEmail() {
    const addr = emailDraft.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setError('That does not look like an email address.');
      return;
    }
    setError(null);
    setEmailDraft('');
    setForm((f) =>
      f.allowedEmails.includes(addr) ? f : { ...f, allowedEmails: [...f.allowedEmails, addr] },
    );
  }

  async function create(e) {
    e.preventDefault();
    setError(null);

    if (!form.permissions.length) {
      setError('Choose at least one permission.');
      return;
    }
    if (
      form.audience === 'restricted' &&
      !form.allowedEmails.length &&
      !form.allowedRoles.length &&
      !form.allowedUserIds.length
    ) {
      setError('A restricted link needs at least one address, role or member.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/dataroom/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resourceType,
          resourceId,
          roomId,
          ...form,
          expiresAt: form.expiresAt || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Could not create the link.');
        return;
      }

      // The token is shown once, here. It is not stored in component state
      // beyond this panel and the list below never renders it: a share list
      // that prints live tokens hands out working credentials to anyone who
      // can see the screen.
      setCreated(`${window.location.origin}${body.url}`);
      setCopied(false);
      await refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id) {
    await fetch(`/api/dataroom/share/${id}`, { method: 'DELETE', credentials: 'include' });
    await refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface rounded-xl shadow-xl w-full max-w-2xl my-8">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Share link</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={create} className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {created && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm font-medium text-emerald-900 mb-2">
                  Link created. Copy it now — it is not shown again.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={created}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-emerald-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(created);
                      setCopied(true);
                    }}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* ── What the link allows ─────────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">What it allows</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {PERMISSIONS.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p.id)}
                      onChange={() => toggle('permissions', p.id)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                A link cannot grant administration. Re-sharing and re-permissioning stay with
                accounts, not with whoever holds a URL.
              </p>
            </section>

            {/* ── Who it admits ────────────────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Who can use it</h3>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <AudienceCard
                  active={form.audience === 'anyone'}
                  onClick={() => setForm((f) => ({ ...f, audience: 'anyone' }))}
                  icon={<Globe className="w-4 h-4" />}
                  label="Anyone with the link"
                  hint="No list. Anyone who obtains the URL is admitted."
                />
                <AudienceCard
                  active={form.audience === 'restricted'}
                  onClick={() => setForm((f) => ({ ...f, audience: 'restricted' }))}
                  icon={<Users className="w-4 h-4" />}
                  label="Only these people"
                  hint="Named addresses, org roles, or specific members."
                />
              </div>

              {form.audience === 'restricted' && (
                <div className="space-y-4 pl-1 border-l-2 border-blue-100 ml-1 pt-1">
                  <div className="pl-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email addresses
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            // Enter adds an address; it must not submit the
                            // whole form and create the link half-configured.
                            e.preventDefault();
                            addEmail();
                          }
                        }}
                        placeholder="name@company.com"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={addEmail}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {form.allowedEmails.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {form.allowedEmails.map((addr) => (
                          <span
                            key={addr}
                            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                          >
                            {addr}
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  allowedEmails: f.allowedEmails.filter((a) => a !== addr),
                                }))
                              }
                              className="p-0.5 hover:bg-blue-100 rounded-full"
                              aria-label={`Remove ${addr}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {roles.length > 0 && (
                    <div className="pl-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Organisation roles
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggle('allowedRoles', role)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              form.allowedRoles.includes(role)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Satisfied only by a signed-in org account — an email address is a claim,
                        not a membership.
                      </p>
                    </div>
                  )}

                  {orgUsers.length > 0 && (
                    <div className="pl-4 pb-1">
                      <label
                        htmlFor="share-members"
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        Specific members
                      </label>
                      <select
                        id="share-members"
                        multiple
                        size={Math.min(6, orgUsers.length)}
                        value={form.allowedUserIds}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            allowedUserIds: [...e.target.selectedOptions].map((o) => o.value),
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        {orgUsers.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.username} — {u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── What a visitor must prove ────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                What a visitor must provide
              </h3>
              <div className="space-y-2">
                {PROTECTIONS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      form.protection === p.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="protection"
                      checked={form.protection === p.id}
                      onChange={() => setForm((f) => ({ ...f, protection: p.id }))}
                      className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="share-name" className="block text-xs font-medium text-gray-700 mb-1">
                  Label (optional)
                </label>
                <input
                  id="share-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme diligence team"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="share-expires"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Expires (optional)
                </label>
                <input
                  id="share-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create link
            </button>

            {links.length > 0 && (
              <section className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Existing links</h3>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li
                      key={link._id}
                      className="flex items-start justify-between gap-3 p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {link.name || describeAudience(link)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {link.permissions.join(', ')} ·{' '}
                          {PROTECTIONS.find((p) => p.id === link.protection)?.label ||
                            link.protection}{' '}
                          · used {link.accessCount || 0}×
                          {link.revokedAt && ' · revoked'}
                          {!link.revokedAt &&
                            link.expiresAt &&
                            ` · expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {!link.revokedAt && (
                        <button
                          type="button"
                          onClick={() => revoke(link._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                          aria-label="Revoke link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function AudienceCard({ active, onClick, icon, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 border rounded-lg transition-colors ${
        active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
        {icon}
        {label}
      </span>
      <span className="block mt-1 text-xs text-gray-500">{hint}</span>
    </button>
  );
}

function describeAudience(link) {
  if (link.audience === 'anyone') return 'Anyone with the link';
  const parts = [];
  if (link.allowedEmails?.length) parts.push(`${link.allowedEmails.length} address(es)`);
  if (link.allowedRoles?.length) parts.push(link.allowedRoles.join(', '));
  if (link.allowedUserIds?.length) parts.push(`${link.allowedUserIds.length} member(s)`);
  return parts.join(' · ') || 'Restricted';
}
