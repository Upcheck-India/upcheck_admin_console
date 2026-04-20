'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Settings, UploadCloud, Loader2, CheckCircle2,
  XCircle, AlertCircle, Trash2, Github, Image as ImageIcon,
  Folder, FileText, Code, PieChart, Database, Globe, Shield, Zap,
  Tag, X
} from 'lucide-react';
import { uploadFile } from '../../../lib/upload';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active',    dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'ideation',  label: 'Ideation',  dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 ring-violet-200'   },
  { value: 'paused',    label: 'Paused',    dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-200'      },
  { value: 'shelved',   label: 'Shelved',   dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 ring-slate-200'      },
  { value: 'archived',  label: 'Archived',  dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-600 ring-gray-200'         },
  { value: 'dismissed', label: 'Dismissed', dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 ring-red-200'            },
];

// ─── Preset Logos ─────────────────────────────────────────────────────────────

const PRESET_LOGOS = [
  { id: 'folder',  icon: Folder,  color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Folder' },
  { id: 'file',    icon: FileText, color: 'text-blue-500',  bg: 'bg-blue-50',   label: 'Document' },
  { id: 'code',    icon: Code,     color: 'text-purple-500', bg: 'bg-purple-50', label: 'Code' },
  { id: 'chart',   icon: PieChart, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Analytics' },
  { id: 'database', icon: Database, color: 'text-cyan-500', bg: 'bg-cyan-50',   label: 'Database' },
  { id: 'globe',   icon: Globe,    color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Global' },
  { id: 'shield',  icon: Shield,   color: 'text-slate-500', bg: 'bg-slate-50',  label: 'Security' },
  { id: 'zap',     icon: Zap,      color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Fast' },
];

// ─── LogoUploader ─────────────────────────────────────────────────────────────

function LogoUploader({ currentLogoUrl, logoFile, onFileChange, onUrlChange, onClear, onPresetSelect }) {
  const inputRef     = useRef(null);
  const objectUrlRef = useRef(null);
  const [dragging, setDragging]   = useState(false);
  const [imgError, setImgError]   = useState(false);

  // Create / revoke blob URL to avoid memory leaks
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      objectUrlRef.current = url;
      setPreviewSrc(url);
      setImgError(false);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewSrc(null);
    }
  }, [logoFile]);

  const displaySrc = previewSrc || (imgError ? null : currentLogoUrl);
  const currentPreset = PRESET_LOGOS.find(p => `preset:${p.id}` === currentLogoUrl);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) { onFileChange(file); setImgError(false); }
  };

  return (
    <div className="space-y-3">
      {/* Preview + clear */}
      {(displaySrc || currentPreset) && (
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden shrink-0 shadow-sm bg-gray-50 flex items-center justify-center">
            {currentPreset ? (
              <currentPreset.icon className={`w-8 h-8 ${currentPreset.color}`} />
            ) : (
              <img
                src={displaySrc}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {logoFile ? logoFile.name : currentPreset ? `Preset: ${currentPreset.label}` : 'Current logo'}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 mt-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Preset logos */}
      {!displaySrc && !currentPreset && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_LOGOS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetSelect(`preset:${preset.id}`)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:shadow-sm ${
                  currentPreset?.id === preset.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <preset.icon className={`w-5 h-5 ${preset.color}`} />
                <span className="text-[10px] text-gray-600">{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-xs text-gray-400 bg-white">or</span>
            </div>
          </div>
        </>
      )}

      {/* Drop zone */}
      {(!displaySrc && !currentPreset) && (
        <div
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/20'
          }`}
        >
          <UploadCloud className={`w-6 h-6 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-xs text-gray-500">
            <span className="text-blue-600 font-medium">Click to upload</span> or drag &amp; drop
          </p>
          <p className="text-[10px] text-gray-400">PNG, JPG, GIF · max 10 MB</p>
          <input ref={inputRef} type="file" accept="image/*" onChange={e => { onFileChange(e.target.files[0]); setImgError(false); }} className="hidden" />
        </div>
      )}

      {/* URL input */}
      <div className="relative">
        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={currentLogoUrl}
          onChange={e => { onUrlChange(e.target.value); setImgError(false); }}
          placeholder="Or paste an image URL"
          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
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
            <X className="w-3 h-3" />
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

// ─── ProjectSettings ──────────────────────────────────────────────────────────

export default function ProjectSettings({ project, onProjectUpdate }) {
  const [name,        setName]        = useState(project?.name           || '');
  const [description, setDescription] = useState(project?.description    || '');
  const [logoFile,    setLogoFile]    = useState(null);
  const [logoUrl,     setLogoUrl]     = useState(project?.logo           || '');
  const [status,      setStatus]      = useState(project?.status         || 'active');
  const [repoUrl,     setRepoUrl]     = useState(project?.githubRepoUrl  || '');
  const [tags,        setTags]        = useState(project?.tags           || []);

  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [error,            setError]            = useState(null);
  const [success,          setSuccess]          = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [nameError,        setNameError]        = useState('');

  // Detect unsaved changes
  useEffect(() => {
    if (!project) return;
    setHasUnsavedChanges(
      name        !== (project.name          || '') ||
      description !== (project.description   || '') ||
      logoUrl     !== (project.logo          || '') ||
      status      !== (project.status        || 'active') ||
      repoUrl     !== (project.githubRepoUrl || '') ||
      logoFile    !== null ||
      JSON.stringify(tags) !== JSON.stringify(project.tags || [])
    );
  }, [name, description, logoUrl, status, repoUrl, logoFile, project, tags]);

  // Auto-clear success banner
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const handleSubmit = async () => {
    setNameError('');
    if (!name.trim()) return setNameError('Project name is required.');

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    let uploadedLogoUrl = logoUrl;

    try {
      if (logoFile) {
        const result = await uploadFile(logoFile);
        if (!result) throw new Error('Logo upload failed.');
        uploadedLogoUrl = result;
      }

      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         name.trim(),
          description:  description.trim(),
          logo:         uploadedLogoUrl,
          status,
          githubRepoUrl: repoUrl.trim(),
          tags:         tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update project.');
      }

      setSuccess(true);
      setLogoFile(null);
      if (typeof onProjectUpdate === 'function') onProjectUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName(project?.name           || '');
    setDescription(project?.description    || '');
    setLogoUrl(project?.logo           || '');
    setStatus(project?.status         || 'active');
    setRepoUrl(project?.githubRepoUrl  || '');
    setLogoFile(null);
    setTags(project?.tags || []);
    setError(null);
    setSuccess(false);
    setNameError('');
  };

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status);

  return (
    <div className="space-y-5">

      {/* ── Status banners ── */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Save failed</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">Settings saved successfully.</p>
        </div>
      )}

      {/* ── General Settings card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <Settings className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">General Settings</h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Name + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
                className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-all ${
                  nameError
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                    : 'border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                }`}
              />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full appearance-none pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {/* Colored dot overlay */}
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none ${currentStatus?.dot || 'bg-gray-400'}`} />
              </div>
              {/* Badge preview */}
              {currentStatus && (
                <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${currentStatus.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                  {currentStatus.label}
                </span>
              )}
            </div>
          </div>

          {/* GitHub repo URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              GitHub Repository URL
            </label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="url"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the project goals, scope, and key objectives…"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all resize-none"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Project Logo <span className="text-gray-300 font-normal normal-case">optional</span>
            </label>
            <LogoUploader
              currentLogoUrl={logoUrl}
              logoFile={logoFile}
              onFileChange={f => { setLogoFile(f); }}
              onUrlChange={url => { setLogoUrl(url); setLogoFile(null); }}
              onClear={() => { setLogoFile(null); setLogoUrl(''); }}
              onPresetSelect={(presetId) => { setLogoUrl(presetId); setLogoFile(null); }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Tags <span className="text-gray-300 font-normal normal-case">optional</span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
            />
            <p className="text-xs text-gray-400 mt-1.5 ml-1">
              Press Enter or comma to add a tag. Tags help you search and filter projects.
            </p>
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && !isSubmitting && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || !hasUnsavedChanges}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Discard
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !hasUnsavedChanges}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:cursor-not-allowed ${
              success
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
            }`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : success ? (
              <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}