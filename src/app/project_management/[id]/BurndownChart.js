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
    <div className="bg-surface border border-border-default rounded-xl shadow-sm mb-6 overflow-hidden text-text-primary">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-surface cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <TrendingDown className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-text-primary text-sm">{sprint.name} Burndown</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-medium">{done} done</span>
            <span className="bg-surface-variant text-text-secondary border border-border-default px-2 py-0.5 rounded-full font-medium">{remaining} remaining</span>
            <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">{progressPct}% complete</span>
          </div>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-text-tertiary" /> : <ChevronUp className="w-4 h-4 text-text-tertiary" />}
      </div>
      {!collapsed && (
        <div className="p-4 bg-surface">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ fontSize: 12, backgroundColor: 'var(--surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ideal" stroke="var(--text-tertiary)" strokeDasharray="5 5" name="Ideal" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default BurndownChart;