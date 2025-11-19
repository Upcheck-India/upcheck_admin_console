import { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { resolveTypeColor } from './constants';

export default function TypeBreakdowns({ inflowPieData, outflowPieData, items, numberFmt }) {
  const [selectedType, setSelectedType] = useState('grant');
  const [mode, setMode] = useState('types'); // 'types' | 'sources'
  const [outMode, setOutMode] = useState('categories'); // 'categories' | 'recipients'
  const initialOut = (outflowPieData && outflowPieData[0]?.name) || 'payroll';
  const [selectedOutCategory, setSelectedOutCategory] = useState(initialOut);

  const typeTotals = inflowPieData || [];

  const breakdownByType = useMemo(() => {
    const data = items
      .filter((it) => it.kind === 'in' && it.inflowType === selectedType)
      .reduce((map, it) => {
        const k = (it.source || it.title || 'Unknown').trim();
        map[k] = (map[k] || 0) + (Number(it.amount) || 0);
        return map;
      }, {});
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [items, selectedType]);

  const outflowRecipients = useMemo(() => {
    const data = items
      .filter((it) => it.kind === 'out' && (it.expenseType || it.category) === selectedOutCategory)
      .reduce((map, it) => {
        const k = (it.counterparty || it.title || 'Unknown').trim();
        map[k] = (map[k] || 0) + (Number(it.amount) || 0);
        return map;
      }, {});
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [items, selectedOutCategory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inflows - Mode Toggle and Primary Pie */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900">Inflows</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('types')}
              className={`text-xs px-2 py-1 rounded border ${mode === 'types' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Types
            </button>
            <button
              type="button"
              onClick={() => setMode('sources')}
              className={`text-xs px-2 py-1 rounded border ${mode === 'sources' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Sources
            </button>
          </div>
        </div>
        {mode === 'types' ? (
          typeTotals && typeTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeTotals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label
                  onClick={(entry) => setSelectedType(entry?.name)}
                >
                  {typeTotals.map((entry, index) => (
                    <Cell key={`cell-in-${index}`} fill={resolveTypeColor(entry.name)} stroke={entry.name === selectedType ? '#111827' : undefined} strokeWidth={entry.name === selectedType ? 2 : 1} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => (numberFmt ? numberFmt(v) : v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No data</div>
          )
        ) : (
          breakdownByType && breakdownByType.length > 0 ? (
            <>
              <div className="flex items-center justify-end mb-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                >
                  {(typeTotals || []).map((t) => (
                    <option key={t.name} value={t.name}>{t.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={breakdownByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                    {breakdownByType.map((entry, index) => (
                      <Cell key={`cell-br-${index}`} fill={resolveTypeColor(selectedType)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => (numberFmt ? numberFmt(v) : v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No entries for this type</div>
          )
        )}
      </div>

      {/* Secondary panel - Outflows */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900">Outflows</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOutMode('categories')}
              className={`text-xs px-2 py-1 rounded border ${outMode === 'categories' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => setOutMode('recipients')}
              className={`text-xs px-2 py-1 rounded border ${outMode === 'recipients' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Recipients
            </button>
          </div>
        </div>
        {outMode === 'categories' ? (
          outflowPieData && outflowPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={outflowPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                  {outflowPieData.map((entry, index) => (
                    <Cell key={`cell-out-${index}`} fill={resolveTypeColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => (numberFmt ? numberFmt(v) : v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No data</div>
          )
        ) : (
          outflowRecipients && outflowRecipients.length > 0 ? (
            <>
              <div className="flex items-center justify-end mb-2">
                <select
                  value={selectedOutCategory}
                  onChange={(e) => setSelectedOutCategory(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                >
                  {(outflowPieData || []).map((t) => (
                    <option key={t.name} value={t.name}>{t.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={outflowRecipients} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                    {outflowRecipients.map((entry, index) => (
                      <Cell key={`cell-or-${index}`} fill={resolveTypeColor(selectedOutCategory)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => (numberFmt ? numberFmt(v) : v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No recipients for this category</div>
          )
        )}
      </div>
    </div>
  );
}
