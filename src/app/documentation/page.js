'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Folder, Plus, Search, Grid, List, LogOut,
  Settings, ChevronDown, FileText, RefreshCw, Home,
  FolderOpen, Upload, SortAsc, X, CheckCircle2,
  AlertCircle, Info, ArrowUpDown, Filter, Link2, Activity, Tag
} from 'lucide-react';
import ProjectSpaceCard from './components/ProjectSpaceCard';
import CreateProjectModal from './components/CreateProjectModal';
import UploadModal from './components/UploadModal';
import ProjectCardActions from './components/ProjectCardActions';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'ideation', label: 'Ideation' },
  { value: 'paused', label: 'Paused' },
  { value: 'shelved', label: 'Shelved' },
  { value: 'archived', label: 'Archived' },
  { value: 'dismissed', label: 'Dismissed' },
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'By status' },
  { value: 'modified_desc', label: 'Last modified (newest)' },
  { value: 'modified_asc', label: 'Last modified (oldest)' },
];

const STATUS_COLORS = {
  active:    { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ideation:  { dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 ring-violet-200'   },
  paused:    { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-200'      },
  shelved:   { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 ring-slate-200'      },
  archived:  { dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-600 ring-gray-200'         },
  dismissed: { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 ring-red-200'            },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts, dismiss }) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    error:   <AlertCircle  className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    info:    <Info         className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 max-w-xs animate-slide-up"
        >
          {icons[t.type] || icons.info}
          <p className="text-sm text-gray-800 leading-snug flex-1">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600 ml-1 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, toast: add, dismiss };
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'gray' }) {
  const colors = {
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet:  'bg-violet-50 text-violet-700',
    gray:    'bg-gray-100 text-gray-600',
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${colors[color]}`}>
      <span>{value}</span>
      <span className="font-normal opacity-75">{label}</span>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-100 rounded-md w-3/5 mb-2" />
          <div className="h-3 bg-gray-100 rounded-md w-4/5" />
        </div>
        <div className="w-16 h-5 bg-gray-100 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentationPage() {
  const router = useRouter();
  const searchRef = useRef(null);
  const { toasts, toast, dismiss } = useToast();

  const [user, setUser]               = useState(null);
  const [projects, setProjects]       = useState([]);
  const [projectStats, setProjectStats] = useState({});
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTag, setSelectedTag]   = useState(null);
  const [sortBy, setSortBy]           = useState('name_asc');
  const [viewMode, setViewMode]       = useState('grid');
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [showUploadModal, setShowUploadModal]       = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal]     = useState(false);
  const [showSortMenu, setShowSortMenu]             = useState(false);
  const [showUserDropdown, setShowUserDropdown]     = useState(false);
  const [selectedProject, setSelectedProject]       = useState(null);

  // Keyboard shortcut: Cmd/Ctrl+K → focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowUserDropdown(false);
        setShowSortMenu(false);
        setSelectedTag(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { fetchUser(); }, []);
  useEffect(() => { if (user) fetchProjects(); }, [user]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) setUser((await res.json()).user);
      else router.push('/login');
    } catch { router.push('/login'); }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setLoading(false);
        fetchProjectStats(data);
      } else setLoading(false);
    } catch { setLoading(false); }
  };

  const fetchProjectStats = async (projectsData) => {
    const fetchWithTimeout = async (url, ms = 5000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(id);
        return res;
      } catch { clearTimeout(id); return null; }
    };

    const toStats = async (projectId) => {
      try {
        const [rRes, fRes] = await Promise.all([
          fetchWithTimeout(`/api/resources?projectId=${projectId}`),
          fetchWithTimeout(`/api/documentation/folders?projectId=${projectId}`),
        ]);
        const resources = rRes?.ok ? await rRes.json() : [];
        const folders   = fRes?.ok ? await fRes.json() : [];
        const hasRecent = Array.isArray(resources) && resources.some(r => {
          const updated = new Date(r.updatedAt || r.createdAt);
          return updated > new Date(Date.now() - 24 * 60 * 60 * 1000);
        });
        return {
          projectId,
          stats: {
            fileCount:   Array.isArray(resources) ? resources.length : 0,
            folderCount: Array.isArray(folders)   ? folders.length   : 0,
            recentActivity: hasRecent,
          },
        };
      } catch {
        return { projectId, stats: { fileCount: 0, folderCount: 0, recentActivity: false } };
      }
    };

    const results = await Promise.all([
      ...projectsData.map(p => toStats(p._id)),
      toStats('general'),
    ]);

    const statsMap = {};
    results.forEach(r => { statsMap[r.projectId] = r.stats; });
    setProjectStats(statsMap);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch { toast('Failed to sign out', 'error'); }
  };

  const handleStatusChange = async (project, newStatus) => {
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast(`Status updated to ${newStatus}`, 'success');
        fetchProjects();
      } else throw new Error();
    } catch { toast('Failed to update status', 'error'); }
  };

  const handleDeleteProject = async (project) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
      if (res.ok) {
        toast(`"${project.name}" deleted`, 'success');
        fetchProjects();
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to delete project', 'error');
      }
    } catch { toast('Failed to delete project', 'error'); }
  };

  const handleEditProject = async (project, updates) => {
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        toast('Project updated', 'success');
        fetchProjects();
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to update project', 'error');
      }
    } catch { toast('Failed to update project', 'error'); }
  };

  const handlePermissions = (project) => { setSelectedProject(project); setShowPermissionsModal(true); };
  const handleDetails     = (project) => { setSelectedProject(project); setShowDetailsModal(true); };

  // ── Filtering + Sorting ──────────────────────────────────────────────────────

  // Collect all unique tags from projects
  const allTags = [...new Set(projects.flatMap(p => p.tags || []))].sort();
  const tagCounts = projects.reduce((acc, p) => {
    (p.tags || []).forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  const statusCounts = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const filteredProjects = projects
    .filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));
      return matchSearch && matchStatus && matchTag;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':  return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'newest':    return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':    return new Date(a.createdAt) - new Date(b.createdAt);
        case 'status':    return (a.status || '').localeCompare(b.status || '');
        case 'modified_desc': return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        case 'modified_asc':  return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
        default:          return 0;
      }
    });

  const canCreate = user && !['Intern'].includes(user.role);
  const totalFiles = Object.values(projectStats).reduce((s, ps) => s + (ps?.fileCount || 0), 0);
  const activeCount = statusCounts['active'] || 0;

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.2s ease-out; }

        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
      `}</style>

      <div className="min-h-screen bg-[#f8f9fb]">

        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3">
            <div className="flex items-center gap-4">

              {/* Brand */}
              <Link href="/console" className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900 text-sm hidden sm:inline tracking-tight">Docs</span>
              </Link>

              <div className="w-px h-5 bg-gray-200 hidden sm:block" />

              {/* Search */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search spaces…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-20 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all outline-none"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
                    ⌘K
                  </kbd>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Share Links */}
                <Link
                  href="/documentation/shares"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share Links</span>
                </Link>

                {/* Activity */}
                <Link
                  href="/documentation/activity"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">Activity</span>
                </Link>

                {/* Upload */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload</span>
                </button>

                {/* New Project */}
                {canCreate && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">New Space</span>
                  </button>
                )}

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(v => !v)}
                    className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 hidden sm:block transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-slide-up">
                      <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                        <p className="font-semibold text-sm text-gray-900">{user?.username}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        <span className="inline-flex mt-1.5 items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full ring-1 ring-blue-200">
                          {user?.role}
                        </span>
                      </div>
                      <Link href="/console" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Home className="w-4 h-4 text-gray-400" /> Console
                      </Link>
                      <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Settings className="w-4 h-4 text-gray-400" /> Settings
                      </Link>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <LogOut className="w-4 h-4" /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">

          {/* Page header row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Project Spaces</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                All your documentation, organized by project
              </p>
            </div>

            {/* Summary pills */}
            {!loading && (
              <div className="flex flex-wrap items-center gap-2">
                <StatPill value={projects.length + 1} label="spaces"  color="blue"    />
                <StatPill value={activeCount}         label="active"  color="emerald" />
                <StatPill value={totalFiles}          label="files"   color="gray"    />
              </div>
            )}
          </div>

          {/* Filter / sort bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            {/* Status filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => {
                const count = f.value === 'all' ? projects.length : (statusCounts[f.value] || 0);
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f.value !== 'all' && STATUS_COLORS[f.value] && (
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/70' : STATUS_COLORS[f.value].dot}`} />
                    )}
                    {f.label}
                    {f.value !== 'all' && count > 0 && (
                      <span className={`${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'} px-1.5 py-0.5 rounded-full text-[10px] font-semibold`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tag filter pills */}
            {allTags.length > 0 && (
              <>
                <div className="w-px h-6 bg-gray-300 hidden sm:block" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      !selectedTag
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    All Tags
                  </button>
                  {allTags.slice(0, 15).map(tag => {
                    const count = tagCounts[tag] || 0;
                    const active = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(active ? null : tag)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Tag className={`w-3 h-3 ${active ? 'text-white' : 'text-emerald-600'}`} />
                        {tag}
                        {count > 0 && (
                          <span className={`${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'} px-1.5 py-0.5 rounded-full text-[10px] font-semibold`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {allTags.length > 15 && (
                    <span className="text-xs text-gray-400 px-2">+{allTags.length - 15} more</span>
                  )}
                </div>
              </>
            )}

            <div className="sm:ml-auto flex items-center gap-2">
              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {currentSortLabel}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-slide-up">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                        className={`flex items-center justify-between w-full px-3.5 py-2 text-xs transition-colors ${
                          sortBy === opt.value
                            ? 'text-blue-600 bg-blue-50 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List view"
                  className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={fetchProjects}
                title="Refresh"
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Cards ── */}
          {loading ? (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
            }>
              {[...Array(7)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className={`animate-fade-in ${viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
            }`}>
              {/* General space — always first */}
              <ProjectSpaceCard
                project={{ _id: 'general', name: 'General', description: 'Shared documents and general files' }}
                stats={projectStats['general'] || { fileCount: 0, folderCount: 0 }}
                isGeneral={true}
              />

              {/* Project spaces */}
              {filteredProjects.map(project => (
                <div key={project._id} className="relative group">
                  <ProjectSpaceCard
                    project={project}
                    stats={projectStats[project._id] || { fileCount: 0, folderCount: 0 }}
                    onStatusChange={handleStatusChange}
                    onSettings={p => router.push(`/project_management/${p._id}`)}
                    onDelete={handleDeleteProject}
                  />
                  <div className="absolute top-3.5 right-3.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ProjectCardActions
                      project={project}
                      onEdit={handleEditProject}
                      onDelete={handleDeleteProject}
                      onPermissions={handlePermissions}
                      onDetails={handleDetails}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Empty states ── */}
          {!loading && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <Folder className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base mb-1">No project spaces yet</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Create your first project space to start organizing documentation.
              </p>
              {canCreate && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> New Space
                </button>
              )}
            </div>
          )}

          {!loading && projects.length > 0 && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <FolderOpen className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800">No results</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery
                  ? `Nothing matched "${searchQuery}"`
                  : selectedTag
                  ? `No projects with tag "${selectedTag}" found`
                  : `No ${statusFilter} projects found`
                }
              </p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSelectedTag(null); }}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </main>

        {/* ── Modals ── */}
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={newProject => {
            toast('Project space created!', 'success');
            fetchProjects();
            router.push(`/documentation/${newProject._id || newProject.insertedId}`);
          }}
        />

        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={() => {
            toast('Files uploaded successfully', 'success');
            fetchProjects();
            setShowUploadModal(false);
          }}
          userProjects={projects}
        />

        {showPermissionsModal && selectedProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPermissionsModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Permissions — {selectedProject.name}</h3>
                <button onClick={() => setShowPermissionsModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4 text-center">
                Permission management coming soon.
              </p>
              <div className="flex justify-end mt-5">
                <button onClick={() => setShowPermissionsModal(false)} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showDetailsModal && selectedProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Project Details</h3>
                <button onClick={() => setShowDetailsModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <dl className="space-y-3">
                {[
                  ['Name', selectedProject.name],
                  ['Description', selectedProject.description || '—'],
                  ['Status', selectedProject.status],
                  ['Super Manager', selectedProject.superManager],
                  ['Members', selectedProject.members?.length ?? 0],
                  ['Created', new Date(selectedProject.createdAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-2.5 border-b border-gray-50 last:border-0">
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</dt>
                    <dd className="text-sm text-gray-800 font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex justify-end mt-5">
                <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Click-away for dropdowns */}
        {(showUserDropdown || showSortMenu) && (
          <div className="fixed inset-0 z-20" onClick={() => { setShowUserDropdown(false); setShowSortMenu(false); }} />
        )}

        {/* Toast container */}
        <Toast toasts={toasts} dismiss={dismiss} />
      </div>
    </>
  );
}