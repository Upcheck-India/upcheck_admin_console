'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Folder, Users, AlertCircle, Info, UploadCloud,
  Trash2, CheckCircle2, ChevronDown, Search, UserPlus,
  Tag, XCircle
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'shelved',   label: 'Shelved',   description: 'Not started yet',          dot: 'bg-slate-400'   },
  { value: 'active',    label: 'Active',    description: 'Currently in development', dot: 'bg-emerald-500' },
  { value: 'ideation',  label: 'Ideation',  description: 'In planning phase',        dot: 'bg-violet-500'  },
  { value: 'paused',    label: 'Paused',    description: 'Temporarily on hold',      dot: 'bg-amber-500'   },
];

const PROJECT_ROLES = ['Project Manager', 'Contributor', 'Viewer'];

const ROLE_COLORS = {
  'Project Manager': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Contributor':     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Viewer':          'bg-gray-100 text-gray-600 ring-gray-200',
};

// ─── User Search Dropdown ─────────────────────────────────────────────────────

function UserPicker({ allUsers, addedUsernames, currentUserEmail, currentUsername, onSelect, selectedUser, setSelectedUser }) {
  const [query, setQuery]     = useState('');
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  const filtered = allUsers.filter(u =>
    // Exclude already-added members AND the current logged-in user (by email or username)
    !addedUsernames.has(u.username) &&
    u.email !== currentUserEmail &&
    u.username !== currentUsername &&
    (u.username.toLowerCase().includes(query.toLowerCase()) ||
     u.email.toLowerCase().includes(query.toLowerCase()))
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const choose = (user) => {
    onSelect(user);
    setQuery(user.username);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Search users…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
        />
      </div>

      {open && query.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-44 overflow-y-auto z-30 animate-menu-in">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No users found</p>
          ) : (
            filtered.slice(0, 8).map(user => (
              <button
                key={user._id}
                type="button"
                onClick={() => choose(user)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
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

// ─── Logo Uploader ────────────────────────────────────────────────────────────

function LogoUploader({ logoFile, logoPreview, logoUrl, onFileChange, onUrlChange, onClear }) {
  const dropRef  = useRef(null);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFileChange(file);
  };

  if (logoPreview) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden shrink-0 shadow-sm">
          <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{logoFile?.name || 'Custom URL'}</p>
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 mt-1.5 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div
        ref={dropRef}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragging ? 'border-blue-400 bg-blue-50/60 scale-[1.01]' : 'border-gray-200 bg-gray-50/60 hover:border-blue-300 hover:bg-blue-50/20'
        }`}
      >
        <UploadCloud className={`w-7 h-7 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-xs text-gray-500">
          <span className="text-blue-600 font-medium">Click to upload</span> or drag &amp; drop
        </p>
        <p className="text-[10px] text-gray-400">PNG, JPG, GIF · max 10 MB</p>
        <input ref={inputRef} type="file" accept="image/*" onChange={e => onFileChange(e.target.files[0])} className="hidden" />
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">URL</span>
        <input
          type="text"
          value={logoUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
        />
      </div>
    </div>
  );
}

// ─── Tag Input Component ──────────────────────────────────────────────────────

function TagInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-h-[48px] cursor-text"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
        >
          <Tag className="w-3 h-3" />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
          >
            <XCircle className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Add tags (press Enter or comma to add)" : ""}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  );
}

// ─── CreateProjectModal ───────────────────────────────────────────────────────

export default function CreateProjectModal({ isOpen, onClose, onSuccess, currentUser = null }) {
  const [formData, setFormData] = useState({ name: '', description: '', status: 'shelved', logoUrl: '', tags: [] });
  const [logoFile, setLogoFile]       = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [members, setMembers]         = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [memberError, setMemberError] = useState('');
  const nameRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', description: '', status: 'shelved', logoUrl: '', tags: [] });
      setLogoFile(null); setLogoPreview(null);
      setMembers([]); setSelectedUser(null);
      setSelectedRole('Contributor');
      setError(''); setSuccess(false); setMemberError('');
      setTimeout(() => nameRef.current?.focus(), 100);
      fetchUsers();
    }
  }, [isOpen]);

  // Logo preview
  useEffect(() => {
    if (logoFile) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(logoFile);
    } else if (formData.logoUrl) {
      setLogoPreview(formData.logoUrl);
    } else {
      setLogoPreview(null);
    }
  }, [logoFile, formData.logoUrl]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, loading, onClose]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?limit=500');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch { /* silent */ }
  };

  const patch = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const currentUserEmail = currentUser?.email || null;
  const currentUsername  = currentUser?.username || null;

  const handleAddMember = () => {
    setMemberError('');
    if (!selectedUser) return setMemberError('Please select a user first.');
    // Guard: cannot add yourself (matched by email or username)
    if (
      selectedUser.email === currentUserEmail ||
      selectedUser.username === currentUsername
    ) {
      return setMemberError("You can't add yourself — you're already the project owner.");
    }
    if (members.some(m => m.user === selectedUser.username))
      return setMemberError('This user is already added.');
    setMembers(prev => [...prev, {
      user: selectedUser.username,
      email: selectedUser.email,
      role: selectedRole,
    }]);
    setSelectedUser(null);
  };

  const handleRemoveMember = (username) => {
    setMembers(prev => prev.filter(m => m.user !== username));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError('Project name is required.');

    try {
      setLoading(true);
      setError('');
      let uploadedLogoUrl = formData.logoUrl;

      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
        if (uploadRes.ok) {
          const result = await uploadRes.json();
          uploadedLogoUrl = result.filePath;
        } else {
          throw new Error('Logo upload failed.');
        }
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          status: formData.status,
          logo: uploadedLogoUrl,
          members,
          tags: formData.tags,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess(data);
          onClose();
        }, 900);
      } else {
        setError(data.error || 'Failed to create project.');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addedUsernames = new Set(members.map(m => m.user));

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      >
        <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Folder className="w-4.5 h-4.5 text-blue-600 w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">New Project Space</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sets up documentation &amp; project management</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Info banner */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  This space will also appear in Project Management where you can track tasks and team activity.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={formData.name}
                  onChange={e => patch('name', e.target.value)}
                  placeholder="e.g. Mobile App Redesign"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description <span className="text-gray-300 font-normal normal-case">optional</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => patch('description', e.target.value)}
                  placeholder="What is this project about?"
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Initial Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATUS_OPTIONS.map(opt => {
                    const active = formData.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patch('status', opt.value)}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                          active
                            ? 'border-blue-400 bg-blue-50/80 shadow-sm'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                          <span className={`text-xs font-semibold ${active ? 'text-blue-700' : 'text-gray-700'}`}>
                            {opt.label}
                          </span>
                        </div>
                        <span className="block text-[10px] text-gray-400 leading-tight">{opt.description}</span>
                        {active && (
                          <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Logo <span className="text-gray-300 font-normal normal-case">optional</span>
                </label>
                <LogoUploader
                  logoFile={logoFile}
                  logoPreview={logoPreview}
                  logoUrl={formData.logoUrl}
                  onFileChange={setLogoFile}
                  onUrlChange={val => { patch('logoUrl', val); setLogoFile(null); }}
                  onClear={() => { setLogoFile(null); setLogoPreview(null); patch('logoUrl', ''); }}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Tags <span className="text-gray-300 font-normal normal-case">optional</span>
                </label>
                <TagInput
                  tags={formData.tags}
                  onChange={(newTags) => patch('tags', newTags)}
                />
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Press Enter or comma to add a tag. Tags help you search and filter projects.
                </p>
              </div>

              {/* Members */}
              <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Members</span>
                  {members.length > 0 && (
                    <span className="ml-auto text-[10px] text-gray-400 font-medium">{members.length} added</span>
                  )}
                </div>

                {/* User picker row */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <UserPicker
                    allUsers={allUsers}
                    addedUsernames={addedUsernames}
                    currentUserEmail={currentUserEmail}
                    currentUsername={currentUsername}
                    onSelect={setSelectedUser}
                    selectedUser={selectedUser}
                    setSelectedUser={setSelectedUser}
                  />

                  {/* Role picker + Add button row */}
                  <div className="flex gap-2 sm:contents">
                  <div className="relative flex-1 sm:flex-none sm:w-36 shrink-0">
                    <select
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value)}
                      className="w-full appearance-none pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
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
                    <UserPlus className="w-4 h-4" />
                  </button>
                  </div> {/* end mobile role+button row */}
                </div>

                {memberError && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {memberError}
                  </p>
                )}

                {/* Member list */}
                {members.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {members.map(member => (
                      <div
                        key={member.user}
                        className="flex items-center gap-3 bg-white border border-gray-100 px-3 py-2 rounded-xl"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {member.user.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{member.user}</p>
                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 shrink-0 ${ROLE_COLORS[member.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                          {member.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.user)}
                          className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {members.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No members added yet — you'll be the owner.</p>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || success}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:cursor-not-allowed ${
                  success
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
              >
                {success ? (
                  <><CheckCircle2 className="w-4 h-4" /> Created!</>
                ) : loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}