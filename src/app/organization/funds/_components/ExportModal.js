import { useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';

const ALL_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'kind', label: 'Type' },
  { key: 'amount', label: 'Amount' },
  { key: 'title', label: 'Title' },
  { key: 'notes', label: 'Notes' },
  { key: 'category', label: 'Category' },
  { key: 'inflowType', label: 'Inflow Type' },
  { key: 'expenseType', label: 'Expense Type' },
  { key: 'source', label: 'Source' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'reference', label: 'Reference' },
  { key: 'tags', label: 'Tags' },
  { key: 'isTransfer', label: 'Is Transfer' },
];

export default function ExportModal({ onClose, items = [], numberFmt, defaultFilename }) {
  const [format, setFormat] = useState('csv'); // csv|excel|pdf
  const [filename, setFilename] = useState(defaultFilename || 'funds');
  const [includeTransfers, setIncludeTransfers] = useState(true);
  const [kind, setKind] = useState(''); // '' | 'in' | 'out'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCols, setSelectedCols] = useState(ALL_COLUMNS.map((c) => c.key));

  const filtered = useMemo(() => {
    return (items || []).filter((it) => {
      if (!includeTransfers && it.isTransfer) return false;
      if (kind && it.kind !== kind) return false;
      const d = new Date(it.date);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        if (d > ed) return false;
      }
      return true;
    });
  }, [items, includeTransfers, kind, startDate, endDate]);

  const toggleCol = (key) => {
    setSelectedCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const mapRow = (it) => {
    const row = {};
    selectedCols.forEach((k) => {
      let v = it[k];
      if (k === 'date') v = it.date ? new Date(it.date).toLocaleDateString() : '';
      if (k === 'tags') v = Array.isArray(it.tags) ? it.tags.join('; ') : (it.tagsText || '');
      if (k === 'amount') v = it.amount;
      if (k === 'kind') v = it.kind === 'in' ? 'Received' : 'Spent';
      if (k === 'isTransfer') v = it.isTransfer ? 'Yes' : 'No';
      row[k] = v != null ? v : '';
    });
    return row;
  };

  const asCSV = () => {
    const headers = selectedCols.map((k) => ALL_COLUMNS.find((c) => c.key === k)?.label || k);
    const rows = filtered.map(mapRow);
    const csv = [headers.join(',')]
      .concat(
        rows.map((r) =>
          selectedCols
            .map((k) => escapeCsv(r[k]))
            .join(',')
        )
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${filename || 'export'}.csv`);
  };

  const asExcel = () => {
    // Simple HTML table compatible with Excel
    const headers = selectedCols.map((k) => ALL_COLUMNS.find((c) => c.key === k)?.label || k);
    const rows = filtered.map(mapRow);
    const html = `\uFEFF<html><head><meta charset="UTF-8"></head><body><table border="1">${
      '<tr>' + headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>'
    }${
      rows
        .map(
          (r) =>
            '<tr>' +
            selectedCols
              .map((k) => `<td>${escapeHtml(r[k])}</td>`)
              .join('') +
            '</tr>'
        )
        .join('')
    }</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    triggerDownload(blob, `${filename || 'export'}.xls`);
  };

  const asPDF = () => {
    // Open a printable window; user can save as PDF
    const headers = selectedCols.map((k) => ALL_COLUMNS.find((c) => c.key === k)?.label || k);
    const rows = filtered.map(mapRow);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${
      filename || 'export'
    }</title><style>body{font-family:Arial,sans-serif;padding:16px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #e5e7eb;padding:8px;font-size:12px;text-align:left} th{background:#f1f5f9}</style></head><body>${
      `<h2>${escapeHtml(filename || 'Export')}</h2>`
    }<table><thead><tr>${headers
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(
        (r) =>
          '<tr>' +
          selectedCols
            .map((k) => `<td>${escapeHtml(r[k])}</td>`)
            .join('') +
          '</tr>'
      )
      .join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const handleExport = () => {
    if (format === 'csv') return asCSV();
    if (format === 'excel') return asExcel();
    if (format === 'pdf') return asPDF();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Export Data</div>
          <button onClick={onClose} className="p-2 rounded-lg border hover:bg-slate-50"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Format</label>
              <select className="w-full border rounded-lg px-3 py-2" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="csv">CSV (.csv)</option>
                <option value="excel">Excel (.xls)</option>
                <option value="pdf">PDF (print)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Filename</label>
              <input className="w-full border rounded-lg px-3 py-2" value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded-lg px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All</option>
                <option value="in">Inflow (Received)</option>
                <option value="out">Outflow (Spent)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="incltr" type="checkbox" className="accent-emerald-600" checked={includeTransfers} onChange={(e) => setIncludeTransfers(e.target.checked)} />
              <label htmlFor="incltr" className="text-sm">Include internal transfers</label>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Columns</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-50">
                  <input type="checkbox" className="accent-emerald-600" checked={selectedCols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500">Exporting {filtered.length} of {items.length} records</div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function escapeCsv(val) {
  if (val == null) return '';
  let s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeHtml(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
