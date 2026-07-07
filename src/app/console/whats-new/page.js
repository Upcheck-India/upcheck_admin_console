'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  X,
  Calendar,
  Loader2,
  Check,
  Rss,
  MessageSquare,
  ShieldAlert,
  FileText,
} from 'lucide-react';

const DISPLAY_MODE_OPTIONS = [
  { value: 'banner', label: 'Banner', desc: 'Dismissible strip at the top of the home screen.', icon: Rss },
  { value: 'popup', label: 'Popup', desc: 'A modal shown once; user can dismiss freely.', icon: MessageSquare },
  { value: 'forced', label: 'Forced popup', desc: 'A modal the user must explicitly acknowledge — no swipe/backdrop dismiss.', icon: ShieldAlert },
  { value: 'full_page', label: 'Full page', desc: 'Opens the full changelog page immediately on next app open.', icon: FileText },
];

export default function WhatsNewPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth(true);
  const router = useRouter();
  const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';

  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [version, setVersion] = useState('');
  const [displayMode, setDisplayMode] = useState('popup');
  const [publish, setPublish] = useState(true);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchChangelogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/changelogs?all=true');
      if (res.ok) {
        const data = await res.json();
        setChangelogs(data.changelogs || []);
      }
    } catch (e) {
      console.error('Error fetching changelogs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchChangelogs();
  }, [isAuthenticated]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setTitle('');
    setBody('');
    setVersion('');
    setDisplayMode('popup');
    setPublish(true);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setIsEditing(true);
    setSelectedId(c._id);
    setTitle(c.title || '');
    setBody(c.body || '');
    setVersion(c.version || '');
    setDisplayMode(c.displayMode || 'popup');
    setPublish(!!c.isPublished);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError('Title and body are required.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    const payload = { title, body, version, displayMode, publish };

    try {
      const url = isEditing ? `/api/changelogs/${selectedId}` : '/api/changelogs';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        fetchChangelogs();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Failed to save.');
      }
    } catch (error) {
      setFormError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this changelog entry? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/changelogs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchChangelogs();
      else {
        const err = await res.json();
        alert(err.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting changelog:', error);
    }
  };

  const togglePublish = async (c) => {
    try {
      const res = await fetch(`/api/changelogs/${c._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: c.title,
          body: c.body,
          version: c.version,
          displayMode: c.displayMode,
          publish: !c.isPublished,
        }),
      });
      if (res.ok) fetchChangelogs();
    } catch (error) {
      console.error('Error toggling publish:', error);
    }
  };

  if (authLoading) return <SecureLoading />;
  if (!isAuthenticated) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-b border-slate-200/80 px-6 py-5 shadow-sm sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/console')} className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">What&apos;s New</h1>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 font-semibold text-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> New entry
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : changelogs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No changelog entries yet.</div>
          ) : (
            changelogs.map((c) => {
              const mode = DISPLAY_MODE_OPTIONS.find(m => m.value === c.displayMode);
              const ModeIcon = mode?.icon || MessageSquare;
              return (
                <div key={c._id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-bold text-slate-900">{c.title}</h2>
                        {c.version && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">v{c.version}</span>
                        )}
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.isPublished ? 'Published' : 'Draft'}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full">
                          <ModeIcon className="w-3 h-3" /> {mode?.label || c.displayMode}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.body}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                        <Calendar className="w-3 h-3" />
                        {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => togglePublish(c)}
                        title={c.isPublished ? 'Unpublish' : 'Publish'}
                        className={`p-2 rounded-lg transition-colors ${c.isPublished ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(c)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c._id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{isEditing ? 'Edit entry' : 'New changelog entry'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. What's new in v1.2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Version (optional)</label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. 1.2.0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Describe what's new, fixed, or improved..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Display mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {DISPLAY_MODE_OPTIONS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setDisplayMode(m.value)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        displayMode === m.value ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded" />
                Publish immediately (uncheck to save as draft)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
