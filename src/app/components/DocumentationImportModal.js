'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, FileText, FolderOpen, Loader2, Lock, X } from 'lucide-react';

/**
 * Pick files out of the Documentation module and copy them into a data room.
 *
 * Copies, not links — saving a Documentation file deletes its previous stored
 * object, so a reference would break the moment somebody upstream fixed a
 * typo. The wording in this dialog says so, because a user who expects a live
 * link and gets a snapshot will be surprised at exactly the wrong moment.
 */
export default function DocumentationImportModal({ roomId, folderId = null, onClose, onImported }) {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const url = project
      ? `/api/dataroom/import/documentation?projectId=${encodeURIComponent(project._id)}`
      : '/api/dataroom/import/documentation';

    fetch(url, { credentials: 'include' })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(body.error || 'Could not load Documentation.');
          return;
        }
        setError(null);
        if (project) setFiles(body.files || []);
        else setProjects(body.projects || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function runImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/dataroom/import/documentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roomId, folderId, resourceIds: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Import failed.');
        return;
      }
      setResult(body);
      setSelected(new Set());
      onImported?.(body);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setImporting(false);
    }
  }

  const importable = files.filter((f) => !f.unimportableReason);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 flex flex-col max-h-[85vh]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {project && (
              <button
                onClick={() => {
                  setProject(null);
                  setSelected(new Set());
                }}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="Back to projects"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {project ? project.name : 'Import from Documentation'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-900">
                Imported {result.count} file{result.count === 1 ? '' : 's'}.
              </p>
              {result.skipped?.length > 0 && (
                <ul className="mt-2 text-emerald-800 space-y-1">
                  {result.skipped.map((s) => (
                    <li key={s.resourceId}>Skipped one file — {s.reason}.</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading…
            </div>
          ) : project ? (
            files.length === 0 ? (
              <p className="py-12 text-center text-gray-500">
                Nothing here you can import.
              </p>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => {
                  const blocked = file.unimportableReason;
                  return (
                    <li key={file._id}>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          blocked
                            ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
                            : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!!blocked}
                          checked={selected.has(file._id)}
                          onChange={() => toggle(file._id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                        />
                        {blocked ? (
                          <Lock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium truncate ${
                              blocked ? 'text-gray-500' : 'text-gray-800'
                            }`}
                          >
                            {file.name}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {blocked
                              ? blocked
                              : `${file.fileType || file.mimeType || 'file'}${
                                  file.fileSize
                                    ? ` · ${(file.fileSize / 1024 / 1024).toFixed(2)} MB`
                                    : ''
                                } · v${file.currentVersion || 1}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          ) : projects.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              You do not have access to any Documentation projects.
            </p>
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p._id}>
                  <button
                    onClick={() => setProject(p)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-left"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800">{p.name}</span>
                      {p.description && (
                        <span className="block text-xs text-gray-500 truncate">{p.description}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {project && (
          <footer className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              Files are copied into this room. Later edits in Documentation will not change them.
            </p>
            <button
              onClick={runImport}
              disabled={importing || selected.size === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {selected.size > 0 ? selected.size : ''}
              {selected.size === 1 ? ' file' : ' files'}
            </button>
          </footer>
        )}

        {project && importable.length === 0 && files.length > 0 && (
          <p className="px-6 pb-4 text-xs text-gray-500">
            None of these files can be imported.
          </p>
        )}
      </div>
    </div>
  );
}
