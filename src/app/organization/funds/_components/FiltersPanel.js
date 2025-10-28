import { Search, RefreshCcw } from 'lucide-react';
import { CATEGORIES } from './constants';

const PRESETS = [
  { v: 'today', l: 'Today' },
  { v: 'last7', l: 'Last 7 days' },
  { v: 'thisWeek', l: 'This week' },
  { v: 'thisMonth', l: 'This month' },
  { v: 'last30', l: 'Last 30 days' },
  { v: 'thisQuarter', l: 'This quarter' },
  { v: 'thisYear', l: 'This year' },
  { v: 'custom', l: 'Custom' },
];

const GROUPS = [
  { v: 'day', l: 'Daily' },
  { v: 'week', l: 'Weekly' },
  { v: 'month', l: 'Monthly' },
  { v: 'year', l: 'Annual' },
];

export default function FiltersPanel({ filters, setFilters, onApply, onClear, disabled = false }) {
  const isCustom = (filters.datePreset || 'thisYear') === 'custom';
  return (
    <div className="mb-6 p-6 rounded-2xl bg-white border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Title or notes..."
              disabled={disabled}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            disabled={disabled}
            className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
          <select
            value={filters.kind}
            onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
            disabled={disabled}
            className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All types</option>
            <option value="in">Received</option>
            <option value="out">Spent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
          <select
            value={filters.datePreset || 'thisYear'}
            onChange={(e) => setFilters((f) => ({ ...f, datePreset: e.target.value }))}
            disabled={disabled}
            className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {PRESETS.map((p) => (
              <option key={p.v} value={p.v}>{p.l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Group by</label>
          <select
            value={filters.groupBy || 'month'}
            onChange={(e) => setFilters((f) => ({ ...f, groupBy: e.target.value }))}
            disabled={disabled}
            className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {GROUPS.map((g) => (
              <option key={g.v} value={g.v}>{g.l}</option>
            ))}
          </select>
        </div>
        {isCustom && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                disabled={disabled}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                disabled={disabled}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end mt-4 gap-2">
        <button
          onClick={onClear}
          disabled={disabled}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
        >
          Clear
        </button>
        <button
          onClick={onApply}
          disabled={disabled}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw className="w-4 h-4" />
          Apply
        </button>
      </div>
      {disabled && (
        <div className="mt-3 text-sm text-slate-500">Select a billing account to enable filters and data.</div>
      )}
    </div>
  );
}
