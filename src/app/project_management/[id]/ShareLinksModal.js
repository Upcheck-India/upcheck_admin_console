'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Copy, Link2, Clock, Calendar, Users, FileText, CheckCircle, Trash2,
  Loader2, Eye, ExternalLink, Globe, Monitor, Tablet, Smartphone, Plus,
  ChevronDown, ChevronUp, Shield, LayoutGrid, Layers, AlertTriangle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── VisitorsPanel ────────────────────────────────────────────────────────────

function VisitorsPanel({ shareLink, onClose }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const res = await fetch(`/api/share/s/${shareLink.slug}/visitors`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch visitors');
        const data = await res.json();
        setVisitors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visitors');
      } finally {
        setLoading(false);
      }
    };
    fetchVisitors();
  }, [shareLink.slug]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-100"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Visitors</h2>
            <p className="text-sm text-slate-500">
              {shareLink.name} · {loading ? '…' : `${visitors.length} visit${visitors.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {!loading && !error && visitors.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400 text-sm">No visitors yet</p>
            </div>
          )}
          {!loading && !error && visitors.length > 0 && (
            <div className="space-y-3">
              {visitors.map((visit, i) => (
                <div key={visit._id ?? i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {visit.name || 'Anonymous'}
                      </p>
                      {visit.email && visit.email !== 'Anonymous' && (
                        <p className="text-xs text-slate-500">{visit.email}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(visit.visitedAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    {visit.ip && (
                      <span className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        <Globe className="h-3 w-3 text-slate-400" />
                        {visit.ip}
                      </span>
                    )}
                    {(visit.browser || visit.os) && (
                      <span className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        <Monitor className="h-3 w-3 text-slate-400" />
                        {[visit.browser, visit.os].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    {visit.device && (
                      <span className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        {visit.device === 'Mobile'
                          ? <Smartphone className="h-3 w-3 text-slate-400" />
                          : visit.device === 'Tablet'
                          ? <Tablet className="h-3 w-3 text-slate-400" />
                          : <Monitor className="h-3 w-3 text-slate-400" />}
                        {visit.device}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CreateForm ───────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: '',
  expiresAt: '',
  showSprints: [],
  includeProductBoard: true,
  showUserNames: true,
  showDescriptions: true,
  showDueDates: true,
};

function CreateForm({ sprints, onSubmit, onCancel, submitting, submitError }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleSprint = (id) => {
    setForm(prev => ({
      ...prev,
      showSprints: prev.showSprints.includes(id)
        ? prev.showSprints.filter(s => s !== id)
        : [...prev.showSprints, id],
    }));
  };

  const hasView = form.includeProductBoard || form.showSprints.length > 0;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-slate-900">New Share Link</h3>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Link Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Stakeholder View, Client Preview"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
          />
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Expiration
          </label>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
          />
          <p className="text-xs text-slate-400 mt-1">Leave empty for no expiration</p>
        </div>

        {/* Views */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Views to Share
          </label>
          {!hasView && (
            <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Select at least one view
            </p>
          )}
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
              form.includeProductBoard
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={form.includeProductBoard}
                onChange={e => setForm(prev => ({ ...prev, includeProductBoard: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <LayoutGrid className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Product Board</span>
              <span className="text-xs opacity-60 ml-auto">Backlog tasks</span>
            </label>

            {sprints.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {sprints.map(sprint => (
                  <label key={sprint._id} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                    form.showSprints.includes(sprint._id)
                      ? 'bg-blue-50 text-blue-800'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={form.showSprints.includes(sprint._id)}
                      onChange={() => toggleSprint(sprint._id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <Layers className="h-4 w-4 flex-shrink-0 opacity-70" />
                    <span className="text-sm font-medium">{sprint.name}</span>
                  </label>
                ))}
              </div>
            )}
            {sprints.length === 0 && (
              <p className="text-xs text-slate-400 py-1 pl-1">No sprints in this project yet</p>
            )}
          </div>
        </div>

        {/* Advanced display options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Display options
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { key: 'showUserNames', label: 'Team member names' },
                { key: 'showDescriptions', label: 'Task descriptions' },
                { key: 'showDueDates', label: 'Due dates' },
              ].map(({ key, label }) => (
                <label key={key} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-xs transition-colors ${
                  form[key] ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <span className="font-medium">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(form)}
            disabled={submitting || !form.name.trim() || !hasView}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ShareLinkCard ────────────────────────────────────────────────────────────

function ShareLinkCard({ link, baseUrl, onCopy, copied, onRevoke, revoking, onViewVisitors }) {
  const timeRemaining = getTimeRemaining(link.expiresAt);
  const isExpired = timeRemaining === 'Expired';
  const shareUrl = `${baseUrl}/share/s/${link.slug}`;

  return (
    <div className={`group border rounded-2xl p-4 transition-all duration-200 ${
      isExpired || !link.isActive
        ? 'bg-slate-50 border-slate-200 opacity-70'
        : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-slate-900">{link.name}</h4>
            {!link.isActive && (
              <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Inactive</span>
            )}
            {isExpired && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Expired</span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <Link2 className="h-3 w-3 flex-shrink-0" />
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 truncate max-w-xs">
              {shareUrl}
            </code>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {link.expiresAt && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                isExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
              }`}>
                <Clock className="h-3 w-3" />
                {timeRemaining}
              </span>
            )}
            {link.settings.includeProductBoard && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                <LayoutGrid className="h-3 w-3" />
                Product Board
              </span>
            )}
            {(link.settings.showSprints?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                <Layers className="h-3 w-3" />
                {link.settings.showSprints.length} sprint{link.settings.showSprints.length !== 1 ? 's' : ''}
              </span>
            )}
            {link.settings.showUserNames ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                <Users className="h-3 w-3" />
                Names visible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                <Shield className="h-3 w-3" />
                Names hidden
              </span>
            )}
            {link.visitCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                <Eye className="h-3 w-3" />
                {link.visitCount} visit{link.visitCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onViewVisitors(link)}
            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="View visitors"
          >
            <Users className="h-4 w-4" />
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Open link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            onClick={() => onCopy(link.slug)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Copy link"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => onRevoke(link._id)}
            disabled={revoking}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
            title="Revoke link"
          >
            {revoking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ShareLinksModal({ projectId, onClose }) {
  const [shareLinks, setShareLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingVisitors, setViewingVisitors] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchShareLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch share links');
      const data = await res.json();
      setShareLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading links');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchSprints = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch sprints');
      const data = await res.json();
      setSprints(data);
    } catch {
      // non-critical
    }
  }, [projectId]);

  useEffect(() => {
    fetchShareLinks();
    fetchSprints();
  }, [fetchShareLinks, fetchSprints]);

  const handleCreateLink = async (formData) => {
    if (!formData.includeProductBoard && formData.showSprints.length === 0) {
      setSubmitError('Select at least one view to share');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create share link');
      }
      const newLink = await res.json();
      setShareLinks(prev => [newLink, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeLink = async (shareId) => {
    if (!window.confirm('Revoke this share link? Anyone with the URL will lose access.')) return;
    setDeletingId(shareId);
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links/${shareId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke');
      setShareLinks(prev => prev.filter(l => l._id !== shareId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error revoking link');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (slug) => {
    navigator.clipboard.writeText(`${baseUrl}/share/s/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-100"
          style={{ maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Share Project</h2>
              <p className="text-sm text-slate-500 mt-0.5">Create read-only links for clients and stakeholders</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {showCreateForm ? (
              <CreateForm
                sprints={sprints}
                onSubmit={handleCreateLink}
                onCancel={() => { setShowCreateForm(false); setSubmitError(null); }}
                submitting={isSubmitting}
                submitError={submitError}
              />
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Create New Share Link
              </button>
            )}

            {/* Existing links */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Active Links
                </h3>
                {!loading && shareLinks.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {shareLinks.length} link{shareLinks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No share links yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map(link => (
                    <ShareLinkCard
                      key={link._id}
                      link={link}
                      baseUrl={baseUrl}
                      onCopy={handleCopy}
                      copied={copiedSlug === link.slug}
                      onRevoke={handleRevokeLink}
                      revoking={deletingId === link._id}
                      onViewVisitors={setViewingVisitors}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Share links are read-only. Visitors cannot edit project data.
            </p>
          </div>
        </div>
      </div>

      {viewingVisitors && (
        <VisitorsPanel
          shareLink={viewingVisitors}
          onClose={() => setViewingVisitors(null)}
        />
      )}
    </>
  );
}