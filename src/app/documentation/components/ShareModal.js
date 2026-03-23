'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Link2, Clock, Lock, Copy, Check, Trash2,
  AlertCircle, Eye, EyeOff, CheckCircle2, XCircle,
  Shield, RefreshCw, Users, Search, Mail, Info, Loader2
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { value: '1h',    label: '1 hour',        seconds: 3600    },
  { value: '24h',   label: '24 hours',      seconds: 86400   },
  { value: '7d',    label: '7 days',        seconds: 604800  },
  { value: '30d',   label: '30 days',       seconds: 2592000 },
  { value: 'never', label: 'Never expires', seconds: null    },
];

const AUTOSAVE_DELAY = 800; // ms to wait after last change before saving
const MIN_PASSWORD_LENGTH = 4; // don't autosave a half-typed password below this

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Banner({ type, message, onDismiss }) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error:   'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info:    'bg-blue-50 border-blue-100 text-blue-700',
  };
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />,
    error:   <XCircle      className="w-4 h-4 shrink-0 mt-0.5" />,
    warning: <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5" />,
    info:    <Info         className="w-4 h-4 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 border rounded-xl text-sm ${styles[type]}`}>
      {icons[type]}
      <p className="flex-1 leading-relaxed">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Compact autosave status shown in the footer
function SaveStatus({ status }) {
  // status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  if (status === 'idle')    return null;
  if (status === 'pending') return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
      Unsaved changes
    </span>
  );
  if (status === 'saving')  return (
    <span className="flex items-center gap-1.5 text-xs text-blue-500">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      Saving…
    </span>
  );
  if (status === 'saved')   return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Saved
    </span>
  );
  if (status === 'error')   return (
    <span className="flex items-center gap-1.5 text-xs text-red-500">
      <XCircle className="w-3.5 h-3.5" />
      Save failed
    </span>
  );
  return null;
}

function Toggle({ checked, onChange, color = 'blue', disabled = false }) {
  const on = checked && !disabled;
  const bg = on ? (color === 'amber' ? 'bg-amber-500' : 'bg-blue-500') : 'bg-gray-200';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 ${bg} ${
        color === 'amber' ? 'focus:ring-amber-400' : 'focus:ring-blue-400'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
        on ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

function ExpiryButton({ opt, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
        active ? 'border-blue-400 bg-blue-50/80 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <Clock className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-500' : 'text-gray-400'}`} />
      <span className={`text-xs font-semibold truncate ${active ? 'text-blue-700' : 'text-gray-600'}`}>
        {opt.label}
      </span>
      {active && <Check className="w-3 h-3 text-blue-500 ml-auto shrink-0" />}
    </button>
  );
}

function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl animate-menu-in">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      <p className="text-xs text-red-700 flex-1">Permanently delete this share link?</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">Delete</button>
        <button onClick={onCancel}  className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function AccessOption({ active, onClick, icon, iconBg, iconColor, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
        active ? 'border-blue-400 bg-blue-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
        active ? 'border-blue-500' : 'border-gray-300'
      }`}>
        {active && <span className="w-2 h-2 rounded-full bg-blue-500" />}
      </div>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${active ? 'text-blue-900' : 'text-gray-800'}`}>{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

// ─── ShareModal ───────────────────────────────────────────────────────────────

export default function ShareModal({ isOpen, onClose, file, projectId }) {
  const [loading,       setLoading]       = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [shareData,     setShareData]     = useState(null);
  const [banner,        setBanner]        = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus,    setSaveStatus]    = useState('idle'); // 'idle'|'pending'|'saving'|'saved'|'error'

  // Access mode: 'anyone-with-link' | 'members'
  const [accessMode,      setAccessMode]      = useState('anyone-with-link');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [emailSelected,   setEmailSelected]   = useState([]);
  const [sendEmail,       setSendEmail]       = useState(false);
  const [sendingEmail,    setSendingEmail]    = useState(false);
  const [memberSearch,    setMemberSearch]    = useState('');

  const [allMembers,  setAllMembers]  = useState([]);
  const [orgMembers,  setOrgMembers]  = useState([]);

  const [expiry,          setExpiry]          = useState('24h');
  const [requirePassword, setRequirePassword] = useState(false);
  const [sharePassword,   setSharePassword]   = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [passwordError,   setPasswordError]   = useState('');

  // ── Refs for race-condition-free autosave ─────────────────────────────────

  const createdForRef    = useRef(null);
  const copiedTimerRef   = useRef(null);
  const debounceTimerRef = useRef(null);
  const saveVersionRef   = useRef(0);       // increments on every save attempt
  const shareDataRef     = useRef(null);    // always current shareData without stale closure
  const isInitialLoad    = useRef(true);    // suppress autosave on first load

  // Keep shareDataRef in sync
  useEffect(() => { shareDataRef.current = shareData; }, [shareData]);

  // ── Settings snapshot for autosave ────────────────────────────────────────
  // Collect the current settings so the debounced save always reads latest values
  const settingsRef = useRef({});
  useEffect(() => {
    settingsRef.current = {
      accessMode, selectedMembers, expiry, requirePassword, sharePassword,
    };
  }, [accessMode, selectedMembers, expiry, requirePassword, sharePassword]);

  // ── Core autosave function ────────────────────────────────────────────────

  const executeSave = useCallback(async (version) => {
    const token = shareDataRef.current?.token;
    if (!token) return;

    const s = settingsRef.current;

    // Skip if password is enabled but too short to be intentional
    if (s.requirePassword && s.sharePassword.trim().length > 0 &&
        s.sharePassword.trim().length < MIN_PASSWORD_LENGTH) {
      return;
    }
    // Block save if password is required but completely empty
    if (s.requirePassword && !s.sharePassword.trim()) {
      setPasswordError('Enter a password (min 4 characters) or disable password protection.');
      setSaveStatus('idle');
      return;
    }
    setPasswordError('');
    setSaveStatus('saving');

    try {
      const expiryOpt = EXPIRY_OPTIONS.find(e => e.value === s.expiry);
      const res = await fetch(`/api/share/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: s.accessMode === 'anyone-with-link',
          expirySeconds: expiryOpt?.seconds ?? null,
          allowedMembers: s.accessMode === 'members' ? s.selectedMembers : [],
          requirePassword: s.requirePassword,
          password: s.requirePassword ? s.sharePassword.trim() : null,
        }),
      });

      // Ignore stale responses — a newer save has already been dispatched
      if (version !== saveVersionRef.current) return;

      if (res.ok) {
        const data = await res.json();
        setShareData(data);
        setSaveStatus('saved');
        // Fade 'Saved' back to idle after 3s
        setTimeout(() => setSaveStatus(v => v === 'saved' ? 'idle' : v), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        setBanner({ type: 'error', message: d.error || 'Autosave failed — click to retry.' });
        setSaveStatus('error');
      }
    } catch {
      if (version !== saveVersionRef.current) return;
      setBanner({ type: 'error', message: 'Network error during autosave.' });
      setSaveStatus('error');
    }
  }, []);

  // ── Schedule autosave (debounced) ─────────────────────────────────────────
  // Call this after any settings change. It cancels any pending save and
  // schedules a fresh one AUTOSAVE_DELAY ms in the future.

  const scheduleAutosave = useCallback(() => {
    if (!shareDataRef.current) return;       // no token yet — initial link creation in progress
    if (isInitialLoad.current) return;       // suppress on first mount

    setSaveStatus('pending');
    clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const version = ++saveVersionRef.current;
      executeSave(version);
    }, AUTOSAVE_DELAY);
  }, [executeSave]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    saveVersionRef.current++;          // invalidate any in-flight saves
    isInitialLoad.current = true;

    setShareData(null);
    setAccessMode('anyone-with-link');
    setSelectedMembers([]);
    setEmailSelected([]);
    setSendEmail(false);
    setMemberSearch('');
    setExpiry('24h');
    setRequirePassword(false);
    setSharePassword('');
    setShowPassword(false);
    setPasswordError('');
    setBanner(null);
    setSaveStatus('idle');
    setConfirmDelete(false);
  }, []);

  // ── Init on open ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || !file) return;
    if (createdForRef.current !== file._id) {
      createdForRef.current = file._id;
      resetState();
      createShareLink();
    }
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen) {
      createdForRef.current = null;
      clearTimeout(copiedTimerRef.current);
      clearTimeout(debounceTimerRef.current);
    }
  }, [isOpen]);

  // Fetch org users
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOrgMembers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [isOpen]);

  // Fetch project members
  useEffect(() => {
    if (!isOpen || !projectId || projectId === 'general') return;
    fetch(`/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setAllMembers(p.members || []); })
      .catch(() => {});
  }, [isOpen, projectId]);

  // ── Autosave trigger — watches every settings field ───────────────────────
  // Runs after every change to any setting. Skipped on initial load.

  useEffect(() => {
    if (isInitialLoad.current) return;
    scheduleAutosave();
  }, [accessMode, selectedMembers, expiry, requirePassword]);

  // Password autosave: only trigger when it reaches MIN_PASSWORD_LENGTH
  // or is fully cleared. Prevents saving every single keystroke.
  useEffect(() => {
    if (isInitialLoad.current) return;
    const len = sharePassword.trim().length;
    if (!requirePassword) { scheduleAutosave(); return; }
    if (len === 0 || len >= MIN_PASSWORD_LENGTH) scheduleAutosave();
    // else: still typing, hold off
  }, [sharePassword, requirePassword]);

  // ── Member list ───────────────────────────────────────────────────────────

  const allAvailableMembers = useMemo(() => {
    const map = new Map();
    allMembers.forEach(m => {
      if (m.email) map.set(m.email, { email: m.email, user: m.user || m.email, role: m.role || null });
    });
    orgMembers.forEach(u => {
      if (u.email && !map.has(u.email))
        map.set(u.email, { email: u.email, user: u.username || u.email, role: null });
    });
    return Array.from(map.values());
  }, [allMembers, orgMembers]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return allAvailableMembers;
    return allAvailableMembers.filter(m =>
      m.user.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [allAvailableMembers, memberSearch]);

  // ── Access mode change ────────────────────────────────────────────────────

  const handleAccessModeChange = (mode) => {
    setAccessMode(mode);
    if (mode === 'anyone-with-link') {
      setSelectedMembers([]);
      setEmailSelected([]);
    }
  };

  const isMemberBased = accessMode === 'members';

  // ── Member toggles ────────────────────────────────────────────────────────

  const toggleRestrict = (email) => {
    setSelectedMembers(prev => {
      if (prev.includes(email)) {
        setEmailSelected(ep => ep.filter(e => e !== email));
        return prev.filter(e => e !== email);
      }
      return [...prev, email];
    });
  };

  const toggleEmailNotify = (email) => {
    setEmailSelected(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
      setEmailSelected([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.email));
    }
  };

  const emailEligible  = filteredMembers.filter(m => selectedMembers.includes(m.email));
  const allEmailSelected = emailEligible.length > 0 &&
    emailEligible.every(m => emailSelected.includes(m.email));

  const toggleEmailAll = () => {
    const emails = emailEligible.map(m => m.email);
    if (allEmailSelected) setEmailSelected(prev => prev.filter(e => !emails.includes(e)));
    else setEmailSelected(prev => [...new Set([...prev, ...emails])]);
  };

  // ── API ───────────────────────────────────────────────────────────────────

  const shareUrl = shareData?.token ? `${getOrigin()}/shared/${shareData.token}` : '';

  const createShareLink = async () => {
    setLoading(true); setBanner(null);
    try {
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: file._id,
          isPublic: accessMode === 'anyone-with-link',
          allowedMembers: accessMode === 'members' ? selectedMembers : [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareData(data);
        // Allow autosave to kick in after initial load is "done"
        setTimeout(() => { isInitialLoad.current = false; }, 100);
      } else {
        const d = await res.json();
        setBanner({ type: 'error', message: d.error || 'Failed to create share link.' });
      }
    } catch { setBanner({ type: 'error', message: 'Network error. Please try again.' }); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    clearTimeout(debounceTimerRef.current);
    saveVersionRef.current++;
    try {
      const res = await fetch(`/api/share/${shareData.token}/delete`, { method: 'DELETE' });
      if (res.ok) { onClose(); return; }
      const d = await res.json();
      setBanner({ type: 'error', message: d.error || 'Failed to delete share link.' });
    } catch { setBanner({ type: 'error', message: 'Error deleting share link.' }); }
    setConfirmDelete(false);
  };

  const sendEmailNotifications = async () => {
    if (!emailSelected.length) return;
    setSendingEmail(true);
    const expiryLabel = expiry === 'never'
      ? 'does not expire'
      : `expires in ${EXPIRY_OPTIONS.find(e => e.value === expiry)?.label}`;
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailSelected,
          subject: `Shared file: ${file.name}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#1f2937">A file has been shared with you</h2>
            <p>You have been given access to: <strong>${file.name}</strong></p>
            <p><a href="${shareUrl}" style="display:inline-block;padding:10px 22px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open File</a></p>
            ${requirePassword ? `<p style="color:#6b7280;font-size:14px">Password: <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px">${sharePassword}</code></p>` : ''}
            <p style="color:#9ca3af;font-size:13px;margin-top:16px">This link ${expiryLabel}.</p>
          </div>`,
        }),
      });
      if (!res.ok) throw new Error();
      setBanner({ type: 'success', message: `Invite${emailSelected.length > 1 ? 's' : ''} sent to ${emailSelected.length} member${emailSelected.length > 1 ? 's' : ''}.` });
      setEmailSelected([]);
      setSendEmail(false);
    } catch {
      const sub  = encodeURIComponent(`Shared file: ${file.name}`);
      const body = encodeURIComponent(`Access: ${shareUrl}${requirePassword ? `\nPassword: ${sharePassword}` : ''}`);
      window.open(`mailto:${emailSelected.join(',')}?subject=${sub}&body=${body}`, '_blank');
    }
    setSendingEmail(false);
  };

  const copyToClipboard = useCallback(async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const el = Object.assign(document.createElement('textarea'), {
        value: shareUrl, style: 'position:fixed;opacity:0'
      });
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!isOpen || !file) return null;

  const allFilteredSelected = filteredMembers.length > 0 &&
    filteredMembers.every(m => selectedMembers.includes(m.email));

  const isSaving = saveStatus === 'saving' || saveStatus === 'pending';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform:translateY(10px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.22s cubic-bezier(0.16,1,0.3,1); }
        @keyframes menu-in {
          from { opacity:0; transform:translateY(-4px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-menu-in { animation: menu-in 0.15s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="animate-modal-in bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Link2 className="w-[18px] h-[18px] text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 leading-tight">Share File</h3>
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{file.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">

            {banner && <Banner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />}

            {/* Share link */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Share Link</label>
              {loading && !shareData ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  <p className="text-sm text-gray-400">Generating link…</p>
                </div>
              ) : shareData ? (
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl min-w-0">
                    <span className="text-xs text-gray-500 truncate font-mono">{shareUrl}</span>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                      copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                  </button>
                  <button
                    onClick={() => { createdForRef.current = null; resetState(); createShareLink(); }}
                    title="Regenerate link — invalidates the old one"
                    disabled={loading || isSaving}
                    className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              ) : null}
            </div>

            {shareData && (
              <>
                {/* ── WHO CAN ACCESS ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                    Who can access this link?
                  </label>
                  <div className="space-y-2">
                    <AccessOption
                      active={accessMode === 'anyone-with-link'}
                      onClick={() => handleAccessModeChange('anyone-with-link')}
                      icon={<Link2 className="w-4 h-4" />}
                      iconBg="bg-blue-50" iconColor="text-blue-600"
                      title="Anyone with the link"
                      desc="No sign-in required. Anyone who has this link can access."
                    />
                    <AccessOption
                      active={accessMode === 'members'}
                      onClick={() => handleAccessModeChange('members')}
                      icon={<Shield className="w-4 h-4" />}
                      iconBg="bg-violet-50" iconColor="text-violet-600"
                      title="Specific members only"
                      desc="Only the members you select below can open this link."
                    />
                  </div>
                </div>

                {/* ── MEMBER PANEL — only in member mode ── */}
                {isMemberBased && allAvailableMembers.length > 0 && (
                  <div className="border border-violet-200 rounded-2xl overflow-hidden">

                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100 bg-violet-50/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="w-3.5 h-3.5 shrink-0 text-violet-600" />
                        <span className="text-xs font-semibold text-gray-600 truncate">Select who can access</span>
                        {selectedMembers.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full shrink-0">
                            {selectedMembers.length} selected
                          </span>
                        )}
                        {sendEmail && emailSelected.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full shrink-0">
                            {emailSelected.length} to notify
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {filteredMembers.length > 1 && (
                          <button
                            onClick={toggleSelectAll}
                            className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                          >
                            {allFilteredSelected ? 'Deselect all' : 'Select all'}
                          </button>
                        )}
                        {sendEmail && emailEligible.length > 1 && (
                          <button
                            onClick={toggleEmailAll}
                            className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
                          >
                            {allEmailSelected ? 'Unnotify all' : 'Notify all'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search */}
                    {allAvailableMembers.length > 5 && (
                      <div className="px-3 py-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={e => setMemberSearch(e.target.value)}
                            placeholder="Search by name or email…"
                            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                          />
                          {memberSearch && (
                            <button onClick={() => setMemberSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Member rows */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                      {filteredMembers.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-5">No members match "{memberSearch}"</p>
                      ) : filteredMembers.map(member => {
                        const restricted = selectedMembers.includes(member.email);
                        const emailed    = emailSelected.includes(member.email);
                        const canEmail   = restricted;

                        return (
                          <div
                            key={member.email}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                              restricted ? 'bg-violet-50/40' : 'bg-white hover:bg-gray-50/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleRestrict(member.email)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                restricted ? 'bg-violet-500 border-violet-500' : 'border-gray-300 hover:border-violet-400'
                              }`}
                            >
                              {restricted && <Check className="w-2.5 h-2.5 text-white" />}
                            </button>

                            <Avatar name={member.user} />

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate leading-tight">{member.user}</p>
                              <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                            </div>

                            {member.role && (
                              <span className="text-[10px] text-gray-400 shrink-0 hidden sm:inline">{member.role}</span>
                            )}

                            {sendEmail && (
                              <button
                                type="button"
                                onClick={() => canEmail && toggleEmailNotify(member.email)}
                                disabled={!canEmail}
                                title={canEmail ? 'Toggle email notification' : 'Grant access first'}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all shrink-0 ${
                                  emailed
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : canEmail
                                      ? 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                                      : 'opacity-30 cursor-not-allowed bg-gray-50 text-gray-400'
                                }`}
                              >
                                <Mail className="w-3 h-3" />
                                <span className="hidden sm:inline">{emailed ? 'Notify ✓' : 'Notify'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Email footer */}
                    <div className="flex items-center gap-3 px-4 py-3 border-t border-violet-100 bg-violet-50/20">
                      <Mail className={`w-3.5 h-3.5 shrink-0 ${sendEmail ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">
                          {sendEmail ? 'Email selected members when sent' : 'Send email notifications'}
                        </p>
                        {sendEmail && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Tick "Notify" next to each member. Only members with access can receive emails.
                          </p>
                        )}
                      </div>
                      <Toggle
                        checked={sendEmail}
                        onChange={v => { setSendEmail(v); if (!v) setEmailSelected([]); }}
                        color="blue"
                      />
                    </div>
                  </div>
                )}

                {isMemberBased && selectedMembers.length === 0 && (
                  <Banner
                    type="warning"
                    message="No members selected — the link is currently open to anyone. Select at least one member to restrict access."
                  />
                )}

                {/* ── EXPIRY ── */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <Clock className="w-3.5 h-3.5" /> Link Expiry
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {EXPIRY_OPTIONS.slice(0, 3).map(opt => (
                      <ExpiryButton key={opt.value} opt={opt} active={expiry === opt.value} onClick={() => setExpiry(opt.value)} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {EXPIRY_OPTIONS.slice(3).map(opt => (
                      <ExpiryButton key={opt.value} opt={opt} active={expiry === opt.value} onClick={() => setExpiry(opt.value)} />
                    ))}
                  </div>
                </div>

                {/* ── PASSWORD ── */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  requirePassword ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-gray-50/60'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${requirePassword ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        <Lock className={`w-4 h-4 ${requirePassword ? 'text-amber-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Password Required</p>
                        <p className="text-xs text-gray-500">Works with all access modes</p>
                      </div>
                    </div>
                    <Toggle checked={requirePassword} onChange={v => { setRequirePassword(v); setPasswordError(''); }} color="amber" />
                  </div>

                  {requirePassword && (
                    <div className="mt-3">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={sharePassword}
                          onChange={e => { setSharePassword(e.target.value); setPasswordError(''); }}
                          placeholder={`Enter a password (min ${MIN_PASSWORD_LENGTH} characters)`}
                          className={`w-full pl-3.5 pr-10 py-2.5 text-sm border rounded-xl outline-none transition-all ${
                            passwordError
                              ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                              : 'border-amber-200 bg-white focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400'
                          }`}
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordError
                        ? <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{passwordError}</p>
                        : sharePassword.length >= MIN_PASSWORD_LENGTH
                          ? <p className="text-xs text-amber-600 mt-1">Share this password separately with recipients.</p>
                          : sharePassword.length > 0
                            ? <p className="text-xs text-gray-400 mt-1">{MIN_PASSWORD_LENGTH - sharePassword.length} more character{MIN_PASSWORD_LENGTH - sharePassword.length > 1 ? 's' : ''} to autosave</p>
                            : null
                      }
                    </div>
                  )}
                </div>

                {confirmDelete && <DeleteConfirm onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          {shareData && (
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 bg-gray-50/70 shrink-0">
              {/* Left: delete + autosave status */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={confirmDelete || isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
                <SaveStatus status={saveStatus} />
              </div>

              {/* Right: Send email (only shown when email toggle is on and members are selected to notify) */}
              {sendEmail && emailSelected.length > 0 ? (
                <button
                  onClick={sendEmailNotifications}
                  disabled={sendingEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {sendingEmail
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                    : <><Mail className="w-4 h-4" />Send {emailSelected.length} Invite{emailSelected.length > 1 ? 's' : ''}</>
                  }
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}