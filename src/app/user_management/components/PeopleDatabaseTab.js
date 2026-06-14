'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Search, Filter, Download, Users, UserCheck, UserX, UserMinus,
  ChevronDown, RefreshCw, Plus, ArrowUpDown, Calendar, Building2,
  Briefcase, Mail, Phone, ExternalLink, MoreHorizontal, AlertTriangle,
  CheckCircle, Clock, Archive, UserPlus, X, Loader2, Database
} from 'lucide-react';
import OffboardingModal from './OffboardingModal';

const DEPARTMENTS = [
  'All Departments', 'Development', 'Testing', 'QA', 'Design', 'Product',
  'Sales', 'Content', 'Marketing', 'Operations', 'HR', 'Finance', 'Unassigned'
];

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',   dot: 'bg-emerald-500', icon: CheckCircle },
  suspended: { label: 'Suspended', color: 'bg-amber-100 text-amber-800 border-amber-200',         dot: 'bg-amber-500',   icon: Clock },
  alumni:    { label: 'Alumni',    color: 'bg-slate-100 text-slate-700 border-slate-200',          dot: 'bg-slate-400',   icon: Archive },
  archived:  { label: 'Archived',  color: 'bg-gray-100 text-gray-600 border-gray-200',             dot: 'bg-gray-400',    icon: Archive },
};

const TYPE_CONFIG = {
  employee:   { label: 'Employee',   color: 'bg-blue-100 text-blue-800' },
  intern:     { label: 'Intern',     color: 'bg-purple-100 text-purple-800' },
  contractor: { label: 'Contractor', color: 'bg-orange-100 text-orange-800' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.employee;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex items-start gap-4`}>
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm font-medium text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function PeopleDatabaseTab({ currentUser }) {
  const [people, setPeople] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Offboarding modal
  const [offboardPerson, setOffboardPerson] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/people/analytics', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchPeople = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const p = resetPage ? 1 : page;
      if (resetPage) setPage(1);
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(deptFilter !== 'All Departments' && { department: deptFilter }),
      });
      const res = await fetch(`/api/people?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch people');
      const data = await res.json();
      setPeople(data.people || []);
      setPagination(data.pagination || { total: 0, totalPages: 1 });
    } catch (e) {
      toast.error(e.message || 'Failed to load people database');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, deptFilter]);

  useEffect(() => {
    fetchPeople(true);
  }, [search, statusFilter, typeFilter, deptFilter]);

  useEffect(() => {
    fetchPeople();
  }, [page]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleMigrate = async () => {
    if (!window.confirm('This will import all existing system users into the People Database. Existing entries will be skipped. Continue?')) return;
    setMigrating(true);
    try {
      const res = await fetch('/api/people/migrate', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');
      toast.success(`Migration complete: ${data.migrated} imported, ${data.skipped} skipped.`);
      fetchPeople(true);
      fetchAnalytics();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMigrating(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(deptFilter !== 'All Departments' && { department: deptFilter }),
      });
      const res = await fetch(`/api/people/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `people-database-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const isAdminUser = currentUser?.role === 'Console admin' || currentUser?.role === 'Admin';

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {analyticsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-24" />
          ))
        ) : (
          <>
            <SummaryCard label="Total Records"  value={analytics?.summary?.total}       icon={Database}   color="bg-slate-100 text-slate-600" />
            <SummaryCard label="Active"          value={analytics?.summary?.active}      icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
            <SummaryCard label="Alumni"          value={analytics?.summary?.alumni}      icon={Archive}    color="bg-slate-100 text-slate-600" />
            <SummaryCard label="Suspended"       value={analytics?.summary?.suspended}   icon={Clock}      color="bg-amber-100 text-amber-600" />
            <SummaryCard label="Employees"       value={analytics?.summary?.employees}   icon={Users}      color="bg-blue-100 text-blue-600" />
            <SummaryCard label="Interns"         value={analytics?.summary?.interns}     icon={UserCheck}  color="bg-purple-100 text-purple-600" />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick status filters */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
          {['all', 'active', 'suspended', 'alumni'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>

        {/* More filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Export */}
          <div className="relative group">
            <button
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 hidden group-hover:block">
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export CSV</button>
              <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export JSON</button>
            </div>
          </div>

          {/* Migrate (Console admin only) */}
          {currentUser?.role === 'Console admin' && (
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {migrating ? 'Migrating...' : 'Sync from Users'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="employee">Employee</option>
              <option value="intern">Intern</option>
              <option value="contractor">Contractor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setDeptFilter('All Departments'); setShowFilters(false); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {pagination.total > 0 ? `${pagination.total} record${pagination.total !== 1 ? 's' : ''} found` : 'No records'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : people.length === 0 ? (
          <div className="p-16 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No people records found</p>
            <p className="text-sm text-gray-400 mt-1">
              {currentUser?.role === 'Console admin'
                ? 'Click "Sync from Users" to import existing system users, or add records manually.'
                : 'No records match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Person', 'ID', 'Type', 'Department', 'Status', 'Joined', 'Exited', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {people.map(person => (
                  <PersonRow
                    key={person._id}
                    person={person}
                    isAdmin={isAdminUser}
                    onOffboard={() => setOffboardPerson(person)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offboarding modal */}
      {offboardPerson && (
        <OffboardingModal
          isOpen={!!offboardPerson}
          person={offboardPerson}
          currentUser={currentUser}
          onClose={() => setOffboardPerson(null)}
          onSuccess={() => {
            setOffboardPerson(null);
            fetchPeople();
            fetchAnalytics();
          }}
        />
      )}
    </div>
  );
}

function PersonRow({ person, isAdmin, onOffboard }) {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ') || '—';
  const joinDate = person.joinDate ? new Date(person.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const exitDate = person.exitDate ? new Date(person.exitDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Person */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {(person.firstName?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <a
              href={`/user_management/people/${person._id}`}
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {fullName}
            </a>
            <div className="text-xs text-gray-400">{person.email || '—'}</div>
          </div>
        </div>
      </td>

      {/* Employee ID */}
      <td className="px-5 py-4">
        <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
          {person.employeeId || '—'}
        </code>
      </td>

      {/* Type */}
      <td className="px-5 py-4">
        <TypeBadge type={person.type} />
      </td>

      {/* Department */}
      <td className="px-5 py-4 text-sm text-gray-600">
        {person.department || 'Unassigned'}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <StatusBadge status={person.status} />
      </td>

      {/* Joined */}
      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">{joinDate}</td>

      {/* Exited */}
      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
        {person.status === 'alumni' || person.exitDate ? exitDate : <span className="text-gray-300">—</span>}
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <a
            href={`/user_management/people/${person._id}`}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View full profile"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          {isAdmin && (
            <button
              onClick={onOffboard}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Manage status / Offboard"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
