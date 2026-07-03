'use client';

import { useState, useEffect, useCallback } from 'react';
import { Puzzle, Plus, Trash2, Loader, ChevronDown, ChevronUp } from 'lucide-react';

// Shared "Plugins" section for a chat's settings panel (DM/Team/Group).
// Lists installed plugins with their available slash commands, and — for
// users with permission (Team lead / Group admin / platform Admin/Console
// admin; DM: either participant) — lets them install/uninstall from the
// full plugin catalog.
export default function PluginsPanel({ chatType, chatId }) {
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [busyPluginId, setBusyPluginId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [installedRes, catalogRes] = await Promise.all([
        fetch(`/api/chat-plugins/installed?chatType=${chatType}&chatId=${chatId}`, { credentials: 'include' }),
        fetch('/api/chat-plugins', { credentials: 'include' }),
      ]);
      const installedData = installedRes.ok ? await installedRes.json() : { installed: [], canManage: false };
      const catalogData = catalogRes.ok ? await catalogRes.json() : { plugins: [] };
      setInstalled(installedData.installed || []);
      setCanManage(!!installedData.canManage);
      setCatalog(catalogData.plugins || []);
    } catch (e) {
      console.error('Failed to load plugins:', e);
    } finally {
      setLoading(false);
    }
  }, [chatType, chatId]);

  useEffect(() => { load(); }, [load]);

  const installedIds = new Set(installed.map(p => p.pluginId));
  const notInstalled = catalog.filter(p => !installedIds.has(p.id));

  const handleInstall = async (pluginId) => {
    setBusyPluginId(pluginId);
    try {
      const res = await fetch('/api/chat-plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatType, chatId, pluginId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to install plugin');
      }
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleUninstall = async (pluginId) => {
    if (!confirm('Uninstall this plugin from the chat? Its slash commands will stop working here.')) return;
    setBusyPluginId(pluginId);
    try {
      const res = await fetch('/api/chat-plugins/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatType, chatId, pluginId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to uninstall plugin');
      }
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyPluginId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader className="w-3.5 h-3.5 animate-spin" /> Loading plugins...
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
        <Puzzle className="w-3.5 h-3.5" /> Plugins
      </h3>

      {installed.length === 0 ? (
        <p className="text-xs text-slate-400 mb-3">No plugins installed in this chat yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {installed.map(p => (
            <div key={p.pluginId} className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{p.icon} {p.name}</span>
                {canManage && (
                  <button
                    type="button"
                    disabled={busyPluginId === p.pluginId}
                    onClick={() => handleUninstall(p.pluginId)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                    title="Uninstall"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{p.description}</p>
              <div className="mt-2 space-y-0.5">
                {p.commands.map(c => (
                  <p key={c.name} className="text-[10px] text-slate-400 font-mono">{c.usage} — {c.description}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && notInstalled.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCatalog(s => !s)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> Install a plugin
            {showCatalog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showCatalog && (
            <div className="mt-2 space-y-2">
              {notInstalled.map(p => (
                <div key={p.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800">{p.icon} {p.name}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyPluginId === p.id}
                    onClick={() => handleInstall(p.id)}
                    className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    Install
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
