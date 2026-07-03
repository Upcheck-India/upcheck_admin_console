'use client';

import { useState, useEffect } from 'react';
import { X, Loader, Check, Users, Hash, MessageCircle } from 'lucide-react';

// Self-contained forward-to modal: fetches its own list of DMs/teams/groups
// so it can be dropped into any of the three chat pages without those pages
// needing to already have all three lists loaded.
export default function ForwardModal({ open, onClose, onForward }) {
  const [loading, setLoading] = useState(true);
  const [dms, setDms] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    setSentTo(new Set());
    (async () => {
      setLoading(true);
      try {
        const [connRes, teamRes, groupRes] = await Promise.all([
          fetch('/api/chat/connections', { credentials: 'include' }),
          fetch('/api/teams', { credentials: 'include' }),
          fetch('/api/group-chats', { credentials: 'include' }),
        ]);
        const connData = connRes.ok ? await connRes.json() : { connections: [] };
        const teamData = teamRes.ok ? await teamRes.json() : { teams: [] };
        const groupData = groupRes.ok ? await groupRes.json() : { groupChats: [] };
        setDms((connData.connections || []).filter(c => c.status === 'accepted'));
        setTeams(teamData.teams || []);
        setGroups(groupData.groupChats || []);
      } catch (e) {
        console.error('Failed to load forward targets:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const handleSend = async (target) => {
    setSendingTo(target.key);
    try {
      await onForward(target);
      setSentTo(prev => new Set(prev).add(target.key));
    } catch (e) {
      alert('Failed to forward message');
    } finally {
      setSendingTo(null);
    }
  };

  const renderRow = (target) => {
    const isSending = sendingTo === target.key;
    const isSent = sentTo.has(target.key);
    return (
      <button
        key={target.key}
        type="button"
        disabled={isSending || isSent}
        onClick={() => handleSend(target)}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left disabled:opacity-60"
      >
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
          {target.icon}
        </div>
        <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{target.label}</span>
        {isSending && <Loader className="w-4 h-4 animate-spin text-blue-500" />}
        {isSent && <Check className="w-4 h-4 text-emerald-500" />}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Forward Message</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {dms.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Messages</p>
                  {dms.map(c => renderRow({
                    key: `dm-${c.conversationId}`,
                    label: c.peer?.name || c.peer?.username || 'Teammate',
                    icon: <MessageCircle className="w-4 h-4" />,
                    type: 'dm',
                    conversationId: c.conversationId,
                  }))}
                </div>
              )}
              {teams.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Teams</p>
                  {teams.map(t => renderRow({
                    key: `team-${t._id}`,
                    label: t.name,
                    icon: <Hash className="w-4 h-4" />,
                    type: 'team',
                    teamId: t._id,
                  }))}
                </div>
              )}
              {groups.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Group Chats</p>
                  {groups.map(g => renderRow({
                    key: `group-${g._id}`,
                    label: g.name,
                    icon: <Users className="w-4 h-4" />,
                    type: 'group',
                    groupId: g._id,
                  }))}
                </div>
              )}
              {!loading && dms.length === 0 && teams.length === 0 && groups.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-10">No chats available to forward to.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
