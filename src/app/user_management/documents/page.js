'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderArchive, Upload, Download, Trash2, Loader2, FileText, Eye, X, ArrowLeft
} from 'lucide-react';
import HRNav from '../_components/HRNav';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, MAX_DOCUMENT_BYTES } from '../../../lib/hr/employee';

const fmtSize = (b) => {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

const CATEGORY_COLORS = {
  contract: 'bg-blue-100 text-blue-700', id_proof: 'bg-purple-100 text-purple-700',
  address_proof: 'bg-teal-100 text-teal-700', education: 'bg-indigo-100 text-indigo-700',
  payslip: 'bg-green-100 text-green-700', tax: 'bg-amber-100 text-amber-700',
  offer_letter: 'bg-rose-100 text-rose-700', certificate: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function DocumentsPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ category: 'other', title: '', employeeId: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const canManage = currentUser && (
    currentUser.role === 'Console admin' || (currentUser.perms || []).includes('users.manage')
  );

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!json.user) { router.push('/login'); return; }
      setCurrentUser(json.user);
    })();
  }, [router]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      const res = await fetch('/api/hr/employees', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
      }
    })();
  }, [canManage]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (canManage && filterEmployee) params.set('employeeId', filterEmployee);
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/hr/documents?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      setDocuments(json.documents || []);
    } finally {
      setLoading(false);
    }
  }, [canManage, filterEmployee, filterCategory]);

  useEffect(() => { if (currentUser) load(); }, [currentUser, load]);

  const openUpload = () => {
    setUploadForm({ category: 'other', title: '', employeeId: '' });
    setUploadFile(null);
    setUploadError('');
    setUploadOpen(true);
  };

  const submitUpload = async (e) => {
    e.preventDefault();
    setUploadError('');
    if (!uploadFile) { setUploadError('Please choose a file'); return; }
    if (uploadFile.size > MAX_DOCUMENT_BYTES) { setUploadError('File exceeds 10MB limit'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('category', uploadForm.category);
      fd.append('title', uploadForm.title);
      if (canManage && uploadForm.employeeId) fd.append('employeeId', uploadForm.employeeId);
      const res = await fetch('/api/hr/documents', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(json.error || 'Upload failed'); return; }
      setUploadOpen(false);
      load();
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/hr/documents/${doc._id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setDocuments((d) => d.filter((x) => x._id !== doc._id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/console"
          className="inline-flex items-center mb-6 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Console
        </Link>
        <HRNav />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderArchive className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document Vault</h1>
              <p className="text-sm text-gray-500">{canManage ? 'Manage employee documents securely.' : 'Your personal documents.'}</p>
            </div>
          </div>
          <button onClick={openUpload} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {canManage && (
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>{`${e.firstName || ''} ${e.lastName || ''}`.trim() || e.username}</option>
              ))}
            </select>
          )}
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
            <option value="">All categories</option>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No documents yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc._id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 truncate">{doc.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                      {DOCUMENT_CATEGORY_LABELS[doc.category] || 'Other'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {doc.fileName} · {fmtSize(doc.size)} · {fmtDate(doc.createdAt)}
                    {canManage && doc.employeeName ? ` · ${doc.employeeName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/api/hr/documents/${doc._id}?inline=1`} target="_blank" rel="noopener noreferrer" title="View" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Eye className="h-4 w-4" />
                  </a>
                  <a href={`/api/hr/documents/${doc._id}`} title="Download" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Download className="h-4 w-4" />
                  </a>
                  <button onClick={() => remove(doc)} title="Delete" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Upload document</h2>
              <button onClick={() => setUploadOpen(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitUpload} className="p-4 space-y-4">
              {canManage && (
                <label className="block">
                  <span className="block text-xs font-medium text-gray-500 mb-1">Employee</span>
                  <select value={uploadForm.employeeId} onChange={(e) => setUploadForm((f) => ({ ...f, employeeId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                    <option value="">Myself</option>
                    {employees.map((e) => <option key={e._id} value={e._id}>{`${e.firstName || ''} ${e.lastName || ''}`.trim() || e.username}</option>)}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Category</span>
                <select value={uploadForm.category} onChange={(e) => setUploadForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                  {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Title (optional)</span>
                <input value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Employment contract" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">File (max 10MB)</span>
                <input ref={fileRef} type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm" />
              </label>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUploadOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
                <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
