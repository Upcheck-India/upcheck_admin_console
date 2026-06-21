import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

const BurndownChart = ({ sprint, tasks }) => {
  const [collapsed, setCollapsed] = useState(false);

  const chartData = useMemo(() => {
    if (!sprint?.startDate || !sprint?.endDate) return [];

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'Done').length;
    const remaining = total - done;

    const days = [];
    const current = new Date(start);
    let dayIndex = 0;
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    while (current <= end) {
      const isPast = current <= today;
      const idealRemaining = Math.max(0, total - Math.round((total / totalDays) * dayIndex));

      days.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ideal: idealRemaining,
        actual: isPast ? remaining : undefined,
      });

      current.setDate(current.getDate() + 1);
      dayIndex++;
    }
    return days;
  }, [sprint, tasks]);

  if (!sprint?.startDate || !sprint?.endDate || chartData.length === 0) return null;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const remaining = total - done;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <TrendingDown className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-800 text-sm">{sprint.name} Burndown</span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">{done} done</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">{remaining} remaining</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{progressPct}% complete</span>
          </div>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
      </div>
      {!collapsed && (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" name="Ideal" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default BurndownChart;