'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Mail, UserCheck, AlertCircle, Loader2,
  Shield, User, Crown, ChevronDown, Search, X, CheckCircle2, XCircle
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_ROLES = ['Project Manager', 'Contributor', 'Viewer'];

const ROLE_META = {
  'Project Manager': { badge: 'bg-blue-50 text-blue-700 ring-blue-200',    icon: Shield },
  'Contributor':     { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: User   },
  'Viewer':          { badge: 'bg-gray-100 text-gray-600 ring-gray-200',   icon: User   },
};

// ─── Inline toast ─────────────────────────────────────────────────────────────

function Banner({ type, message, onDismiss }) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error:   'bg-red-50 border-red-200 text-red-700',
    info:    'bg-blue-50 border-blue-100 text-blue-700',
  };
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    error:   <XCircle      className="w-4 h-4 shrink-0" />,
    info:    <AlertCircle  className="w-4 h-4 shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl text-sm ${styles[type]}`}>
      {icons[type]}
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── User Search Picker ───────────────────────────────────────────────────────
// Fully controlled: selectedUser is the source of truth from the parent.
// The input shows the selected user's name when confirmed, or the live search query otherwise.

function UserPicker({ availableUsers, selectedUser, onSelect, onClear }) {
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const ref   = useRef(null);
  const input = useRef(null);

  // When parent clears the selection (e.g. after Add), reset our local query too
  useEffect(() => {
    if (!selectedUser) setQuery('');
  }, [selectedUser]);

  const filtered = availableUsers.filter(u =>
    u.username.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const choose = (user) => {
    onSelect(user);
    setQuery('');   // clear search text; the confirmed chip takes over display
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery('');
    setOpen(false);
    setTimeout(() => input.current?.focus(), 50);
  };

  // What to show: if a user is confirmed, show their chip instead of the raw input
  if (selectedUser) {
    return (
      <div className="flex-1 flex items-center gap-2 pl-3 pr-2 py-2 border border-blue-400 bg-blue-50 rounded-xl ring-2 ring-blue-500/20">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {selectedUser.username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800 truncate leading-tight">{selectedUser.username}</p>
          <p className="text-[10px] text-blue-500 truncate leading-tight">{selectedUser.email}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-0.5 rounded-md text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={input}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={availableUsers.length === 0 ? 'All users already added' : 'Search by name or email…'}
          disabled={availableUsers.length === 0}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (query.length > 0 || availableUsers.length <= 6) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-52 overflow-y-auto z-30 animate-menu-in">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {query ? `No users match "${query}"` : 'No available users'}
            </p>
          ) : (
            filtered.slice(0, 8).map(user => (
              <button
                key={user._id}
                type="button"
                // Use onMouseDown so it fires before the input's onBlur closes the dropdown
                onMouseDown={e => { e.preventDefault(); choose(user); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50 transition-colors text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ member, isOwner, onRoleChange, onRemove }) {
  const meta = ROLE_META[member.role] || ROLE_META['Viewer'];
  const RoleIcon = meta.icon;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
      isOwner ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-white hover:border-gray-200'
    }`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
        isOwner
          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
          : 'bg-gradient-to-br from-gray-400 to-gray-500'
      }`}>
        {member.user?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{member.user}</p>
          {isOwner && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
              <Crown className="w-2.5 h-2.5" /> Owner
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{member.email}</p>
      </div>

      {/* Role */}
      {isOwner ? (
        <span className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 shrink-0 ${meta.badge}`}>
          <RoleIcon className="w-3 h-3" />
          {member.role || 'Super Manager'}
        </span>
      ) : (
        <div className="relative shrink-0">
          <select
            value={member.role}
            onChange={e => onRoleChange(member._id, e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-medium text-gray-700"
          >
            {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Remove */}
      {!isOwner && (
        <button
          type="button"
          onClick={() => onRemove(member._id)}
          title="Remove member"
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── ProjectMembers ───────────────────────────────────────────────────────────

export default function ProjectMembers({ project, onMembersUpdate, currentUser = null }) {
  const [members,      setMembers]      = useState(project?.members || []);
  const [allUsers,     setAllUsers]     = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [error,        setError]        = useState(null);
  const [memberError,  setMemberError]  = useState('');
  const [banner,       setBanner]       = useState(null); // { type, message }
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [notifyNew,    setNotifyNew]    = useState(true);
  const [pendingRemove, setPendingRemove] = useState(null); // member._id pending confirm

  // Sync with parent
  useEffect(() => {
    if (project?.members) setMembers(project.members);
  }, [project?.members]);

  // Fetch users
  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  // Auto-dismiss banner
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  // The project super manager / owner — identified by project.superManager field
  const ownerUsername = project?.superManager || currentUser?.username;

  // Users not yet in the members list AND not the owner
  const availableUsers = allUsers.filter(u =>
    u.username !== ownerUsername &&
    !members.some(m => m.user === u.username || String(m._id) === String(u._id))
  );

  const handleAddMember = useCallback(() => {
    setMemberError('');
    if (!selectedUser) return setMemberError('Please search and select a user first.');
    if (selectedUser.username === ownerUsername)
      return setMemberError('The project owner is already included automatically.');
    if (members.some(m => m.user === selectedUser.username))
      return setMemberError('This user is already a member.');

    setMembers(prev => [...prev, {
      _id:   selectedUser._id,
      user:  selectedUser.username,
      email: selectedUser.email,
      role:  selectedRole,
    }]);
    // Reset picker — setting null triggers the UserPicker's useEffect to clear its query
    setSelectedUser(null);
    setSelectedRole('Contributor');
    setMemberError('');
  }, [selectedUser, selectedRole, members, ownerUsername]);

  const handleRoleChange = useCallback((memberId, newRole) => {
    setMembers(prev => prev.map(m =>
      String(m._id) === String(memberId) ? { ...m, role: newRole } : m
    ));
  }, []);

  // Soft-confirm remove: first click sets pendingRemove, second confirms
  const handleRemove = useCallback((memberId) => {
    if (pendingRemove === memberId) {
      setMembers(prev => prev.filter(m => String(m._id) !== String(memberId)));
      setPendingRemove(null);
    } else {
      setPendingRemove(memberId);
      // Auto-cancel after 3s if not confirmed
      setTimeout(() => setPendingRemove(null), 3000);
    }
  }, [pendingRemove]);

  const sendNotification = async (user, projectName) => {
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject: `You've been added to: ${projectName}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#1f2937;">Welcome to ${projectName}!</h2>
              <p>Hi ${user.username},</p>
              <p>You've been added to <strong>${projectName}</strong> on Upcheck.</p>
              <p>You can now access the project from your dashboard.</p>
              <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
              <p style="color:#6b7280;font-size:14px;">The Upcheck Team</p>
            </div>
          `,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setBanner(null);

    try {
      const originalUsernames = new Set((project?.members || []).map(m => m.user));
      const newMembers = members.filter(m => !originalUsernames.has(m.user));

      if (notifyNew && newMembers.length > 0) {
        const usersToNotify = allUsers.filter(u =>
          newMembers.some(nm => nm.user === u.username)
        );
        await Promise.all(usersToNotify.map(u => sendNotification(u, project?.name || 'Project')));
      }

      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });

      if (!res.ok) throw new Error('Failed to update members.');

      setBanner({ type: 'success', message: 'Team members updated successfully.' });
      if (typeof onMembersUpdate === 'function') onMembersUpdate(members);
    } catch (err) {
      setBanner({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        <p className="text-sm text-gray-400">Loading team members…</p>
      </div>
    );
  }

  // Separate owner row from regular members for rendering
  const ownerRecord = members.find(m => m.user === ownerUsername) || {
    _id: 'owner', user: ownerUsername, email: currentUser?.email || '', role: 'Super Manager'
  };
  const regularMembers = members.filter(m => m.user !== ownerUsername);

  return (
    <>
      <style>{`
        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Team Members</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {members.length + (ownerRecord ? 0 : 1)} member{members.length !== 1 ? 's' : ''} · 1 owner
            </p>
          </div>
        </div>

        {/* ── Banners ── */}
        {error && <Banner type="error" message={error} onDismiss={() => setError(null)} />}
        {banner && <Banner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />}

        {/* ── Add member panel ── */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Member</p>

          <div className="flex flex-col sm:flex-row gap-2">
            <UserPicker
              availableUsers={availableUsers}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onClear={() => setSelectedUser(null)}
            />

            <div className="flex gap-2 sm:contents">
              {/* Role picker */}
              <div className="relative flex-1 sm:flex-none sm:w-40 shrink-0">
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                >
                  {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleAddMember}
                disabled={!selectedUser}
                className="flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {memberError && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" /> {memberError}
            </p>
          )}
        </div>

        {/* ── Member list ── */}
        <div className="space-y-2">
          {/* Owner — always shown, always first */}
          {ownerUsername && (
            <MemberRow
              member={ownerRecord}
              isOwner={true}
              onRoleChange={() => {}}
              onRemove={() => {}}
            />
          )}

          {/* Regular members */}
          {regularMembers.length === 0 && !ownerUsername && (
            <div className="text-center py-10 text-gray-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No members added yet.</p>
            </div>
          )}

          {regularMembers.map(member => (
            <div key={member._id || member.user}>
              {pendingRemove === member._id && (
                <div className="flex items-center justify-between px-4 py-2 mb-1 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <span>Click remove again to confirm removing <strong>{member.user}</strong></span>
                  <button onClick={() => setPendingRemove(null)} className="text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <MemberRow
                member={member}
                isOwner={false}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            </div>
          ))}
        </div>

        {/* ── Save bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
          {/* Email notify toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setNotifyNew(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${notifyNew ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifyNew ? 'translate-x-4' : ''}`} />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              Notify new members by email
            </div>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><UserCheck className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}