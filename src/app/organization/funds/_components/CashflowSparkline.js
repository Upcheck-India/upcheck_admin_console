import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function CashflowSparkline({ data, numberFmt }) {
  const series = (data || []).map((d) => ({
    label: d.year || d.week || d.day || d.month,
    received: d.received || 0,
    spent: d.spent || 0,
    net: (d.received || 0) - (d.spent || 0),
  }));

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Cashflow (Net) Trend</h3>
      {series.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" hide />
            <YAxis tickFormatter={(v) => `${Math.round(v/1000)}k`} width={40} />
            <Tooltip formatter={(v, n) => [numberFmt ? numberFmt(v) : v, n]} labelFormatter={(l) => `Period: ${l}`} />
            <Area type="monotone" dataKey="net" stroke="#10b981" fill="url(#netGrad)" name="Net" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-48 flex items-center justify-center text-slate-500">No data</div>
      )}
    </div>
  );
}
