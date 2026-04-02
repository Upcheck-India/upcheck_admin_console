'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Shield, Users, Lock, AlertTriangle, CheckCircle2,
  Save, Loader2, ChevronDown, ChevronUp, Info, XCircle
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_ROLES = ['Console admin', 'Admin', 'Member', 'Intern'];

// Roles that always have full access — their permissions cannot be restricted
const LOCKED_FULL_ACCESS = new Set(['Console admin', 'Admin']);

const PERMISSION_PRESETS = [
  {
    value: 'full',
    label: 'Full Access',
    description: 'Read, write and download everything',
    readScope: 'all', writeScope: 'all', downloadScope: 'all',
    badge: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'write',
    label: 'Contributor',
    description: 'Read all, edit and download own files',
    readScope: 'all', writeScope: 'own', downloadScope: 'own',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'read_all',
    label: 'Viewer',
    description: 'Read and download all files, no editing',
    readScope: 'all', writeScope: 'none', downloadScope: 'all',
    badge: 'bg-teal-100 text-teal-700',
  },
  {
    value: 'read_own',
    label: 'Restricted',
    description: 'Can only read and download own files',
    readScope: 'own', writeScope: 'own', downloadScope: 'own',
    badge: 'bg-gray-100 text-gray-600',
  },
  {
    value: 'no_download',
    label: 'No Download',
    description: 'Can read all but cannot download or edit',
    readScope: 'all', writeScope: 'none', downloadScope: 'none',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'no_access',
    label: 'No Access',
    description: 'Cannot read, write, or download anything',
    readScope: 'none', writeScope: 'none', downloadScope: 'none',
    badge: 'bg-red-100 text-red-700',
  },
];

const DEFAULT_ROLE_PERMISSIONS = {
  'Console admin': 'full',
  'Admin':         'full',
  'Member':        'read_own',  // Read, write, download own files (default for General space)
  'Intern':        'no_access', // No access by default
};

function presetForRole(role) {
  const key = DEFAULT_ROLE_PERMISSIONS[role] || 'no_access';
  return PERMISSION_PRESETS.find(p => p.value === key) || PERMISSION_PRESETS[5];
}

function presetFromScopes(perms) {
  if (!perms) return PERMISSION_PRESETS[5]; // no_access
  return PERMISSION_PRESETS.find(
    p => p.readScope === perms.readScope &&
         p.writeScope === perms.writeScope &&
         p.downloadScope === perms.downloadScope
  ) || null; // null = custom (no exact match)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScopeSelect({ label, value, options, onChange, disabled }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
              value === opt.value
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PermissionsModal ─────────────────────────────────────────────────────────

export default function PermissionsModal({ project, isOpen, onClose, onUpdate, isGeneralSpace = false }) {
  // For General space, always use roles_based mode
  const [accessMode,       setAccessMode]       = useState(isGeneralSpace ? 'roles_based' : 'members_only');
  const [allowedRoles,     setAllowedRoles]      = useState([]);
  const [rolePermissions,  setRolePermissions]   = useState({});
  const [expandedRole,     setExpandedRole]      = useState(null);
  const [loading,          setLoading]           = useState(false);
  const [fetching,         setFetching]          = useState(false);
  const [error,            setError]             = useState(null);
  const [saveSuccess,      setSaveSuccess]       = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track initial state for unsaved-changes detection
  const initialStateRef = useRef(null);
  const abortRef        = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchPermissions = useCallback(async () => {
    if (!project?._id) return;
    // Bug fix: abort stale in-flight fetches when modal reopens
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setFetching(true);
    setError(null);
    setHasUnsavedChanges(false);

    try {
      const res = await fetch(`/api/projects/${project._id}/permissions`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      const data = await res.json();
      const s = data.permissionSettings || {};
      setAccessMode(s.accessMode || 'members_only');
      setAllowedRoles(s.allowedRoles || []);
      setRolePermissions(s.rolePermissions || {});
      initialStateRef.current = JSON.stringify({ accessMode: s.accessMode, allowedRoles: s.allowedRoles, rolePermissions: s.rolePermissions });
    } catch (err) {
      if (err.name !== 'AbortError') setError('Failed to load permissions.');
    } finally {
      setFetching(false);
    }
  }, [project?._id]);

  useEffect(() => {
    if (isOpen && project) {
      fetchPermissions();
      setSaveSuccess(false);
      setExpandedRole(null);
    }
    return () => abortRef.current?.abort();
  }, [isOpen, project, fetchPermissions]);

  // Escape to close (but not while saving)
  useEffect(() => {
    if (!isOpen) return;
    const handler = e => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, loading, onClose]);

  // Track unsaved changes by comparing to initial snapshot
  useEffect(() => {
    if (!initialStateRef.current) return;
    const current = JSON.stringify({ accessMode, allowedRoles, rolePermissions });
    setHasUnsavedChanges(current !== initialStateRef.current);
  }, [accessMode, allowedRoles, rolePermissions]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAccessModeChange = (mode) => {
    setAccessMode(mode);
    if (mode === 'members_only') {
      // Clear role selections when switching back
      setAllowedRoles([]);
      setExpandedRole(null);
    }
  };

  const handleRoleToggle = (role) => {
    setAllowedRoles(prev => {
      if (prev.includes(role)) {
        // Bug fix: when deselecting, collapse and clean up permissions for that role
        if (expandedRole === role) setExpandedRole(null);
        return prev.filter(r => r !== role);
      }
      // Add default permissions when first selecting a role
      if (!rolePermissions[role]) {
        const preset = presetForRole(role);
        setRolePermissions(p => ({
          ...p,
          [role]: { readScope: preset.readScope, writeScope: preset.writeScope, downloadScope: preset.downloadScope },
        }));
      }
      return [...prev, role];
    });
  };

  const applyPreset = (role, preset) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { readScope: preset.readScope, writeScope: preset.writeScope, downloadScope: preset.downloadScope },
    }));
  };

  const handleScopeChange = (role, field, value) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  };

  // Bug fix: strip permissions for roles not in allowedRoles before saving
  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    // Only save permissions for currently selected roles
    const cleanedPermissions = {};
    allowedRoles.forEach(role => {
      if (rolePermissions[role]) cleanedPermissions[role] = rolePermissions[role];
    });

    try {
      const res = await fetch(`/api/projects/${project._id}/permissions`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          permissionSettings: { accessMode, allowedRoles, rolePermissions: cleanedPermissions },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaveSuccess(true);
        setHasUnsavedChanges(false);
        initialStateRef.current = JSON.stringify({ accessMode, allowedRoles, rolePermissions: cleanedPermissions });
        if (typeof onUpdate === 'function') onUpdate(data.permissionSettings);
        setTimeout(() => { setSaveSuccess(false); onClose(); }, 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to update permissions.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const allRolesSelected = allowedRoles.length === AVAILABLE_ROLES.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform:translateY(10px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.2s cubic-bezier(0.16,1,0.3,1); }
        @keyframes slide-in {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .animate-slide-in { animation: slide-in 0.15s ease-out; }
      `}</style>

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      >
        <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Shield className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-900 leading-tight">Project Permissions</h2>
                <p className="text-xs text-gray-400 truncate">{project?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasUnsavedChanges && !loading && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-slide-in">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={() => { if (!loading) onClose(); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">

            {fetching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                <p className="text-sm text-gray-400">Loading permissions…</p>
              </div>
            ) : (
              <>
                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-slide-in">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="flex-1">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* ── Access mode ── */}
                {!isGeneralSpace && (
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      <Lock className="w-3.5 h-3.5" /> Who can access this project?
                    </label>

                    <div className="space-y-2">
                      {[
                        {
                          value: 'members_only',
                          icon: <Users className="w-4 h-4" />,
                          title: 'Members Only',
                          desc: 'Only project members (Super Manager and explicitly added members) can access this project.',
                        },
                        {
                          value: 'roles_based',
                          icon: <Shield className="w-4 h-4" />,
                          title: 'Role-Based Access',
                          desc: 'Grant access to all users with specific organization roles. Set different permission levels per role.',
                        },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleAccessModeChange(opt.value)}
                          className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                            accessMode === opt.value
                              ? 'border-blue-400 bg-blue-50/60 shadow-sm'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                            accessMode === opt.value ? 'border-blue-500' : 'border-gray-300'
                          }`}>
                            {accessMode === opt.value && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                          </div>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            accessMode === opt.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {opt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${accessMode === opt.value ? 'text-blue-900' : 'text-gray-800'}`}>
                              {opt.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* General space info banner */}
                {isGeneralSpace && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 leading-relaxed">
                      <span className="font-semibold">General Space</span> uses role-based access. Configure which roles can access and their permission levels below.
                    </div>
                  </div>
                )}

                {/* ── Role selection ── */}
                {accessMode === 'roles_based' && (
                  <>
                    {/* Info banner — positioned near the roles section it relates to */}
                    <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl animate-slide-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700 leading-relaxed">
                        <span className="font-semibold">Role-based access</span> grants access to <em>all users</em> with that org role, not just project members. Console Admin and Admin roles always have full access.
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <Users className="w-3.5 h-3.5" /> Roles with access
                        </label>
                        {/* Select/deselect all */}
                        <button
                          onClick={() => {
                            if (allRolesSelected) {
                              setAllowedRoles([]);
                              setExpandedRole(null);
                            } else {
                              const missing = AVAILABLE_ROLES.filter(r => !allowedRoles.includes(r));
                              const newPerms = { ...rolePermissions };
                              missing.forEach(r => {
                                if (!newPerms[r]) {
                                  const p = presetForRole(r);
                                  newPerms[r] = { readScope: p.readScope, writeScope: p.writeScope, downloadScope: p.downloadScope };
                                }
                              });
                              setRolePermissions(newPerms);
                              setAllowedRoles([...AVAILABLE_ROLES]);
                            }
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {allRolesSelected ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_ROLES.map(role => {
                          const isSelected = allowedRoles.includes(role);
                          const locked     = LOCKED_FULL_ACCESS.has(role);
                          return (
                            <button
                              key={role}
                              onClick={() => !locked && handleRoleToggle(role)}
                              disabled={locked && !isSelected}
                              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                                isSelected && locked
                                  ? 'border-purple-300 bg-purple-50 cursor-default'
                                  : isSelected
                                    ? 'border-blue-400 bg-blue-50/60'
                                    : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {locked ? (
                                  <Lock className="w-3 h-3 text-purple-400 shrink-0" />
                                ) : (
                                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <span className={`text-sm font-medium truncate ${
                                  locked ? 'text-purple-700' : isSelected ? 'text-blue-700' : 'text-gray-700'
                                }`}>
                                  {role}
                                </span>
                              </div>
                              {locked && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full shrink-0">
                                  FULL
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Permission levels per role ── */}
                    {allowedRoles.length > 0 && (
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          <Shield className="w-3.5 h-3.5" /> Permission levels
                        </label>

                        <div className="space-y-2">
                          {allowedRoles.map(role => {
                            const locked      = LOCKED_FULL_ACCESS.has(role);
                            const perms       = rolePermissions[role];
                            const activePreset = locked
                              ? PERMISSION_PRESETS[0]
                              : (presetFromScopes(perms) || null);
                            const isExpanded  = expandedRole === role;

                            return (
                              <div
                                key={role}
                                className={`rounded-xl border-2 overflow-hidden transition-all ${
                                  isExpanded ? 'border-blue-300' : 'border-gray-100'
                                }`}
                              >
                                {/* Role row */}
                                <button
                                  onClick={() => !locked && setExpandedRole(isExpanded ? null : role)}
                                  disabled={locked}
                                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                                    locked ? 'bg-purple-50/60 cursor-default' : 'bg-gray-50 hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {locked && <Lock className="w-3 h-3 text-purple-400 shrink-0" />}
                                    <span className="text-sm font-semibold text-gray-900">{role}</span>
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                      (activePreset || PERMISSION_PRESETS[3]).badge
                                    }`}>
                                      {(activePreset || { label: 'Custom' }).label}
                                    </span>
                                  </div>
                                  {!locked && (
                                    isExpanded
                                      ? <ChevronUp   className="w-4 h-4 text-gray-400" />
                                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>

                                {/* Expanded permission editor */}
                                {isExpanded && !locked && (
                                  <div className="px-4 pb-4 pt-3 bg-white border-t border-gray-100 space-y-4 animate-slide-in">

                                    {/* Preset picker */}
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick preset</p>
                                      <div className="grid grid-cols-1 gap-1.5">
                                        {PERMISSION_PRESETS.map(preset => {
                                          const isActive = activePreset?.value === preset.value;
                                          return (
                                            <button
                                              key={preset.value}
                                              type="button"
                                              onClick={() => applyPreset(role, preset)}
                                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                                isActive
                                                  ? 'border-blue-400 bg-blue-50/60 shadow-sm'
                                                  : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2.5">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${preset.badge}`}>
                                                  {preset.label}
                                                </span>
                                                <span className="text-xs text-gray-500">{preset.description}</span>
                                              </div>
                                              {isActive && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Fine-grained controls */}
                                    <div className="pt-2 border-t border-gray-100 space-y-3">
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                        Fine-tune {activePreset ? '(overrides preset)' : ''}
                                      </p>
                                      <ScopeSelect
                                        label="Read"
                                        value={perms?.readScope || 'own'}
                                        options={[
                                          { value: 'all', label: 'All files' },
                                          { value: 'own', label: 'Own only' },
                                          { value: 'none', label: 'Disabled' },
                                        ]}
                                        onChange={v => handleScopeChange(role, 'readScope', v)}
                                      />
                                      <ScopeSelect
                                        label="Write"
                                        value={perms?.writeScope || 'none'}
                                        options={[
                                          { value: 'all',  label: 'All files' },
                                          { value: 'own',  label: 'Own only'  },
                                          { value: 'none', label: 'Disabled'  },
                                        ]}
                                        onChange={v => handleScopeChange(role, 'writeScope', v)}
                                      />
                                      <ScopeSelect
                                        label="Download"
                                        value={perms?.downloadScope || 'none'}
                                        options={[
                                          { value: 'all',  label: 'All files' },
                                          { value: 'own',  label: 'Own only'  },
                                          { value: 'none', label: 'Disabled'  },
                                        ]}
                                        onChange={v => handleScopeChange(role, 'downloadScope', v)}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bug fix: empty state when roles_based but no roles selected */}
                    {allowedRoles.length === 0 && (
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <Info className="w-4 h-4 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-500">
                          Select at least one role above to grant access. Until then, only project members can access this project.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
            <button
              onClick={() => { if (!loading) onClose(); }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={loading || fetching || saveSuccess}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:cursor-not-allowed ${
                saveSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
              }`}
            >
              {saveSuccess ? (
                <><CheckCircle2 className="w-4 h-4" />Saved!</>
              ) : loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4" />Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}