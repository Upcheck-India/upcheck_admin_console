import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = {
  received: '#10b981',
  spent: '#ef4444',
};

export default function InflowOutflowDonut({ summary, numberFmt }) {
  const data = [
    { name: 'Received', value: Math.max(0, Number(summary?.received || 0)), key: 'received' },
    { name: 'Spent', value: Math.max(0, Number(summary?.spent || 0)), key: 'spent' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Inflow vs Outflow</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            label={(entry) => `${entry.name} ${(entry.value / total * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-io-${index}`} fill={COLORS[entry.key]} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [numberFmt ? numberFmt(v) : v, n]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
