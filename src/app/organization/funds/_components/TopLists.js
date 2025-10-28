export default function TopLists({ items, numberFmt }) {
  const inflows = items.filter((it) => it.kind === 'in');
  const outflows = items.filter((it) => it.kind === 'out');

  const topSources = topBy(inflows, (it) => (it.source || it.title || 'Unknown').trim());
  const topRecipients = topBy(outflows, (it) => (it.counterparty || it.title || 'Unknown').trim());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ListCard title="Top Inflow Sources" rows={topSources} numberFmt={numberFmt} accent="text-emerald-700" />
      <ListCard title="Top Recipients" rows={topRecipients} numberFmt={numberFmt} accent="text-slate-900" />
    </div>
  );
}

function topBy(arr, keyFn) {
  const map = {};
  arr.forEach((it) => {
    const k = keyFn(it);
    map[k] = (map[k] || 0) + (Number(it.amount) || 0);
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function ListCard({ title, rows, numberFmt, accent }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">{title}</h3>
      {rows.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-500">No data</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center justify-between py-2">
              <div className="text-sm text-slate-700 truncate pr-4">{r.name}</div>
              <div className={`text-sm font-semibold ${accent}`}>{numberFmt ? numberFmt(r.value) : r.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
