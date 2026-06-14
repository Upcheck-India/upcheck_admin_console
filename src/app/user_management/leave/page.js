'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plane, Plus, X, Loader2, Check, Ban, Trash2, Settings as SettingsIcon, Edit2, LayoutGrid, List,
} from 'lucide-react';
import HRNav from '../_components/HRNav';
import LeaveApprovalsBoard from './LeaveApprovalsBoard';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const fmt = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function LeavePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('mine');
  const [balances, setBalances] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [boardRequests, setBoardRequests] = useState([]); // all-status, for the board view
  const [approvalsView, setApprovalsView] = useState('board'); // 'board' | 'list'
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const year = new Date().getUTCFullYear();

  // Managing others' leave (view all / approve / configure types) requires
  // Console admin or the `users.manage` permission. Everyone can apply for
  // their own leave.
  const canManage = currentUser && (
    currentUser.role === 'Console admin' ||
    (currentUser.perms || []).includes('users.manage')
  );

  // apply modal
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '' });
  const [applyError, setApplyError] = useState('');
  const [applySaving, setApplySaving] = useState(false);

  // review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!data.user) { router.push('/login'); return; }
      setCurrentUser(data.user);
    })();
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, mineRes, typesRes] = await Promise.all([
        fetch(`/api/hr/leave/balances?year=${year}`, { credentials: 'include' }),
        fetch('/api/hr/leave/requests?view=mine', { credentials: 'include' }),
        fetch('/api/hr/leave/types', { credentials: 'include' }),
      ]);
      const bal = await balRes.json();
      const mine = await mineRes.json();
      const types = await typesRes.json();
      setBalances(bal.balances || []);
      setMyRequests(mine.requests || []);
      setLeaveTypes(types.types || []);

      if (canManage) {
        const apprRes = await fetch('/api/hr/leave/requests?view=approvals', { credentials: 'include' });
        if (apprRes.ok) {
          const appr = await apprRes.json();
          setApprovals(appr.requests || []);
        }
      } else {
        setApprovals([]);
      }
    } finally {
      setLoading(false);
    }
  }, [year, canManage]);

  useEffect(() => { if (currentUser) loadAll(); }, [currentUser, loadAll]);

  // All-status requests for the approvals board (managers only).
  const loadBoard = useCallback(async () => {
    if (!canManage) return;
    const res = await fetch('/api/hr/leave/requests?view=all', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setBoardRequests(data.requests || []);
    }
  }, [canManage]);

  useEffect(() => {
    if (currentUser && canManage && tab === 'approvals' && approvalsView === 'board') loadBoard();
  }, [currentUser, canManage, tab, approvalsView, loadBoard]);

  // Approve directly from the board (drag Pending → Approved), optimistic.
  const approveFromBoard = async (id) => {
    const prev = boardRequests;
    setBoardRequests((rs) => rs.map((r) => (r._id === id ? { ...r, status: 'approved' } : r)));
    const res = await fetch(`/api/hr/leave/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'approve', reviewNote: '' }),
    });
    if (!res.ok) {
      setBoardRequests(prev);
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Action failed');
    } else {
      loadAll(); // refresh balances + approvals count
    }
  };

  const submitApply = async (e) => {
    e.preventDefault();
    setApplyError('');
    if (!applyForm.leaveTypeId || !applyForm.startDate || !applyForm.endDate) {
      setApplyError('Leave type and dates are required'); return;
    }
    setApplySaving(true);
    try {
      const res = await fetch('/api/hr/leave/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(applyForm),
      });
      const data = await res.json();
      if (!res.ok) { setApplyError(data.error || 'Failed to apply'); return; }
      setApplyOpen(false);
      setApplyForm({ leaveTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '' });
      loadAll();
    } finally {
      setApplySaving(false);
    }
  };

  const act = async (id, action, note = '') => {
    const res = await fetch(`/api/hr/leave/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action, reviewNote: note }),
    });
    if (res.ok) { setReviewTarget(null); setReviewNote(''); loadAll(); loadBoard(); }
    else { const d = await res.json(); alert(d.error || 'Action failed'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this request?')) return;
    const res = await fetch(`/api/hr/leave/requests/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) loadAll();
  };

  const selectedType = leaveTypes.find((t) => t._id === applyForm.leaveTypeId);
  const selectedBalance = balances.find((b) => String(b.leaveTypeId) === applyForm.leaveTypeId);

  const tabs = [{ id: 'mine', label: 'My Leave' }];
  if (canManage) {
    tabs.push({ id: 'approvals', label: `Approvals${approvals.length ? ` (${approvals.length})` : ''}` });
    tabs.push({ id: 'types', label: 'Leave Types' });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <HRNav />
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <Plane className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          </div>
          <button onClick={() => { setApplyForm({ leaveTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '' }); setApplyError(''); setApplyOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {balances.map((b) => (
            <div key={b.leaveTypeId} className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderColor: b.color }}>
              <div className="text-sm text-gray-500">{b.name}</div>
              <div className="text-2xl font-bold text-gray-900">{b.available}<span className="text-sm font-normal text-gray-400"> / {b.allocated + b.carriedForward}</span></div>
              <div className="text-xs text-gray-400 mt-1">Used {b.used} · Pending {b.pending}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-gray-200 mb-4">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : tab === 'mine' ? (
          <RequestsTable requests={myRequests} emptyText="You have no leave requests yet."
            renderActions={(r) => (['pending', 'approved'].includes(r.status) && (
              <button onClick={() => act(r._id, 'cancel')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"><Ban className="h-4 w-4" /> Cancel</button>
            )) || (r.status === 'rejected' && (
              <button onClick={() => del(r._id)} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            ))}
          />
        ) : tab === 'approvals' ? (
          <>
            <div className="flex justify-end mb-3">
              <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setApprovalsView('board')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${approvalsView === 'board' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Board view"
                >
                  <LayoutGrid className="w-4 h-4" /> Board
                </button>
                <button
                  onClick={() => setApprovalsView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${approvalsView === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="List view"
                >
                  <List className="w-4 h-4" /> List
                </button>
              </div>
            </div>
            {approvalsView === 'board' ? (
              <LeaveApprovalsBoard
                requests={boardRequests}
                onApprove={approveFromBoard}
                onReject={(r) => { setReviewTarget(r); setReviewNote(''); }}
              />
            ) : (
              <RequestsTable requests={approvals} showEmployee emptyText="No requests awaiting your approval."
                renderActions={(r) => r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => act(r._id, 'approve')} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"><Check className="h-4 w-4" /> Approve</button>
                    <button onClick={() => { setReviewTarget(r); setReviewNote(''); }} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Ban className="h-4 w-4" /> Reject</button>
                  </div>
                )}
              />
            )}
          </>
        ) : (
          <LeaveTypesManager leaveTypes={leaveTypes} onChange={loadAll} />
        )}
      </div>

      {/* Apply modal */}
      {applyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Apply for Leave</h2>
              <button onClick={() => setApplyOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitApply} className="p-4 space-y-4">
              {applyError && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{applyError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select value={applyForm.leaveTypeId} onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">Select type</option>
                  {leaveTypes.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                {selectedType && selectedBalance && (
                  <p className="text-xs text-gray-500 mt-1">Available: {selectedBalance.available} {selectedType.paid ? '(paid)' : '(unpaid)'}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start *</label>
                  <input type="date" value={applyForm.startDate} onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End *</label>
                  <input type="date" value={applyForm.endDate} onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={applyForm.halfDay} onChange={(e) => setApplyForm({ ...applyForm, halfDay: e.target.checked })} className="rounded text-blue-600" />
                Half day (single day only)
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={applyForm.reason} onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setApplyOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={applySaving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {applySaving && <Loader2 className="h-4 w-4 animate-spin" />} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {reviewTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Reject Leave Request</h2>
              <button onClick={() => setReviewTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">{reviewTarget.employeeName} · {reviewTarget.leaveTypeName} · {reviewTarget.days} day(s)</p>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} placeholder="Reason for rejection (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              <div className="flex justify-end gap-3">
                <button onClick={() => setReviewTarget(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={() => act(reviewTarget._id, 'reject', reviewNote)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestsTable({ requests, renderActions, showEmployee = false, emptyText }) {
  if (!requests.length) {
    return <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">{emptyText}</div>;
  }
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {showEmployee && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map((r) => (
            <tr key={r._id} className="hover:bg-gray-50">
              {showEmployee && <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.employeeName}<div className="text-xs text-gray-400">{r.department}</div></td>}
              <td className="px-4 py-3 text-sm text-gray-700">{r.leaveTypeName}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{fmt(r.startDate)}{r.startDate !== r.endDate ? ` – ${fmt(r.endDate)}` : ''}{r.halfDay ? ' (half)' : ''}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{r.days}</td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={r.reason}>{r.reason || '—'}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>{r.reviewNote && <div className="text-xs text-gray-400 mt-1">{r.reviewNote}</div>}</td>
              <td className="px-4 py-3 text-right">{renderActions && renderActions(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const emptyType = { name: '', code: '', defaultAllocation: 0, color: '#3b82f6', paid: true, requiresApproval: true, carryForward: false };

function LeaveTypesManager({ leaveTypes, onChange }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyType);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm(emptyType); setEditingId(null); setError(''); setOpen(true); };
  const openEdit = (t) => { setForm({ name: t.name, code: t.code, defaultAllocation: t.defaultAllocation, color: t.color, paid: t.paid, requiresApproval: t.requiresApproval, carryForward: t.carryForward }); setEditingId(t._id); setError(''); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/hr/leave/types/${editingId}` : '/api/hr/leave/types';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setOpen(false); onChange();
    } finally { setSaving(false); }
  };

  const deactivate = async (t) => {
    if (!window.confirm(`Deactivate "${t.name}"?`)) return;
    const res = await fetch(`/api/hr/leave/types/${t._id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) onChange();
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Leave Types</h3>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Type</button>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocation/yr</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carry fwd</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {leaveTypes.map((t) => (
            <tr key={t._id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900"><span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: t.color }} />{t.name}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{t.code}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{t.defaultAllocation}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{t.paid ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{t.carryForward ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex gap-2 justify-end">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => deactivate(t)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Leave Type' : 'Add Leave Type'}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100" placeholder="auto" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allocation / year</label>
                  <input type="number" min="0" value={form.defaultAllocation} onChange={(e) => setForm({ ...form, defaultAllocation: +e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 px-1 py-1 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="rounded text-blue-600" /> Paid leave (track balance)</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} className="rounded text-blue-600" /> Requires approval</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.carryForward} onChange={(e) => setForm({ ...form, carryForward: e.target.checked })} className="rounded text-blue-600" /> Carry forward</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
