import { useState, useCallback, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowRight, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Inbox, Eye } from 'lucide-react';
import GrantApplicationDetails from './GrantApplicationDetails';

const STATUS_OPTIONS = [
  { value: 'need_to_apply', label: 'Need to Apply', color: 'slate', icon: AlertCircle },
  { value: 'pending', label: 'Application Pending', color: 'blue', icon: Clock },
  { value: 'waiting', label: 'Waiting for Result', color: 'amber', icon: Clock },
  { value: 'granted', label: 'Granted', color: 'emerald', icon: CheckCircle },
  // Pending Transfer: Granted by funder but not yet received by organization
  { value: 'pending_transfer', label: 'Pending Transfer (from funder)', color: 'teal', icon: ArrowRight },
  { value: 'rejected', label: 'Rejected', color: 'red', icon: XCircle },
];

export default function GrantApplications({ accountId, disabled }) {
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    programName: '',
    organizationName: '',
    amount: '',
    applicationDate: '',
    deadline: '',
    status: 'need_to_apply',
    notes: '',
    category: '',
    fundingPeriod: '',
    contactPerson: '',
    contactEmail: '',
  });

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ accountId });
      if (filterStatus) params.append('status', filterStatus);
      const res = await fetch(`/api/organization/grant-applications?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load grant applications');
      const data = await res.json();
      setApplications(data.applications || []);
      setSummary(data.summary || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = () => {
    setEditingItem(null);
    setForm({
      programName: '',
      organizationName: '',
      amount: '',
      applicationDate: '',
      deadline: '',
      status: 'need_to_apply',
      notes: '',
      category: '',
      fundingPeriod: '',
      contactPerson: '',
      contactEmail: '',
    });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      programName: item.programName || '',
      organizationName: item.organizationName || '',
      amount: String(item.amount || ''),
      applicationDate: item.applicationDate || '',
      deadline: item.deadline || '',
      status: item.status || 'need_to_apply',
      notes: item.notes || '',
      category: item.category || '',
      fundingPeriod: item.fundingPeriod || '',
      contactPerson: item.contactPerson || '',
      contactEmail: item.contactEmail || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        accountId,
      };
      const url = editingItem ? `/api/organization/grant-applications/${editingItem._id}` : '/api/organization/grant-applications';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      await load();
      setShowModal(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this grant application?')) return;
    try {
      const res = await fetch(`/api/organization/grant-applications/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMarkReceived = async (item) => {
    // Mark granted funds as received to organization (goes to Untransferred pool)
    if (!confirm(`Mark ₹${item.amount.toLocaleString()} from "${item.programName}" as received to organization?`)) return;
    try {
      // Create untransferred record
      const unPayload = {
        amount: item.amount,
        title: `Grant: ${item.programName}`,
        source: item.organizationName,
        notes: `Received from funder for grant application`,
        receivedAt: new Date().toISOString().split('T')[0],
        relatedApplicationId: item._id,
      };
      const unRes = await fetch('/api/organization/untransferred', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(unPayload) });
      if (!unRes.ok) throw new Error('Failed to create untransferred record');
      const unData = await unRes.json();

      // Update application: mark receivedToOrg and link untransferredId, normalize status to granted
      const appRes = await fetch(`/api/organization/grant-applications/${item._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receivedToOrg: true, untransferredId: unData._id?.toString?.() || unData.id, status: 'granted' }),
      });
      if (!appRes.ok) throw new Error('Failed to update application');
      await load();
      alert('Marked as received to organization. Manage it in Untransferred funds.');
    } catch (e) {
      setError(e.message);
    }
  };

  const filteredApps = applications;

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{error}</span>
          <button className="text-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600">Total Applications</div>
          <div className="text-2xl font-bold text-slate-900">{summary.total || 0}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <div className="text-sm text-emerald-700">Granted</div>
          <div className="text-2xl font-bold text-emerald-900">{summary.granted || 0}</div>
          <div className="text-xs text-emerald-600">₹{(summary.totalGranted || 0).toLocaleString()}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="text-sm text-amber-700">Untransferred</div>
          <div className="text-2xl font-bold text-amber-900">₹{(summary.untransferred || 0).toLocaleString()}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-sm text-blue-700">Pending/Waiting</div>
          <div className="text-2xl font-bold text-blue-900">{(summary.pending || 0) + (summary.waiting || 0)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm"
          disabled={disabled}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={disabled}
          className="px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Add Grant Application
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : filteredApps.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No grant applications yet. Click "Add Grant Application" to start tracking.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Organization</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Deadline</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => {
                  const statusDef = STATUS_OPTIONS.find(s => s.value === app.status) || STATUS_OPTIONS[0];
                  const Icon = statusDef.icon;
                  // Only granted funds can be marked as received (pending_transfer means still with funder)
                  const canMarkReceived = app.status === 'granted' && !app.receivedToOrg;
                  return (
                    <tr key={app._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{app.programName}</td>
                      <td className="px-4 py-3 text-slate-700">{app.organizationName}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{app.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-${statusDef.color}-50 text-${statusDef.color}-700 border border-${statusDef.color}-200`}>
                          <Icon className="w-3 h-3" /> {statusDef.label}
                        </span>
                        {app.receivedToOrg && <span className="ml-1 text-xs text-emerald-600">(Received to org)</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{app.deadline ? new Date(app.deadline).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setDetailsItem(app); setShowDetails(true); }} className="p-1.5 rounded hover:bg-slate-50 text-slate-600" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canMarkReceived && (
                            <button onClick={() => handleMarkReceived(app)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Mark received to Untransferred">
                              <Inbox className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleEdit(app)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(app._id)} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">{editingItem ? 'Edit Grant Application' : 'Add Grant Application'}</h3>
              <button className="text-slate-500 hover:text-slate-700" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Program Name *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.programName} onChange={(e) => setForm({...form, programName: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Organization/Funder *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.organizationName} onChange={(e) => setForm({...form, organizationName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                  <input required type="number" className="w-full border rounded-lg px-3 py-2" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2" value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Application Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" value={form.applicationDate} onChange={(e) => setForm({...form, applicationDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deadline</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" value={form.deadline} onChange={(e) => setForm({...form, deadline: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} placeholder="e.g., Education, Health" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Funding Period</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.fundingPeriod} onChange={(e) => setForm({...form, fundingPeriod: e.target.value})} placeholder="e.g., 2024-2025" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.contactPerson} onChange={(e) => setForm({...form, contactPerson: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Email</label>
                  <input type="email" className="w-full border rounded-lg px-3 py-2" value={form.contactEmail} onChange={(e) => setForm({...form, contactEmail: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea rows={3} className="w-full border rounded-lg px-3 py-2" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDetails && <GrantApplicationDetails application={detailsItem} onClose={() => setShowDetails(false)} statusOptions={STATUS_OPTIONS} />}

      <div className="mt-6 text-sm text-slate-600">
        Manage received (unassigned) funds under <a href="/organization/untransferred" className="text-emerald-700 underline">Untransferred Funds</a>.
      </div>
    </div>
  );
}
