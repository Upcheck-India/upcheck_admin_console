export default function QuickStats({ items, monthlyTrends, numberFmt }) {
  const totalTx = items.length;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = monthlyTrends.find((m) => (m.month || m.year || m.week || m.day) === ym || m.month === ym);
  const avgIn = avg(monthlyTrends.filter((t) => t.received > 0).map((t) => t.received));
  const avgOut = avg(monthlyTrends.filter((t) => t.spent > 0).map((t) => t.spent));
  const netThisMonth = (thisMonth?.received || 0) - (thisMonth?.spent || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card label="Avg Monthly Inflow" value={numberFmt(avgIn)} color="text-emerald-700" />
      <Card label="Avg Monthly Outflow" value={numberFmt(avgOut)} color="text-red-700" />
      <Card label="Net This Month" value={numberFmt(netThisMonth)} color={netThisMonth >= 0 ? 'text-emerald-700' : 'text-red-700'} />
      <Card label="Transactions" value={totalTx.toLocaleString()} color="text-slate-700" />
    </div>
  );
}

function avg(arr) { if (!arr || arr.length === 0) return 0; return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length); }

function Card({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <div className="text-sm text-slate-600">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
