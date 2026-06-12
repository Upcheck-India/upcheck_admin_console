'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IdCard, Loader2, Save, Check } from 'lucide-react';
import HRNav from '../_components/HRNav';
import {
  GENDERS, MARITAL_STATUSES, BLOOD_GROUPS,
} from '../../../lib/hr/employee';

const EMPLOYMENT_STATUS_LABELS = {
  active: 'Active', on_leave: 'On leave', suspended: 'Suspended', terminated: 'Terminated',
};

const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const titleCase = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

function emptyForm() {
  return {
    personalEmail: '', personalPhone: '', dateOfBirth: '', gender: '',
    maritalStatus: '', bloodGroup: '', nationality: '',
    address: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
    emergencyContact: { name: '', relationship: '', phone: '' },
    panNumber: '', aadhaarNumber: '', uanNumber: '', pfNumber: '', esiNumber: '',
    bankDetails: { accountName: '', accountNumber: '', ifsc: '', bankName: '' },
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState('me');
  const [data, setData] = useState(null); // { employee, manager, isSelf, canManage }
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

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
    setError('');
    try {
      const res = await fetch(`/api/hr/employees/${selectedId}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Failed to load profile');
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
      const e = json.employee;
      setForm({
        personalEmail: e.personalEmail || '', personalPhone: e.personalPhone || '',
        dateOfBirth: toInputDate(e.dateOfBirth), gender: e.gender || '',
        maritalStatus: e.maritalStatus || '', bloodGroup: e.bloodGroup || '',
        nationality: e.nationality || '',
        address: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India', ...(e.address || {}) },
        emergencyContact: { name: '', relationship: '', phone: '', ...(e.emergencyContact || {}) },
        panNumber: e.panNumber || '', aadhaarNumber: e.aadhaarNumber || '',
        uanNumber: e.uanNumber || '', pfNumber: e.pfNumber || '', esiNumber: e.esiNumber || '',
        bankDetails: { accountName: '', accountNumber: '', ifsc: '', bankName: '', ...(e.bankDetails || {}) },
      });
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { if (currentUser) load(); }, [currentUser, load]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (group, k, v) => setForm((f) => ({ ...f, [group]: { ...f[group], [k]: v } }));

  const showStatutory = data && (data.isSelf || data.canManage);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/hr/employees/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Failed to save'); return; }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(0), 2500);
    } finally {
      setSaving(false);
    }
  };

  const emp = data?.employee;
  const fullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.username : '';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <HRNav />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <IdCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Profile</h1>
              <p className="text-sm text-gray-500">Personal, emergency and statutory details.</p>
            </div>
          </div>
          {canManage && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="me">My profile</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {`${e.firstName || ''} ${e.lastName || ''}`.trim() || e.username}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : !emp ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">{error || 'Profile not available.'}</div>
        ) : (
          <form onSubmit={save} className="space-y-6">
            {/* Employment summary (read-only) */}
            <section className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-lg font-semibold">
                  {(fullName[0] || '?').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{fullName}</h2>
                  <p className="text-sm text-gray-500">{emp.jobTitle || 'No title'} · {emp.department || 'Unassigned'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><span className="block text-xs text-gray-400">Username</span>{emp.username}</div>
                <div><span className="block text-xs text-gray-400">Work email</span>{emp.email || '—'}</div>
                <div><span className="block text-xs text-gray-400">Role</span>{emp.role || '—'}</div>
                <div><span className="block text-xs text-gray-400">Employment</span>{titleCase(emp.employmentType)}</div>
                <div><span className="block text-xs text-gray-400">Status</span>{EMPLOYMENT_STATUS_LABELS[emp.employmentStatus] || '—'}</div>
                <div><span className="block text-xs text-gray-400">Manager</span>{data.manager ? (`${data.manager.firstName || ''} ${data.manager.lastName || ''}`.trim() || data.manager.username) : '—'}</div>
                <div><span className="block text-xs text-gray-400">Start date</span>{emp.startDate ? new Date(emp.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—'}</div>
                <div><span className="block text-xs text-gray-400">Location</span>{emp.location || '—'}</div>
              </div>
              <p className="mt-3 text-xs text-gray-400">Employment fields are managed from the Employees tab.</p>
            </section>

            {/* Personal details */}
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Personal details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Personal email"><input type="email" className={inputCls} value={form.personalEmail} onChange={(e) => setField('personalEmail', e.target.value)} /></Field>
                <Field label="Personal phone"><input className={inputCls} value={form.personalPhone} onChange={(e) => setField('personalPhone', e.target.value)} /></Field>
                <Field label="Date of birth"><input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} /></Field>
                <Field label="Gender">
                  <select className={inputCls} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                    <option value="">—</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}
                  </select>
                </Field>
                <Field label="Marital status">
                  <select className={inputCls} value={form.maritalStatus} onChange={(e) => setField('maritalStatus', e.target.value)}>
                    <option value="">—</option>
                    {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
                  </select>
                </Field>
                <Field label="Blood group">
                  <select className={inputCls} value={form.bloodGroup} onChange={(e) => setField('bloodGroup', e.target.value)}>
                    <option value="">—</option>
                    {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Nationality"><input className={inputCls} value={form.nationality} onChange={(e) => setField('nationality', e.target.value)} /></Field>
              </div>
            </section>

            {/* Address */}
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Address line 1"><input className={inputCls} value={form.address.line1} onChange={(e) => setNested('address', 'line1', e.target.value)} /></Field>
                <Field label="Address line 2"><input className={inputCls} value={form.address.line2} onChange={(e) => setNested('address', 'line2', e.target.value)} /></Field>
                <Field label="City"><input className={inputCls} value={form.address.city} onChange={(e) => setNested('address', 'city', e.target.value)} /></Field>
                <Field label="State"><input className={inputCls} value={form.address.state} onChange={(e) => setNested('address', 'state', e.target.value)} /></Field>
                <Field label="Pincode"><input className={inputCls} value={form.address.pincode} onChange={(e) => setNested('address', 'pincode', e.target.value)} /></Field>
                <Field label="Country"><input className={inputCls} value={form.address.country} onChange={(e) => setNested('address', 'country', e.target.value)} /></Field>
              </div>
            </section>

            {/* Emergency contact */}
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Emergency contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Name"><input className={inputCls} value={form.emergencyContact.name} onChange={(e) => setNested('emergencyContact', 'name', e.target.value)} /></Field>
                <Field label="Relationship"><input className={inputCls} value={form.emergencyContact.relationship} onChange={(e) => setNested('emergencyContact', 'relationship', e.target.value)} /></Field>
                <Field label="Phone"><input className={inputCls} value={form.emergencyContact.phone} onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)} /></Field>
              </div>
            </section>

            {/* Statutory + financial */}
            {showStatutory && (
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Statutory &amp; bank details</h3>
                <p className="text-xs text-gray-400 mb-4">Sensitive information — visible to you and HR managers only.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="PAN"><input className={`${inputCls} uppercase`} value={form.panNumber} onChange={(e) => setField('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></Field>
                  <Field label="Aadhaar"><input className={inputCls} value={form.aadhaarNumber} onChange={(e) => setField('aadhaarNumber', e.target.value)} placeholder="12 digits" /></Field>
                  <Field label="UAN"><input className={inputCls} value={form.uanNumber} onChange={(e) => setField('uanNumber', e.target.value)} /></Field>
                  <Field label="PF number"><input className={inputCls} value={form.pfNumber} onChange={(e) => setField('pfNumber', e.target.value)} /></Field>
                  <Field label="ESI number"><input className={inputCls} value={form.esiNumber} onChange={(e) => setField('esiNumber', e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <Field label="Account holder name"><input className={inputCls} value={form.bankDetails.accountName} onChange={(e) => setNested('bankDetails', 'accountName', e.target.value)} /></Field>
                  <Field label="Account number"><input className={inputCls} value={form.bankDetails.accountNumber} onChange={(e) => setNested('bankDetails', 'accountNumber', e.target.value)} /></Field>
                  <Field label="IFSC"><input className={`${inputCls} uppercase`} value={form.bankDetails.ifsc} onChange={(e) => setNested('bankDetails', 'ifsc', e.target.value.toUpperCase())} placeholder="HDFC0001234" /></Field>
                  <Field label="Bank name"><input className={inputCls} value={form.bankDetails.bankName} onChange={(e) => setNested('bankDetails', 'bankName', e.target.value)} /></Field>
                </div>
              </section>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3 sticky bottom-4">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 shadow">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </button>
              {savedAt > 0 && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Check className="h-4 w-4" /> Saved</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
