'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban, Plus, User, Search, Briefcase, Loader2, AlertTriangle, X,
  ShieldCheck, Trash2, HelpCircle, Share2, Grid, List, RefreshCw, ArrowUpDown,
  ChevronDown, Play, Lightbulb, Pause, Archive, XCircle, CheckCircle2, Info, Tag,
  FolderOpen, Activity
} from 'lucide-react';
import HelpModal from './HelpModal';
import ShareLinksModal from './[id]/ShareLinksModal';
import ProjectCardActions from '../documentation/components/ProjectCardActions';
import PermissionsModal from '../documentation/components/PermissionsModal';
import { canManagePermissions } from '../../lib/projectPermissions';

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
    error:   <AlertTriangle  className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
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
    amber:   'bg-amber-50 text-amber-700',
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
      <div className="space-y-2 mt-4">
        <div className="h-3 bg-gray-100 rounded-md w-full" />
        <div className="h-3 bg-gray-100 rounded-md w-2/3" />
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
        <div className="h-8 bg-gray-100 rounded-md flex-1" />
        <div className="h-8 w-8 bg-gray-100 rounded-md" />
      </div>
    </div>
  );
}

// ─── Project Details Modal ─────────────────────────────────────────────────────

function ProjectDetailsModal({ project, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Project Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-3">
          {[
            ['Name', project.name],
            ['Description', project.description || '—'],
            ['Status', project.status || 'active'],
            ['Super Manager', project.superManager || 'N/A'],
            ['Members', project.members?.length ?? 0],
            ['Created', new Date(project.createdAt).toLocaleString()],
            ['Last Updated', project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4 py-2.5 border-b border-gray-50 last:border-0">
              <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</dt>
              <dd className="text-sm text-gray-800 font-medium">
                {label === 'Status' && STATUS_COLORS[value] ? (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ring-1 ${STATUS_COLORS[value].badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[value].dot}`} />
                    {value}
                  </span>
                ) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ProjectManagementPage = () => {
  const router = useRouter();
  const searchRef = useRef(null);
  const { toasts, toast, dismiss } = useToast();

  const [projects, setProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter/Sort states
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('name_asc');
  const [viewMode, setViewMode] = useState('grid');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [shareModalProjectId, setShareModalProjectId] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Keyboard shortcut: Cmd/Ctrl+K → focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowSortMenu(false);
        setSelectedTag(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsResponse, userResponse] = await Promise.all([
        fetch(`/api/projects?tab=${activeTab}`),
        fetch('/api/auth/me')
      ]);

      if (!projectsResponse.ok) {
        const errorData = await projectsResponse.json();
        throw new Error(errorData.error || 'Failed to fetch projects');
      }
      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Failed to fetch user data');
      }

      const projectsData = await projectsResponse.json();
      const userData = await userResponse.json();

      setProjects(projectsData);
      setCurrentUser(userData.user);
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleStatusChange = async (project, newStatus) => {
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast(`Status updated to ${newStatus}`, 'success');
        fetchInitialData();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
    setDeleteConfirmationName('');
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || deleteConfirmationName !== projectToDelete.name) {
      toast('Project name does not match. Deletion cancelled.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectToDelete._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      toast(`"${projectToDelete.name}" deleted successfully`, 'success');
      setProjects(projects.filter(p => p._id !== projectToDelete._id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (err) {
      toast(err.message, 'error');
    }
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
        fetchInitialData();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update project');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handlePermissions = (project) => {
    setSelectedProject(project);
    setShowPermissionsModal(true);
  };

  const handleDetails = (project) => {
    setSelectedProject(project);
    setShowDetailsModal(true);
  };

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
    const status = p.status || 'active';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const filteredProjects = projects
    .filter(p => {
      const q = searchTerm.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;
      const matchTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));
      const matchTab = activeTab === 'all' || activeTab === 'my';
      return matchSearch && matchStatus && matchTag && matchTab;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':  return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'newest':    return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':    return new Date(a.createdAt) - new Date(b.createdAt);
        case 'status':    return (a.status || 'active').localeCompare(b.status || 'active');
        case 'modified_desc': return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        case 'modified_asc':  return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
        default:          return 0;
      }
    });

  const canCreate = currentUser && !['Intern'].includes(currentUser.role);
  const activeCount = statusCounts['active'] || 0;
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  // ─── Project Card ────────────────────────────────────────────────────────────

  const ProjectCard = ({ project }) => {
    const projectManagers = project.members?.filter(m => m.role === 'Project Manager') || [];
    const otherMembers = project.members?.filter(m => m.role !== 'Project Manager' && m.role !== 'Super Manager') || [];
    const currentStatus = STATUS_COLORS[project.status || 'active'];
    const [menuOpen, setMenuOpen] = useState(false);

    const canManage = currentUser && (
      currentUser.role === 'Admin' ||
      currentUser.role === 'Console admin' ||
      project.superManager === currentUser.username ||
      project.members?.some(m => m.user === currentUser.username && m.role === 'Project Manager')
    );

    return (
      <div className={`group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 flex flex-col justify-between ${menuOpen ? 'z-30' : 'hover:z-20 z-10'}`}>
        {/* Full gradient overlay that fades in on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />
        
        <div className="relative z-10 p-5 flex flex-col flex-grow">
          {/* Status badge */}
          <div className="absolute top-0 right-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-bl-xl rounded-tr-xl text-xs font-semibold ${currentStatus.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
              {project.status || 'active'}
            </span>
          </div>

          {/* Card content */}
          <div className="pr-16 mb-4">
            <div className="flex items-start gap-4 mb-3">
              {project.logo ? (
                <img src={project.logo} alt={`${project.name} logo`} className="h-12 w-12 rounded-xl object-cover flex-shrink-0 shadow-sm border border-gray-100" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-sm flex-shrink-0">
                  <FolderKanban className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="min-w-0 mt-1">
                <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors duration-300">{project.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{project.description || 'No description'}</p>
              </div>
            </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {project.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                  {tag}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{project.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Super Manager */}
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <ShieldCheck className="h-4 w-4 mr-2 text-blue-500" />
            <span className="truncate">{project.superManager || 'N/A'}</span>
          </div>

          {/* Members summary */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User className="h-3.5 w-3.5" />
            <span>{projectManagers.length} PMs, {otherMembers.length} members</span>
          </div>
        </div>
      </div>

        {/* Actions row */}
        <div className="relative z-10 flex gap-2 mt-auto pt-4 border-t border-gray-100/50">
          <button
            onClick={() => router.push(`/project_management/${project._id}`)}
            className="flex-1 text-center bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 text-sm shadow-sm hover:shadow"
          >
            View Project
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setShareModalProjectId(project._id)}
                className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors duration-200"
                title="Share links"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(project)}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors duration-200"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Hover actions dropdown */}
        <div className={`absolute top-3 left-3 z-20 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <ProjectCardActions
            project={project}
            onEdit={handleEditProject}
            onDelete={handleDeleteClick}
            onPermissions={handlePermissions}
            onDetails={handleDetails}
            onStatusChange={handleStatusChange}
            canManagePerms={currentUser && canManagePermissions(currentUser, project)}
            align="left"
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>
    );
  };

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
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3">
            <div className="flex items-center gap-4">
              {/* Brand */}
              <Link href="/console" className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <FolderKanban className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900 text-sm hidden sm:inline tracking-tight">Projects</span>
              </Link>

              <div className="w-px h-5 bg-gray-200 hidden sm:block" />

              {/* Search */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search projects…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-20 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all outline-none"
                />
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm('')}
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
                {/* Activity */}
                <Link
                  href="/project_management/activity"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">Activity</span>
                </Link>

                {/* New Project */}
                {canCreate && (
                  <Link href="/project_management/create">
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">New Project</span>
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
          {/* Page header row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Project Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Oversee all your ongoing projects
              </p>
            </div>

            {/* Summary pills */}
            {!loading && (
              <div className="flex flex-wrap items-center gap-2">
                <StatPill value={projects.length} label="projects" color="blue" />
                <StatPill value={activeCount}     label="active"   color="emerald" />
              </div>
            )}
          </div>

          {/* Tab navigation */}
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`${activeTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  All Projects
                </button>
                <button
                  onClick={() => setActiveTab('my')}
                  className={`${activeTab === 'my' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  My Projects
                </button>
              </nav>
            </div>
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
                    {count > 0 && (
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
                  {allTags.slice(0, 10).map(tag => {
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
                  {allTags.length > 10 && (
                    <span className="text-xs text-gray-400 px-2">+{allTags.length - 10} more</span>
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
                onClick={fetchInitialData}
                title="Refresh"
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-700 hover:text-red-900">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Projects grid/list */}
          {loading ? (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
            }>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className={`animate-fade-in ${viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
            }`}>
              {filteredProjects.map(project => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <FolderOpen className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800">No projects found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm
                  ? `Nothing matched "${searchTerm}"`
                  : selectedTag
                  ? `No projects with tag "${selectedTag}" found`
                  : statusFilter !== 'all'
                  ? `No ${statusFilter} projects found`
                  : activeTab === 'my'
                  ? 'You are not part of any projects yet'
                  : 'Get started by creating a new project'
                }
              </p>
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSelectedTag(null); }}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </main>

        {/* Delete Modal */}
        {showDeleteModal && projectToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-red-600">Delete Project</h2>
                <button onClick={() => setShowDeleteModal(false)} className="text-gray-500 hover:text-gray-800">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="text-center">
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <p className="text-gray-700 mb-4">
                  This action is irreversible and can lead to permanent data loss.
                </p>
                <p className="text-gray-700 font-semibold mb-4">
                  To confirm, type the project name: <span className="font-bold text-red-700">{projectToDelete.name}</span>
                </p>
                <input
                  type="text"
                  value={deleteConfirmationName}
                  onChange={(e) => setDeleteConfirmationName(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-lg mb-6 focus:border-red-500 focus:ring-red-500"
                  placeholder="Project name"
                />
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmationName !== projectToDelete.name}
                  className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors duration-200"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && selectedProject && (
          <PermissionsModal
            project={selectedProject}
            isOpen={showPermissionsModal}
            onClose={() => {
              setShowPermissionsModal(false);
              setSelectedProject(null);
            }}
            onUpdate={() => {
              fetchInitialData();
            }}
          />
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedProject && (
          <ProjectDetailsModal
            project={selectedProject}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedProject(null);
            }}
          />
        )}

        {/* Help Modal */}
        <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

        {/* Share Links Modal */}
        {shareModalProjectId && (
          <ShareLinksModal
            projectId={shareModalProjectId}
            onClose={() => setShareModalProjectId(null)}
          />
        )}

        {/* Floating Help Button */}
        {!showHelp && (
          <button
            onClick={() => setShowHelp(true)}
            aria-label="Help"
            className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none z-30"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        )}

        {/* Click-away for dropdowns */}
        {showSortMenu && (
          <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)} />
        )}

        {/* Toast container */}
        <Toast toasts={toasts} dismiss={dismiss} />
      </div>
    </>
  );
};

export default ProjectManagementPage;