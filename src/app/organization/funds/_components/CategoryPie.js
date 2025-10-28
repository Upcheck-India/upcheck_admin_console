import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { resolveTypeColor } from './constants';

export default function CategoryPie({ data, numberFmt }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Category Breakdown</h3>
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={resolveTypeColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => numberFmt ? numberFmt(v) : v} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-slate-500">No data</div>
      )}
    </div>
  );
}
