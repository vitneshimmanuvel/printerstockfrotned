export function formatINR(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNum(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const DIGIT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export function digitsToWords(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  const groups = [];
  for (let i = 0; i < digits.length; i += 4) {
    const chunk = digits.slice(i, i + 4);
    groups.push(chunk.split('').map((d) => DIGIT_WORDS[Number(d)]).join(' '));
  }
  return groups.join(' - ');
}

export function formatAadhaar(input) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Strictly allows ONLY digits (and optionally a single decimal point).
 */
export function sanitizeNumber(raw, allowDecimal = true) {
  const str = String(raw ?? '');
  if (!allowDecimal) {
    return str.replace(/\D/g, '');
  }
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export function blockNonNumericKey(e, allowDecimal = true) {
  const allowedNav = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ];
  if (allowedNav.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return; // allow copy/paste/select-all
  if (/^[0-9]$/.test(e.key)) return;
  if (allowDecimal && e.key === '.' && !String(e.currentTarget.value || '').includes('.')) return;
  e.preventDefault();
}

export function exportRowsToCSV(columns, rows, filename = 'sheet_export.csv') {
  const visibleCols = columns.filter((c) => c.is_visible);
  const escapeCell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = visibleCols.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) =>
    visibleCols
      .map((col) => {
        let val;
        if (col.column_type === 'formula') val = row.computed?.[col.column_key] ?? 0;
        else if (col.is_system) val = row[col.column_key];
        else val = row.custom_data?.[col.column_key] ?? '';
        return escapeCell(val);
      })
      .join(',')
  );

  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
