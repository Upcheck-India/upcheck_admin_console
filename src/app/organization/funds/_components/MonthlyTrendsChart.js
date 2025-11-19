import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function MonthlyTrendsChart({ data, numberFmt, groupBy = 'month' }) {
  const xKey = groupBy === 'year' ? 'year' : groupBy === 'week' ? 'week' : groupBy === 'day' ? 'day' : 'month';
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Monthly Trends</h3>
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip formatter={(v) => numberFmt(v)} />
            <Legend />
            <Area type="monotone" dataKey="received" stroke="#10b981" fill="#10b981" fillOpacity={0.4} name="Received" />
            <Area type="monotone" dataKey="spent" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} name="Spent" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-slate-500">No data</div>
      )}
    </div>
  );
}
