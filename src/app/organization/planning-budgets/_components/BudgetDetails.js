import { X, Calendar, DollarSign, PieChart as PieIcon, Target, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const BUDGET_TYPES = {
  annual_fiscal: 'Annual Fiscal Budget',
  project: 'Project Budget',
  monthly: 'Monthly Budget',
  service: 'Service Budget',
  custom: 'Custom Budget',
};

// Approval workflow chip styles (STATIC tailwind class map)
const WORKFLOW_STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  locked: 'bg-purple-50 text-purple-700 border border-purple-200',
};
const WORKFLOW_STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', locked: 'Locked' };

export default function BudgetDetails({ budget, grants, onClose }) {
  if (!budget) return null;

  const linkedGrantDetails = (budget.linkedGrants || []).map(gid => 
    grants.find(g => g._id === gid)
  ).filter(Boolean);

  const linkedGrantsTotal = linkedGrantDetails.reduce((sum, g) => sum + (g?.amount || 0), 0);

  // Budget-vs-actual totals (from the enriched API response; tolerate older
  // objects that lack the actual/remaining fields).
  const categories = Array.isArray(budget.categories) ? budget.categories : [];
  const totalAllocated = Number(budget.totalAllocated) || 0;
  const totalActual = Number(budget.totalActual) || 0;
  const totalRemaining = budget.totalRemaining != null ? Number(budget.totalRemaining) : totalAllocated - totalActual;
  const totalVariancePct = budget.totalVariancePct != null
    ? Number(budget.totalVariancePct)
    : (totalAllocated > 0 ? Math.round(((totalActual - totalAllocated) / totalAllocated) * 10000) / 100 : null);
  const overBudget = totalActual > totalAllocated;
  const workflowStatus = budget.workflowStatus || 'draft';

  const visibleCategories = categories
    .filter(c => (Number(c.allocated) || 0) > 0 || (Number(c.actual) || 0) > 0)
    .sort((a, b) => (Number(b.allocated) || 0) - (Number(a.allocated) || 0));

  const chartData = categories
    .filter(c => (Number(c.allocated) || 0) > 0)
    .map(c => ({
      name: c.categoryLabel || c.category,
      value: Number(c.allocated) || 0
    }))
    .sort((a, b) => b.value - a.value);

  const barData = categories
    .filter(c => (Number(c.allocated) || 0) > 0 || (Number(c.actual) || 0) > 0)
    .map(c => ({
      category: (c.categoryLabel || c.category).slice(0, 15),
      allocated: Number(c.allocated) || 0,
      actual: Number(c.actual) || 0,
    }))
    .sort((a, b) => b.allocated - a.allocated)
    .slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between shrink-0">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{budget.name}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm px-3 py-1.5 rounded-full ${
                budget.type === 'actual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                budget.type === 'available' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                budget.type === 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {budget.type === 'actual' ? 'Actual Budget' : budget.type === 'available' ? 'Available Budget' : budget.type === 'custom' ? 'Custom Budget' : 'Mock Budget'}
              </span>
              <span className="text-sm px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {BUDGET_TYPES[budget.budgetType] || budget.budgetType}
              </span>
              <span className="text-sm px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {budget.fiscalYear}
              </span>
              <span className={`text-sm px-3 py-1.5 rounded-full ${WORKFLOW_STATUS_STYLES[workflowStatus] || WORKFLOW_STATUS_STYLES.draft}`}>
                {WORKFLOW_STATUS_LABELS[workflowStatus] || 'Draft'}
              </span>
            </div>
            {budget.carriedForwardFrom && (
              <div className="mt-2 text-sm text-teal-700">
                Carried forward from {budget.carriedForwardFrom.fiscalYear || 'a previous budget'}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Amount Section — budget vs actual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Total Allocated</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900">
                ₹{totalAllocated.toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-emerald-700">
                Across {categories.length} categories
              </div>
              {(budget.baseAmount != null) && (
                <div className="mt-2 text-sm text-emerald-800">
                  Scope amount: <span className="font-semibold">₹{Number(budget.baseAmount).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className={`rounded-xl p-5 border ${overBudget ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`flex items-center gap-2 mb-2 ${overBudget ? 'text-red-700' : 'text-slate-600'}`}>
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Actual Spent</span>
              </div>
              <div className={`text-2xl font-bold ${overBudget ? 'text-red-700' : 'text-slate-900'}`}>
                ₹{totalActual.toLocaleString()}
              </div>
              {totalVariancePct != null && (
                <div className={`mt-2 text-sm ${overBudget ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                  {totalVariancePct > 0 ? '+' : ''}{totalVariancePct}% vs allocated
                </div>
              )}
            </div>
            <div className={`rounded-xl p-5 border ${totalRemaining < 0 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
              <div className={`flex items-center gap-2 mb-2 ${totalRemaining < 0 ? 'text-red-700' : 'text-teal-700'}`}>
                <Target className="w-5 h-5" />
                <span className="text-sm font-medium">Remaining</span>
              </div>
              <div className={`text-2xl font-bold ${totalRemaining < 0 ? 'text-red-700' : 'text-teal-900'}`}>
                {totalRemaining < 0 ? `-₹${Math.abs(totalRemaining).toLocaleString()}` : `₹${totalRemaining.toLocaleString()}`}
              </div>
              <div className={`mt-2 text-sm ${totalRemaining < 0 ? 'text-red-700 font-semibold' : 'text-teal-700'}`}>
                {totalRemaining < 0 ? 'Over budget' : 'Left to spend'}
              </div>
            </div>
          </div>

          {/* Linked Grants */}
          {linkedGrantDetails.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <Target className="w-4 h-4" />
                <span className="text-sm font-semibold">Linked Grants ({linkedGrantDetails.length})</span>
                <span className="text-sm text-slate-500 ml-auto">Total: ₹{linkedGrantsTotal.toLocaleString()}</span>
              </div>
              <div className="space-y-2">
                {linkedGrantDetails.map(grant => (
                  <div key={grant._id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{grant.programName}</div>
                      <div className="text-xs text-slate-500">{grant.organizationName}</div>
                    </div>
                    <div className="font-semibold text-emerald-700">₹{grant.amount.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visualizations */}
          {chartData.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <PieIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">Budget Allocation Breakdown</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-2 text-center">Distribution</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie 
                        data={chartData} 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={100} 
                        fill="#8884d8" 
                        dataKey="value"
                        label={(entry) => entry.name}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart — allocated vs actual */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-2 text-center">Top Categories: Allocated vs Actual</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                      <YAxis dataKey="category" type="category" width={100} style={{ fontSize: '11px' }} />
                      <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="allocated" name="Allocated" fill="#10b981" />
                      <Bar dataKey="actual" name="Actual" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Category Details Table */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-slate-600 mb-3">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-semibold">Category Allocations vs Actuals</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Allocated</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actual</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Remaining</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Variance</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCategories.map((cat, idx) => {
                    const alloc = Number(cat.allocated) || 0;
                    const actual = Number(cat.actual) || 0;
                    const remaining = cat.remaining != null ? Number(cat.remaining) : alloc - actual;
                    const over = actual > alloc;
                    const variancePct = cat.variancePct != null
                      ? Number(cat.variancePct)
                      : (alloc > 0 ? Math.round(((actual - alloc) / alloc) * 10000) / 100 : null);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">{cat.categoryLabel || cat.category}</td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-700">₹{alloc.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${over ? 'text-red-600' : 'text-slate-700'}`}>₹{actual.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${remaining < 0 ? 'text-red-600' : 'text-teal-700'}`}>
                          {remaining < 0 ? `-₹${Math.abs(remaining).toLocaleString()}` : `₹${remaining.toLocaleString()}`}
                        </td>
                        <td className={`px-4 py-2 text-right text-sm ${over ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {variancePct != null ? `${variancePct > 0 ? '+' : ''}${variancePct}%` : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-600 text-sm">{cat.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {budget.notes && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-semibold">Notes</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-slate-700 whitespace-pre-wrap">
                {budget.notes}
              </div>
            </div>
          )}

          {/* Audit Info */}
          <div className="border-t pt-4">
            <div className="text-xs text-slate-500 space-y-1">
              {budget.createdAt && (
                <div>
                  Created: {new Date(budget.createdAt).toLocaleString('en-IN')}
                  {budget.createdBy?.username && ` by ${budget.createdBy.username}`}
                </div>
              )}
              {budget.updatedAt && (
                <div>
                  Last updated: {new Date(budget.updatedAt).toLocaleString('en-IN')}
                  {budget.updatedBy?.username && ` by ${budget.updatedBy.username}`}
                </div>
              )}
              {budget.submittedAt && (
                <div>
                  Submitted: {new Date(budget.submittedAt).toLocaleString('en-IN')}
                  {budget.submittedBy?.username && ` by ${budget.submittedBy.username}`}
                </div>
              )}
              {budget.approvedAt && (
                <div className="text-emerald-700">
                  Approved: {new Date(budget.approvedAt).toLocaleString('en-IN')}
                  {budget.approvedBy?.username && ` by ${budget.approvedBy.username}`}
                </div>
              )}
              {budget.lockedAt && (
                <div className="text-purple-700">
                  Locked: {new Date(budget.lockedAt).toLocaleString('en-IN')}
                  {budget.lockedBy?.username && ` by ${budget.lockedBy.username}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
