'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import {
  Clock, Calendar, Users, FileText, AlertCircle, X, User, Mail,
  Loader2, Eye, ChevronLeft, ChevronRight, RefreshCw, Shield,
  Tag, LayoutGrid, Layers,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Backlog:       { label: 'Backlog',      color: 'bg-slate-100 text-slate-600 border-slate-200',      dot: 'bg-slate-400' },
  'To Do':       { label: 'To Do',        color: 'bg-sky-50 text-sky-700 border-sky-200',             dot: 'bg-sky-500' },
  'In Progress': { label: 'In Progress',  color: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  Done:          { label: 'Done',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

const TYPE_CONFIG = {
  Feature: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  Bug:     { bg: 'bg-red-100',    text: 'text-red-700' },
  Chore:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  Epic:    { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const ORDERED_STATUSES = ['Backlog', 'To Do', 'In Progress', 'Done'];

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, settings }) {
  const typeConfig = TYPE_CONFIG[task.type] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };

  return (
    <div className="group bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-800 leading-snug flex-1 min-w-0">
          {task.title}
        </h4>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${typeConfig.bg} ${typeConfig.text}`}>
          <Tag className="h-2.5 w-2.5" />
          {task.type}
        </span>
      </div>

      {settings.showDescriptions !== false && task.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {(settings.showDueDates !== false || (task.assignees && task.assignees.length > 0)) && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          {settings.showDueDates !== false && task.dueDate ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          ) : <span />}

          {task.assignees && task.assignees.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 flex-shrink-0" />
              {settings.showUserNames
                ? task.assignees.map(a => a.username ?? 'Anonymous').join(', ')
                : `${task.assignees.length} assignee${task.assignees.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VisitorModal ─────────────────────────────────────────────────────────────

function VisitorModal({ onSubmit }) {
  const [info, setInfo] = useState({ name: '', email: '' });
  const canSubmit = info.name.trim() !== '' && info.email.trim() !== '';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={() => onSubmit(null)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Welcome</h3>
            <p className="text-sm text-slate-500 mt-0.5">Help the team know who's visiting</p>
          </div>
          <button
            onClick={() => onSubmit(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={info.name}
                onChange={e => setInfo(prev => ({ ...prev, name: e.target.value }))}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Jane Smith"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={info.email}
                onChange={e => setInfo(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="jane@company.com"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSubmit(null)}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onSubmit(info)}
            disabled={!canSubmit}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-3">
          <Shield className="h-3 w-3 inline mr-1" />
          Optional — your info is only shared with the project team
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicSharePage() {
  const params = useParams();
  const slug = params?.slug;

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shareLink, setShareLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [availableViews, setAvailableViews] = useState([]);
  const [selectedView, setSelectedView] = useState(null);
  const [showVisitorModal, setShowVisitorModal] = useState(true);
  const selectedViewRef = useRef(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSharedProject = useCallback(async (silent = false) => {
    if (!slug) return false;
    try {
      if (!silent) setLoading(true);
      setError(null);

      const res = await fetch(`/api/share/s/${slug}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setExpired(true);
          setError('This share link has expired');
        } else if (res.status === 404) {
          setError('Share link not found or inactive');
        } else {
          setError(data.error ?? 'Failed to load shared project');
        }
        setLoading(false);
        return false;
      }

      setProject(data.project);
      setSprints(data.sprints);
      setTasks(data.tasks);
      setShareLink(data.shareLink);

      const views = [];
      if (data.includeProductBoard === true) {
        views.push({ id: 'backlog', name: 'Product Board', type: 'backlog' });
      }
      data.sprints.forEach(sprint => {
        views.push({ id: sprint._id, name: sprint.name, type: 'sprint' });
      });
      setAvailableViews(views);

      if (views.length > 0 && !selectedViewRef.current) {
        selectedViewRef.current = views[0].id;
        setSelectedView(views[0].id);
      }

      if (data.shareLink?.expiresAt) {
        updateCountdown(new Date(data.shareLink.expiresAt));
      }

      setLoading(false);
      return true;
    } catch {
      setError('Failed to load shared project');
      setLoading(false);
      return false;
    }
  }, [slug]);

  useEffect(() => {
    fetchSharedProject();
  }, [fetchSharedProject]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!expired) fetchSharedProject(true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [expired, fetchSharedProject]);

  // ── Countdown ──────────────────────────────────────────────────────────────

  const updateCountdown = (end) => {
    const diff = end.getTime() - Date.now();
    if (diff <= 0) { setExpired(true); setTimeLeft('Expired'); return; }
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    setTimeLeft(d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`);
  };

  useEffect(() => {
    if (!shareLink?.expiresAt) return;
    updateCountdown(new Date(shareLink.expiresAt));
    const t = setInterval(() => updateCountdown(new Date(shareLink.expiresAt)), 60_000);
    return () => clearInterval(t);
  }, [shareLink?.expiresAt]);

  // ── Visitor tracking ───────────────────────────────────────────────────────

  const handleVisitorSubmit = async (info) => {
    setShowVisitorModal(false);
    if (!info) return;
    try {
      await fetch(`/api/share/s/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      });
    } catch {
      // silently ignore
    }
  };

  // ── View helpers ───────────────────────────────────────────────────────────

  const getFilteredTasks = useCallback(() => {
    if (selectedView === 'backlog') return tasks.filter(t => !t.sprintId);
    return tasks.filter(t => t.sprintId === selectedView);
  }, [tasks, selectedView]);

  const getCurrentViewName = () =>
    availableViews.find(v => v.id === selectedView)?.name ?? '';

  const currentViewIndex = availableViews.findIndex(v => v.id === selectedView);

  const navigateView = (dir) => {
    if (dir === 'prev' && currentViewIndex > 0) {
      const id = availableViews[currentViewIndex - 1].id;
      selectedViewRef.current = id;
      setSelectedView(id);
    } else if (dir === 'next' && currentViewIndex < availableViews.length - 1) {
      const id = availableViews[currentViewIndex + 1].id;
      selectedViewRef.current = id;
      setSelectedView(id);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSharedProject(false);
    setRefreshing(false);
  };

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-9 w-9 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 animate-pulse">Loading project…</p>
      </div>
    );
  }

  if (error || expired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {expired ? 'Link Expired' : 'Not Available'}
          </h1>
          <p className="text-sm text-slate-500">{error}</p>
          {shareLink?.expiresAt && (
            <p className="text-xs text-slate-400 mt-3">
              Expired on {new Date(shareLink.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!project) return null;

  const filteredTasks = getFilteredTasks();
  const settings = shareLink?.settings ?? {};
  const currentSprint = selectedView && selectedView !== 'backlog'
    ? sprints.find(s => s._id === selectedView)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Head>
        <title>{project.name} — Shared Project</title>
        <meta name="description" content={`Viewing shared project: ${project.name}`} />
        <meta name="robots" content="noindex" />
      </Head>

      {showVisitorModal && <VisitorModal onSubmit={handleVisitorSubmit} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-900 truncate">{project.name}</h1>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : project.status === 'paused'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {project.status ?? 'Active'}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{project.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                {shareLink?.name && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {shareLink.name}
                  </span>
                )}
                {timeLeft && (
                  <span className={`flex items-center gap-1 font-medium ${
                    timeLeft === 'Expired' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    <Clock className="h-3.5 w-3.5" />
                    {timeLeft}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── View Navigation ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {availableViews.map(view => (
                <button
                  key={view.id}
                  onClick={() => {
                    selectedViewRef.current = view.id;
                    setSelectedView(view.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    selectedView === view.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {view.type === 'backlog'
                    ? <LayoutGrid className="h-3.5 w-3.5" />
                    : <Layers className="h-3.5 w-3.5" />}
                  {view.name}
                </button>
              ))}
            </div>

            {availableViews.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigateView('prev')}
                  disabled={currentViewIndex <= 0}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous view"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateView('next')}
                  disabled={currentViewIndex >= availableViews.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next view"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {currentSprint && (
            <div className="mt-4 inline-flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm shadow-sm">
              <span className="font-semibold text-slate-800">{currentSprint.name}</span>
              {(currentSprint.startDate || currentSprint.endDate) && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {currentSprint.startDate && new Date(currentSprint.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {currentSprint.endDate && (
                    <> — {new Date(currentSprint.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>
                  )}
                </span>
              )}
              <span className="text-slate-500">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ── Kanban Board ────────────────────────────────────────────────── */}
        {availableViews.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No views have been shared in this link.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {ORDERED_STATUSES.map(status => {
              const config = STATUS_CONFIG[status];
              const columnTasks = filteredTasks.filter(t => t.status === status);
              return (
                <div key={status} className="flex flex-col">
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${config.color}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide">{config.label}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums opacity-70">{columnTasks.length}</span>
                  </div>

                  <div className="flex-1 bg-slate-100/70 rounded-b-xl border border-t-0 border-slate-200 p-3 space-y-3 min-h-[120px]">
                    {columnTasks.map(task => (
                      <TaskCard key={task._id} task={task} settings={settings} />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-xs text-slate-400 select-none">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>Read-only shared view · Some details may be hidden per share settings</span>
          {shareLink?.expiresAt && timeLeft && timeLeft !== 'Expired' && (
            <span className="flex items-center gap-1 text-amber-500">
              <Clock className="h-3.5 w-3.5" /> Link expires in {timeLeft}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}