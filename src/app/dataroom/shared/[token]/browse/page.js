'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Folder, Loader2, LogOut, ShieldCheck } from 'lucide-react';

/**
 * What a share-link visitor sees when the link points at a folder or a whole
 * room rather than a single document.
 *
 * Deliberately not the internal room page: that one is built for staff, and
 * most of what it offers — upload, permissions, workflows, audit — is refused
 * for a link visitor anyway. Showing it would be a page of controls that
 * mostly error.
 *
 * ponytail: one flat list of everything inside the link's scope, rather than
 * folder-by-folder navigation. For a diligence recipient "show me everything I
 * may see" is usually the more useful view, and it is a fraction of the code.
 * Add drill-down if a room turns out to be large enough to need it.
 */
export default function SharedBrowsePage({ params }) {
  const { token } = use(params);

  const [share, setShare] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await fetch(
          `/api/dataroom/share/validate?token=${encodeURIComponent(token)}`,
        ).then((r) => r.json().catch(() => ({})));
        if (!cancelled) setShare(info.share || null);

        // Both endpoints bound themselves to the share session's scope, so no
        // roomId or folderId is sent — asking for a wider set simply returns
        // less, never more.
        const [f, d] = await Promise.all([
          fetch('/api/dataroom/folders', { credentials: 'include' }),
          fetch('/api/dataroom/documents?limit=200', { credentials: 'include' }),
        ]);

        if (cancelled) return;

        if (d.status === 401) {
          setError('Your access to this link has ended. Open the link again.');
          return;
        }

        if (f.ok) setFolders((await f.json()).items || []);
        if (d.ok) setDocuments((await d.json()).items || []);
      } catch {
        if (!cancelled) setError('Could not reach the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function leave() {
    await fetch('/api/dataroom/share/access', {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});
    window.location.href = `/dataroom/shared/${token}`;
  }

  const byFolder = new Map();
  for (const doc of documents) {
    const key = doc.folderId?.toString() || '';
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(doc);
  }
  const loose = byFolder.get('') || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {share?.resourceName || 'Shared files'}
            </h1>
            <p className="text-xs text-slate-500">
              {documents.length} document{documents.length === 1 ? '' : 's'} shared with you
            </p>
          </div>
          <button
            onClick={leave}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {error}{' '}
            <Link href={`/dataroom/shared/${token}`} className="underline font-medium">
              Reopen the link
            </Link>
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">There is nothing in this share yet.</p>
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <div className="space-y-6">
            {loose.length > 0 && <DocList docs={loose} />}

            {folders.map((folder) => {
              const docs = byFolder.get(folder._id.toString()) || [];
              if (!docs.length) return null;
              return (
                <section key={folder._id}>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Folder className="w-4 h-4 text-slate-400" />
                    {folder.name}
                  </h2>
                  <DocList docs={docs} />
                </section>
              );
            })}
          </div>
        )}

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5" />
          Your access is recorded and can be revoked at any time.
        </p>
      </main>
    </div>
  );
}

function DocList({ docs }) {
  return (
    <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
      {docs.map((doc) => (
        <li key={doc._id}>
          <Link
            href={`/dataroom/documents/${doc._id}/view`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800 truncate">{doc.name}</span>
              <span className="block text-xs text-slate-500">
                {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
