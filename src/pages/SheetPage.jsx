import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  blockNonNumericKey,
  formatINR,
  formatNum,
  sanitizeNumber,
  todayISO,
} from '../utils/format';
import {
  IconClose,
  IconEdit,
  IconSearch,
  IconStore,
  IconTrash,
} from '../components/Icons';

const COLORS = ['blue', 'purple', 'emerald', 'cyan', 'amber', 'rose', 'orange', 'slate'];
const MIN_INITIAL_ROWS = 10;

function makeBlankRow(defaultStoreId) {
  return {
    _tempId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    store_id: defaultStoreId || '',
    entry_date: '',
    client_id: null,
    client_phone: '',
    client_name: '',
    service_id: '',
    service_name: '',
    wallet_id: '',
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_details: '',
    amount: '',
    service_charge: '',
    customer_tax: '',
    internal_tax: '',
    payment_mode: '',
    status: '',
    notes: '',
    custom_data: {},
    _dirty: false,
  };
}

function getColumnSignature(storeObj) {
  const cols = Array.isArray(storeObj?.sheet_columns) ? storeObj.sheet_columns : [];
  return cols.map((c) => String(c.label || '').trim().toLowerCase()).join('|');
}

export default function SheetPage() {
  const { user, stores, selectedStoreId, setSelectedStoreId, refreshStores, hasPerm } = useAuth();
  const { showToast } = useToast();

  const canPickStores = hasPerm('view_all_stores');

  // Admin Store Sheet Picker state: null = store cards; array of store IDs = open sheet
  const [activeStoreIds, setActiveStoreIds] = useState(() => {
    if (!canPickStores) return user?.store_id ? [Number(user.store_id)] : [];
    if (selectedStoreId && selectedStoreId !== 'all') return [Number(selectedStoreId)];
    return null;
  });
  const [checkedStoreIds, setCheckedStoreIds] = useState([]);

  const [columns, setColumns] = useState([]);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({});
  const [blankRows, setBlankRows] = useState([]);
  const [services, setServices] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterWallet, setFilterWallet] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Minimal Column Edit Mode (no banner! Just + & Done in header + minus on each column!)
  const [colEditMode, setColEditMode] = useState(false);
  const [colModalOpen, setColModalOpen] = useState(false);
  const [dragColId, setDragColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);
  const [newCol, setNewCol] = useState({
    label: '',
    column_type: 'text',
    formula: '',
    options: '',
    color: 'blue',
    show_total: false,
  });

  const lookupTimersRef = useRef({});
  const sheetWrapRef = useRef(null);

  // Refresh stores when on picker so column previews are always fresh
  useEffect(() => {
    if (canPickStores && activeStoreIds === null) {
      refreshStores();
    }
  }, [canPickStores, activeStoreIds, refreshStores]);

  // Sync with top navbar Store selector when in Live Sheet
  useEffect(() => {
    if (!canPickStores) return;
    if (selectedStoreId && selectedStoreId !== 'all') {
      setActiveStoreIds([Number(selectedStoreId)]);
    } else if (selectedStoreId === 'all') {
      setActiveStoreIds((prev) => (prev && prev.length > 1 ? prev : null));
    }
  }, [canPickStores, selectedStoreId]);

  // If non-admin worker, ensure their store is active
  useEffect(() => {
    if (!canPickStores && user?.store_id) {
      setActiveStoreIds([Number(user.store_id)]);
    }
  }, [canPickStores, user?.store_id]);

  const activeStoreIdsKey = activeStoreIds ? activeStoreIds.join(',') : '';
  const defaultRowStoreId = activeStoreIds && activeStoreIds.length > 0 ? String(activeStoreIds[0]) : '';

  const activeStoreObjects = useMemo(() => {
    if (!activeStoreIds) return [];
    return stores.filter((s) => activeStoreIds.includes(Number(s.id)));
  }, [stores, activeStoreIds]);

  const loadMetadata = useCallback(async () => {
    if (!activeStoreIds || activeStoreIds.length === 0) return;
    try {
      const [svRes, wRes] = await Promise.all([
        api.getServices(),
        api.getWallets({ store_id: activeStoreIds.length === 1 ? activeStoreIds[0] : 'all' }),
      ]);
      setServices(svRes.services || []);
      const allW = wRes.wallets || [];
      setWallets(allW.filter((w) => activeStoreIds.includes(Number(w.store_id))));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [activeStoreIds, showToast]);

  const loadSheet = useCallback(async () => {
    if (!activeStoreIds || activeStoreIds.length === 0) return;
    setLoading(true);
    try {
      const res = await api.getSheetEntries({
        store_ids: activeStoreIds.join(','),
        search,
        service_id: filterService,
        wallet_id: filterWallet,
        status: filterStatus,
        date_from: dateFrom,
        date_to: dateTo,
      });
      const fetched = res.entries || [];
      setEntries(fetched);
      setColumns(res.columns || []);
      setTotals(res.totals || {});

      const neededBlanks = Math.max(0, MIN_INITIAL_ROWS - fetched.length);
      setBlankRows(Array.from({ length: neededBlanks }, () => makeBlankRow(defaultRowStoreId)));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStoreIds, search, filterService, filterWallet, filterStatus, dateFrom, dateTo, defaultRowStoreId, showToast]);

  useEffect(() => {
    if (activeStoreIds && activeStoreIds.length > 0) {
      loadMetadata();
    }
  }, [activeStoreIdsKey, loadMetadata]);

  useEffect(() => {
    if (!activeStoreIds || activeStoreIds.length === 0) return;
    const t = setTimeout(() => {
      loadSheet();
    }, 120);
    return () => clearTimeout(t);
  }, [loadSheet, activeStoreIds]);

  const visibleColumns = useMemo(() => columns.filter((c) => c.is_visible !== false), [columns]);
  const formulaKeys = useMemo(
    () =>
      visibleColumns
        .filter((c) => ['currency', 'number'].includes(c.column_type))
        .map((c) => ({ key: c.column_key, label: c.label })),
    [visibleColumns]
  );

  const computeDraftCalc = useCallback(
    (draft) => {
      const amt = Number(draft.amount) || 0;
      const charge = Number(draft.service_charge) || 0;
      const custTax = Number(draft.customer_tax) || 0;
      const intTax = Number(draft.internal_tax) || 0;
      const totalPayable = Math.round((amt + charge + custTax) * 100) / 100;
      const netProfit = Math.round((charge - intTax) * 100) / 100;
      const w = wallets.find((x) => String(x.id) === String(draft.wallet_id)) || null;
      const walletDeduct = w ? (w.wallet_type === 'cash' ? amt : Math.round((amt + intTax) * 100) / 100) : 0;
      const balanceAfter = w ? Math.round((Number(w.balance) - walletDeduct) * 100) / 100 : null;
      return { totalPayable, netProfit, balanceAfter };
    },
    [wallets]
  );

  const liveTotals = useMemo(() => {
    const out = { ...totals };
    for (const col of visibleColumns) {
      if (!col.show_total) continue;
      let sum = Number(totals[col.column_key]) || 0;
      for (const draft of blankRows) {
        if (!draft._dirty) continue;
        const dc = computeDraftCalc(draft);
        let v = 0;
        if (col.column_key === 'total_payable') v = dc.totalPayable;
        else if (col.column_key === 'net_profit') v = dc.netProfit;
        else if (col.is_system) v = parseFloat(draft[col.column_key]) || 0;
        else v = parseFloat(draft.custom_data?.[col.column_key]) || 0;
        if (Number.isFinite(v)) sum += v;
      }
      out[col.column_key] = Math.round(sum * 100) / 100;
    }
    return out;
  }, [totals, visibleColumns, blankRows, computeDraftCalc]);

  // Multi-store selection compatibility check on Picker view
  const checkedStores = useMemo(
    () => stores.filter((s) => checkedStoreIds.includes(Number(s.id))),
    [stores, checkedStoreIds]
  );

  const checkedColumnsMatch = useMemo(() => {
    if (checkedStores.length < 2) return true;
    const baseSig = getColumnSignature(checkedStores[0]);
    return checkedStores.every((s) => getColumnSignature(s) === baseSig);
  }, [checkedStores]);

  // ===== STORE PICKER VIEW FOR ADMIN =====
  if (canPickStores && (!activeStoreIds || activeStoreIds.length === 0)) {
    const toggleCheck = (id, e) => {
      e.stopPropagation();
      const numId = Number(id);
      setCheckedStoreIds((prev) => (prev.includes(numId) ? prev.filter((x) => x !== numId) : [...prev, numId]));
    };

    const openCombined = () => {
      if (checkedStores.length === 0) return;
      if (checkedStores.length > 1 && !checkedColumnsMatch) {
        showToast('Selected stores have different column names — only stores with matching columns can open combined.', 'error');
        return;
      }
      setColEditMode(false);
      setActiveStoreIds(checkedStores.map((s) => Number(s.id)));
    };

    return (
      <div>
        {checkedStores.length > 0 && (
          <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'flex-end' }}>
            <div className="toolbar-group">
              {checkedStores.length > 1 && (
                <span className={`badge ${checkedColumnsMatch ? 'badge-emerald' : 'badge-rose'}`} style={{ padding: '6px 11px', fontSize: 12 }}>
                  {checkedColumnsMatch ? 'Matching Columns ✓' : 'Different Columns'}
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={checkedStores.length > 1 && !checkedColumnsMatch}
                onClick={openCombined}
              >
                {checkedStores.length === 1
                  ? `Open ${checkedStores[0].name}`
                  : `Open Combined (${checkedStores.length} Stores)`}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCheckedStoreIds([])}>
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="cards-grid">
          {stores.map((store) => {
            const isChecked = checkedStoreIds.includes(Number(store.id));
            const cols = Array.isArray(store.sheet_columns) ? store.sheet_columns : [];
            return (
              <div
                key={store.id}
                className={`store-sheet-card ${isChecked ? 'selected' : ''}`}
                onClick={() => {
                  setColEditMode(false);
                  setSelectedStoreId(String(store.id));
                  setActiveStoreIds([Number(store.id)]);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconStore size={19} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{store.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {store.code} · {store.entry_count || 0} rows · {cols.length} columns
                      </div>
                    </div>
                  </div>

                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569', cursor: 'pointer' }}
                    title="Select multiple stores with same columns to open together"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggleCheck(store.id, e)}
                      style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                    />
                    Select
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {cols.slice(0, 7).map((c) => (
                    <span key={c.key} className="badge badge-slate" style={{ fontSize: 11 }}>
                      {c.label}
                    </span>
                  ))}
                  {cols.length > 7 && (
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>+{cols.length - 7} more</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    Profit: {formatINR(store.total_profit)}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb' }}>
                    Open Sheet →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== STICKY "+" ROW HANDLER =====
  const handleAppendBlankRow = () => {
    setBlankRows((prev) => [...prev, makeBlankRow(defaultRowStoreId)]);
    setTimeout(() => {
      if (sheetWrapRef.current) {
        sheetWrapRef.current.scrollTop = sheetWrapRef.current.scrollHeight;
      }
    }, 40);
  };

  const updateBlankRow = (tempId, updater) => {
    setBlankRows((prev) => prev.map((r) => (r._tempId === tempId ? { ...updater(r), _dirty: true } : r)));
  };

  const handleBlankServiceChange = (tempId, serviceId) => {
    const sv = services.find((s) => String(s.id) === String(serviceId));
    updateBlankRow(tempId, (r) => {
      if (!sv) return { ...r, service_id: '', service_name: '' };
      const amt = Number(r.amount) || 0;
      const rowStore = r.store_id || defaultRowStoreId;
      const storeWalletMatch = wallets.find(
        (w) => String(w.id) === String(sv.default_wallet_id) && (!rowStore || String(w.store_id) === String(rowStore))
      );
      return {
        ...r,
        store_id: rowStore,
        entry_date: r.entry_date || todayISO(),
        service_id: String(sv.id),
        service_name: sv.name,
        service_charge: sv.default_charge ? String(sv.default_charge) : r.service_charge,
        customer_tax: sv.default_tax_percent
          ? String(Math.round(((amt * Number(sv.default_tax_percent)) / 100) * 100) / 100)
          : r.customer_tax,
        internal_tax: sv.default_internal_tax_percent
          ? String(Math.round(((amt * Number(sv.default_internal_tax_percent)) / 100) * 100) / 100)
          : r.internal_tax,
        wallet_id: storeWalletMatch ? String(storeWalletMatch.id) : r.wallet_id,
      };
    });
  };

  const handleBlankPhoneChange = (tempId, rawPhone) => {
    const phoneVal = sanitizeNumber(rawPhone, false);
    updateBlankRow(tempId, (r) => ({ ...r, client_phone: phoneVal, client_id: null }));
    if (lookupTimersRef.current[tempId]) clearTimeout(lookupTimersRef.current[tempId]);
    if (phoneVal.length < 6) return;
    lookupTimersRef.current[tempId] = setTimeout(async () => {
      try {
        const res = await api.lookupClient(phoneVal);
        if (res.client) {
          updateBlankRow(tempId, (r) => ({ ...r, client_id: res.client.id, client_name: res.client.name }));
          showToast(`Auto-filled client: ${res.client.name}`, 'info');
        }
      } catch {
        // ignore lookup noise
      }
    }, 260);
  };

  const handleBlankAmountChange = (tempId, rawVal) => {
    const val = sanitizeNumber(rawVal, true);
    updateBlankRow(tempId, (r) => {
      const amt = Number(val) || 0;
      const sv = services.find((s) => String(s.id) === String(r.service_id));
      const next = { ...r, amount: val };
      if (sv) {
        if (Number(sv.default_tax_percent) > 0) {
          next.customer_tax = String(Math.round(((amt * Number(sv.default_tax_percent)) / 100) * 100) / 100);
        }
        if (Number(sv.default_internal_tax_percent) > 0) {
          next.internal_tax = String(Math.round(((amt * Number(sv.default_internal_tax_percent)) / 100) * 100) / 100);
        }
      }
      return next;
    });
  };

  const saveBlankRow = async (draft) => {
    if (!draft._dirty) return;
    const targetStore = draft.store_id || defaultRowStoreId;
    if (!targetStore) {
      showToast('Please select a store first', 'error');
      return;
    }
    setSavingRowId(draft._tempId);
    try {
      const payload = {
        ...draft,
        store_id: Number(targetStore),
        entry_date: draft.entry_date || todayISO(),
        payment_mode: draft.payment_mode || 'Cash',
        status: draft.status || 'Completed',
        service_id: draft.service_id ? Number(draft.service_id) : null,
        wallet_id: draft.wallet_id ? Number(draft.wallet_id) : null,
        amount: Number(draft.amount) || 0,
        service_charge: Number(draft.service_charge) || 0,
        customer_tax: Number(draft.customer_tax) || 0,
        internal_tax: Number(draft.internal_tax) || 0,
      };
      const res = await api.createSheetEntry(payload);
      if (res.auto_created_client) {
        showToast(`Saved row & auto-added new client "${draft.client_name}"!`, 'success');
      } else {
        showToast('Row saved & balances updated', 'success');
      }
      await Promise.all([loadSheet(), loadMetadata()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const dirtyBlanksCount = blankRows.filter((b) => b._dirty).length;

  const saveAllDirtyRows = async () => {
    const dirty = blankRows.filter((b) => b._dirty);
    if (!dirty.length) return;
    setSavingRowId('ALL');
    try {
      for (const draft of dirty) {
        const targetStore = draft.store_id || defaultRowStoreId;
        await api.createSheetEntry({
          ...draft,
          store_id: Number(targetStore),
          entry_date: draft.entry_date || todayISO(),
          payment_mode: draft.payment_mode || 'Cash',
          status: draft.status || 'Completed',
          service_id: draft.service_id ? Number(draft.service_id) : null,
          wallet_id: draft.wallet_id ? Number(draft.wallet_id) : null,
          amount: Number(draft.amount) || 0,
          service_charge: Number(draft.service_charge) || 0,
          customer_tax: Number(draft.customer_tax) || 0,
          internal_tax: Number(draft.internal_tax) || 0,
        });
      }
      showToast(`Saved ${dirty.length} new row(s)!`, 'success');
      await Promise.all([loadSheet(), loadMetadata()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleInlineUpdateCell = async (row, col, rawVal) => {
    const payload = {};
    if (col.column_key === 'service_name') {
      const sv = services.find((s) => String(s.id) === String(rawVal));
      if (String(row.service_id || '') === String(rawVal || '')) return;
      payload.service_id = sv ? sv.id : null;
      payload.service_name = sv ? sv.name : '';
    } else if (col.column_key === 'wallet_name') {
      if (String(row.wallet_id || '') === String(rawVal || '')) return;
      payload.wallet_id = rawVal ? Number(rawVal) : null;
    } else if (col.column_key === 'client_phone') {
      const cleanPhone = sanitizeNumber(rawVal, false);
      if (String(row.client_phone || '') === cleanPhone) return;
      payload.client_phone = cleanPhone;
    } else if (col.is_system) {
      const numericKeys = ['amount', 'service_charge', 'customer_tax', 'internal_tax'];
      if (numericKeys.includes(col.column_key)) {
        const num = Number(sanitizeNumber(rawVal, true)) || 0;
        if (Number(row[col.column_key]) === num) return;
        payload[col.column_key] = num;
      } else {
        if (String(row[col.column_key] || '') === String(rawVal || '')) return;
        payload[col.column_key] = rawVal;
      }
    } else {
      const prev = row.custom_data?.[col.column_key] ?? '';
      const isNum = ['currency', 'number'].includes(col.column_type);
      const next = isNum ? (rawVal === '' ? '' : Number(sanitizeNumber(rawVal, true))) : rawVal;
      if (String(prev) === String(next)) return;
      payload.custom_data = { [col.column_key]: next };
    }

    try {
      await api.updateSheetEntry(row.id, payload);
      await Promise.all([loadSheet(), loadMetadata()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteEntry = async (row) => {
    if (!window.confirm(`Delete row #${row.id}? Wallet & stock deductions will be reversed.`)) return;
    try {
      await api.deleteSheetEntry(row.id);
      showToast('Row deleted and balances reversed', 'success');
      await Promise.all([loadSheet(), loadMetadata()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== COLUMN EDIT HANDLERS (+ ADD / - HIDE IN DB ONLY OR DELETE) =====
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newCol.label.trim()) return;
    try {
      await api.createSheetColumn({
        ...newCol,
        store_id: activeStoreIds[0],
        store_ids: activeStoreIds,
      });
      showToast(`Column "${newCol.label}" added`, 'success');
      setNewCol({ label: '', column_type: 'text', formula: '', options: '', color: 'blue', show_total: false });
      setColModalOpen(false);
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleInlineRenameColumn = async (col, nextValue) => {
    const trimmed = String(nextValue || '').trim();
    if (!trimmed || trimmed === col.label) return;
    // Optimistic update for snappy editing
    setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, label: trimmed } : c)));
    try {
      await api.updateSheetColumn(col.id, { label: trimmed, sync_store_ids: activeStoreIds });
    } catch (err) {
      showToast(err.message, 'error');
      loadSheet();
    }
  };

  const handleRemoveColumn = async (col) => {
    try {
      const res = await api.deleteSheetColumn(col.id, { store_ids: activeStoreIds.join(',') });
      showToast(res.message || `Removed "${col.label}"`, 'success');
      await loadSheet();
    } catch {
      // Seamless fallback: hide column completely from UI & reports while preserving DB data
      try {
        await api.updateSheetColumn(col.id, { is_visible: false, sync_store_ids: activeStoreIds });
        showToast(`Column "${col.label}" hidden from sheet (kept safely in DB).`, 'success');
        await loadSheet();
      } catch (fallbackErr) {
        showToast(fallbackErr.message, 'error');
      }
    }
  };

  // Drag-and-drop column reordering directly on column headers!
  const handleDropColumn = async (targetColId) => {
    const sourceId = dragColId;
    setDragColId(null);
    setDragOverColId(null);
    if (!sourceId || sourceId === targetColId) return;

    const fromIdx = visibleColumns.findIndex((c) => c.id === sourceId);
    const toIdx = visibleColumns.findIndex((c) => c.id === targetColId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reorderedVisible = [...visibleColumns];
    const [moved] = reorderedVisible.splice(fromIdx, 1);
    reorderedVisible.splice(toIdx, 0, moved);

    // Update UI instantly
    const hiddenCols = columns.filter((c) => c.is_visible === false);
    setColumns([...reorderedVisible, ...hiddenCols]);

    try {
      await api.reorderSheetColumns(
        reorderedVisible.map((c) => c.id),
        reorderedVisible.map((c) => c.column_key),
        activeStoreIds
      );
    } catch (err) {
      showToast(err.message, 'error');
      loadSheet();
    }
  };

  // ===== RENDER EXISTING SAVED CELL =====
  const renderEditableCell = (row, col) => {
    if (col.column_type === 'formula') {
      const val = row.computed?.[col.column_key] ?? 0;
      return <span style={{ fontWeight: 700, color: '#7c3aed' }}>{formatINR(val)}</span>;
    }
    if (col.column_key === 'store_name') return <span className="badge badge-slate">{row.store_name}</span>;
    if (col.column_key === 'total_payable') return <span style={{ fontWeight: 700 }}>{formatINR(row.total_payable)}</span>;
    if (col.column_key === 'net_profit') {
      const p = Number(row.net_profit) || 0;
      return <span style={{ fontWeight: 700, color: p >= 0 ? '#059669' : '#e11d48' }}>{formatINR(p)}</span>;
    }
    if (col.column_key === 'wallet_balance_after') {
      return row.wallet_balance_after !== null && row.wallet_balance_after !== undefined ? (
        <span style={{ fontWeight: 700, color: Number(row.wallet_balance_after) < 1000 ? '#e11d48' : '#0891b2' }}>
          {formatINR(row.wallet_balance_after)}
        </span>
      ) : null;
    }
    if (col.column_key === 'service_name') {
      return (
        <select
          className={`sheet-cell-select ${!row.service_id ? 'empty-select' : ''}`}
          value={row.service_id ? String(row.service_id) : ''}
          onChange={(e) => handleInlineUpdateCell(row, col, e.target.value)}
        >
          <option value=""></option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (col.column_key === 'wallet_name') {
      const rowWallets = wallets.filter((w) => String(w.store_id) === String(row.store_id));
      return (
        <select
          className={`sheet-cell-select ${!row.wallet_id ? 'empty-select' : ''}`}
          value={row.wallet_id ? String(row.wallet_id) : ''}
          onChange={(e) => handleInlineUpdateCell(row, col, e.target.value)}
        >
          <option value=""></option>
          {rowWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      );
    }
    if (col.column_key === 'payment_mode') {
      return (
        <select className="sheet-cell-select" value={row.payment_mode || 'Cash'} onChange={(e) => handleInlineUpdateCell(row, col, e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank">Bank</option>
          <option value="Credit">Credit</option>
        </select>
      );
    }
    if (col.column_key === 'status') {
      return (
        <select className="sheet-cell-select" value={row.status || 'Completed'} onChange={(e) => handleInlineUpdateCell(row, col, e.target.value)}>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      );
    }
    if (col.column_type === 'select' && !col.is_system) {
      const v = row.custom_data?.[col.column_key] || '';
      return (
        <select
          className={`sheet-cell-select ${!v ? 'empty-select' : ''}`}
          value={v}
          onChange={(e) => handleInlineUpdateCell(row, col, e.target.value)}
        >
          <option value=""></option>
          {(col.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    const raw = col.is_system ? row[col.column_key] : row.custom_data?.[col.column_key];
    const displayVal = col.column_type === 'date' && raw ? String(raw).slice(0, 10) : (raw ?? '');
    const isNum = col.column_type === 'currency' || col.column_type === 'number';
    const isPhone = col.column_key === 'client_phone';

    return (
      <input
        key={`${row.id}-${col.column_key}-${displayVal}`}
        type={col.column_type === 'date' ? 'date' : 'text'}
        inputMode={isPhone ? 'numeric' : isNum ? 'decimal' : undefined}
        className={`sheet-cell-input ${isNum ? 'num-input' : ''}`}
        defaultValue={displayVal}
        placeholder={col.label}
        onKeyDown={(e) => {
          if (isPhone) blockNonNumericKey(e, false);
          else if (isNum) blockNonNumericKey(e, true);
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onInput={(e) => {
          if (isPhone) e.currentTarget.value = sanitizeNumber(e.currentTarget.value, false);
          else if (isNum) e.currentTarget.value = sanitizeNumber(e.currentTarget.value, true);
        }}
        onBlur={(e) => handleInlineUpdateCell(row, col, e.target.value)}
      />
    );
  };

  // ===== RENDER COMPLETELY CLEAN BLANK ROW CELL (NO LETTERS UNTIL HOVERED!) =====
  const renderBlankCell = (draft, col) => {
    const dc = computeDraftCalc(draft);
    const rowStore = draft.store_id || defaultRowStoreId;
    const rowWallets = rowStore ? wallets.filter((w) => String(w.store_id) === String(rowStore)) : wallets;

    if (col.column_type === 'formula') {
      return null;
    }
    if (col.column_key === 'service_name') {
      return (
        <select
          className={`sheet-cell-select ${!draft.service_id ? 'empty-select' : ''}`}
          value={draft.service_id}
          onChange={(e) => handleBlankServiceChange(draft._tempId, e.target.value)}
          title="Select Service"
        >
          <option value=""></option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (col.column_key === 'store_name') {
      const showStore = draft._dirty || activeStoreObjects.length > 1;
      return (
        <select
          className={`sheet-cell-select ${!draft._dirty ? 'empty-select' : ''}`}
          value={showStore ? (draft.store_id || defaultRowStoreId) : ''}
          disabled={!canPickStores || activeStoreObjects.length <= 1}
          onChange={(e) => updateBlankRow(draft._tempId, (r) => ({ ...r, store_id: e.target.value, wallet_id: '' }))}
          title="Select Store"
        >
          <option value=""></option>
          {activeStoreObjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (col.column_key === 'client_phone') {
      return (
        <input
          type="text"
          inputMode="numeric"
          className="sheet-cell-input"
          value={draft.client_phone}
          placeholder="Mobile number"
          onKeyDown={(e) => {
            blockNonNumericKey(e, false);
            if (e.key === 'Enter') saveBlankRow(draft);
          }}
          onChange={(e) => handleBlankPhoneChange(draft._tempId, e.target.value)}
        />
      );
    }
    if (col.column_key === 'client_name') {
      return (
        <input
          className="sheet-cell-input"
          value={draft.client_name}
          placeholder="Client name"
          onChange={(e) => updateBlankRow(draft._tempId, (r) => ({ ...r, client_name: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') saveBlankRow(draft); }}
        />
      );
    }
    if (col.column_key === 'wallet_name') {
      return (
        <select
          className={`sheet-cell-select ${!draft.wallet_id ? 'empty-select' : ''}`}
          value={draft.wallet_id}
          onChange={(e) => updateBlankRow(draft._tempId, (r) => ({ ...r, wallet_id: e.target.value }))}
          title="Select App / Bank"
        >
          <option value=""></option>
          {rowWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      );
    }
    if (col.column_key === 'amount') {
      return (
        <input
          type="text"
          inputMode="decimal"
          className="sheet-cell-input num-input"
          value={draft.amount}
          placeholder="0.00"
          onKeyDown={(e) => {
            blockNonNumericKey(e, true);
            if (e.key === 'Enter') saveBlankRow(draft);
          }}
          onChange={(e) => handleBlankAmountChange(draft._tempId, e.target.value)}
        />
      );
    }
    if (col.column_key === 'total_payable') {
      return draft._dirty ? <span style={{ fontWeight: 700, color: '#2563eb' }}>{formatINR(dc.totalPayable)}</span> : null;
    }
    if (col.column_key === 'net_profit') {
      return draft._dirty ? (
        <span style={{ fontWeight: 700, color: dc.netProfit >= 0 ? '#059669' : '#e11d48' }}>{formatINR(dc.netProfit)}</span>
      ) : null;
    }
    if (col.column_key === 'wallet_balance_after') {
      return draft._dirty && dc.balanceAfter !== null ? (
        <span style={{ fontWeight: 700, color: '#0891b2' }}>{formatINR(dc.balanceAfter)}</span>
      ) : null;
    }
    if (col.column_key === 'payment_mode') {
      return (
        <select
          className={`sheet-cell-select ${!draft.payment_mode ? 'empty-select' : ''}`}
          value={draft.payment_mode}
          onChange={(e) => updateBlankRow(draft._tempId, (r) => ({ ...r, payment_mode: e.target.value }))}
          title="Payment Mode"
        >
          <option value=""></option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank">Bank</option>
          <option value="Credit">Credit</option>
        </select>
      );
    }
    if (col.column_key === 'status') {
      return (
        <select
          className={`sheet-cell-select ${!draft.status ? 'empty-select' : ''}`}
          value={draft.status}
          onChange={(e) => updateBlankRow(draft._tempId, (r) => ({ ...r, status: e.target.value }))}
          title="Status"
        >
          <option value=""></option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      );
    }

    const isNum = col.column_type === 'currency' || col.column_type === 'number';
    if (col.is_system) {
      const val = draft[col.column_key] ?? '';
      return (
        <input
          type={col.column_type === 'date' ? 'date' : 'text'}
          inputMode={isNum ? 'decimal' : undefined}
          className={`sheet-cell-input ${isNum ? 'num-input' : ''} ${col.column_type === 'date' && !val ? 'sheet-cell-date-empty' : ''}`}
          value={val}
          placeholder={col.label}
          onKeyDown={(e) => {
            if (isNum) blockNonNumericKey(e, true);
            if (e.key === 'Enter') saveBlankRow(draft);
          }}
          onChange={(e) =>
            updateBlankRow(draft._tempId, (r) => ({
              ...r,
              [col.column_key]: isNum ? sanitizeNumber(e.target.value, true) : e.target.value,
            }))
          }
        />
      );
    }

    if (col.column_type === 'select') {
      const v = draft.custom_data?.[col.column_key] || '';
      return (
        <select
          className={`sheet-cell-select ${!v ? 'empty-select' : ''}`}
          value={v}
          onChange={(e) =>
            updateBlankRow(draft._tempId, (r) => ({ ...r, custom_data: { ...r.custom_data, [col.column_key]: e.target.value } }))
          }
        >
          <option value=""></option>
          {(col.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    const cVal = draft.custom_data?.[col.column_key] ?? '';
    return (
      <input
        type={col.column_type === 'date' ? 'date' : 'text'}
        inputMode={isNum ? 'decimal' : undefined}
        className={`sheet-cell-input ${isNum ? 'num-input' : ''} ${col.column_type === 'date' && !cVal ? 'sheet-cell-date-empty' : ''}`}
        value={cVal}
        placeholder={col.label}
        onKeyDown={(e) => {
          if (isNum) blockNonNumericKey(e, true);
          if (e.key === 'Enter') saveBlankRow(draft);
        }}
        onChange={(e) =>
          updateBlankRow(draft._tempId, (r) => ({
            ...r,
            custom_data: {
              ...r.custom_data,
              [col.column_key]: isNum ? sanitizeNumber(e.target.value, true) : e.target.value,
            },
          }))
        }
      />
    );
  };

  const sheetTitle =
    activeStoreObjects.length > 1
      ? `Combined Sheet (${activeStoreObjects.map((s) => s.name).join(' + ')})`
      : activeStoreObjects[0]?.name || 'Store Sheet';

  return (
    <div>
      {/* Ultra-Clean Filter Bar (NO CSV, NO Refresh, NO Detailed Entry!) */}
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <div className="toolbar-group">
          {canPickStores && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setColEditMode(false);
                setSelectedStoreId('all');
                setActiveStoreIds(null);
              }}
            >
              ← Store Sheets
            </button>
          )}
          <span className="badge badge-blue" style={{ padding: '6px 11px', fontSize: 12.5 }}>
            {sheetTitle}
          </span>

          <div className="search-box" style={{ minWidth: 190 }}>
            <IconSearch size={14} />
            <input
              className="input"
              style={{ paddingTop: 6, paddingBottom: 6 }}
              placeholder="Search sheet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select" style={{ width: 140, padding: '6px 9px' }} value={filterService} onChange={(e) => setFilterService(e.target.value)}>
            <option value="all">All Services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select className="select" style={{ width: 140, padding: '6px 9px' }} value={filterWallet} onChange={(e) => setFilterWallet(e.target.value)}>
            <option value="all">All Apps / Banks</option>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <select className="select" style={{ width: 110, padding: '6px 9px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <input type="date" className="input" style={{ width: 130, padding: '5px 8px' }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="input" style={{ width: 130, padding: '5px 8px' }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {dirtyBlanksCount > 0 && (
          <button className="btn btn-emerald btn-sm" onClick={saveAllDirtyRows} disabled={savingRowId === 'ALL'}>
            {savingRowId === 'ALL' ? 'Saving...' : `✓ Save ${dirtyBlanksCount} Row(s)`}
          </button>
        )}
      </div>

      {/* Full-Height Interactive Spreadsheet */}
      <div className="sheet-wrap" ref={sheetWrapRef}>
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="sticky-col-left" style={{ width: 52, textAlign: 'center' }}>#</th>
              {visibleColumns.map((col) => {
                const canDrag = hasPerm('manage_columns');
                const isDragging = dragColId === col.id;
                const isDragOver = dragOverColId === col.id && dragColId !== col.id;
                return (
                  <th
                    key={col.id}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag) return;
                      setDragColId(col.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(col.id));
                    }}
                    onDragOver={(e) => {
                      if (!canDrag || !dragColId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverColId !== col.id) setDragOverColId(col.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverColId === col.id) setDragOverColId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropColumn(col.id);
                    }}
                    onDragEnd={() => {
                      setDragColId(null);
                      setDragOverColId(null);
                    }}
                    className={`col-accent-${col.color || 'slate'} ${['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''} ${canDrag ? 'col-draggable' : ''} ${isDragging ? 'col-dragging' : ''} ${isDragOver ? 'col-drag-over' : ''}`}
                    style={{ minWidth: (col.width || 140) + 28 }}
                    title={canDrag ? 'Drag to move column' : col.label}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      {colEditMode ? (
                        <>
                          <span className="col-drag-grip" title="Drag to move column">⋮⋮</span>
                          <input
                            key={`col-edit-${col.id}-${col.label}`}
                            type="text"
                            className="col-header-edit-input"
                            defaultValue={col.label}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => handleInlineRenameColumn(col, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                          />
                          <button
                            type="button"
                            className="col-minus-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveColumn(col);
                            }}
                            title={`Remove ${col.label}`}
                          >
                            −
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ cursor: canDrag ? 'grab' : 'default' }}>{col.label}</span>
                          {col.column_type === 'formula' && <span style={{ fontSize: 10.5, opacity: 0.85 }}>fx</span>}
                        </>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Right-End Sticky Header: Clean "Edit" button -> reveals compact "+" & "Done" right inside header */}
              <th className="sticky-col-right" style={{ width: colEditMode ? 112 : 84, textAlign: 'center' }}>
                {hasPerm('manage_columns') ? (
                  colEditMode ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <button
                        type="button"
                        className="sheet-simple-plus-dark"
                        style={{ background: '#2563eb', borderColor: '#3b82f6' }}
                        onClick={() => setColModalOpen(true)}
                        title="Add Column"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="sheet-header-edit-btn editing-active"
                        onClick={() => setColEditMode(false)}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sheet-header-edit-btn"
                      onClick={() => setColEditMode(true)}
                    >
                      <IconEdit size={13} /> Edit
                    </button>
                  )
                ) : null}
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && entries.length === 0 && blankRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} style={{ padding: 20, color: '#64748b' }}>
                  Loading sheet...
                </td>
              </tr>
            ) : (
              <>
                {entries.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="sticky-col-left" style={{ textAlign: 'center', color: '#64748b', fontSize: 12.5 }}>{idx + 1}</td>
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className={`cell-editing-wrap ${['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''}`}
                      >
                        {renderEditableCell(row, col)}
                      </td>
                    ))}
                    <td className="sticky-col-right" style={{ textAlign: 'center' }}>
                      {hasPerm('can_delete') && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ color: '#e11d48' }}
                          onClick={() => handleDeleteEntry(row)}
                          title="Delete Row"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {blankRows.map((draft, bIdx) => {
                  const rowNum = entries.length + bIdx + 1;
                  return (
                    <tr key={draft._tempId} className={`sheet-blank-row ${draft._dirty ? 'dirty' : ''}`}>
                      <td className="sticky-col-left" style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                        {rowNum}
                      </td>
                      {visibleColumns.map((col) => (
                        <td
                          key={col.id}
                          className={`cell-editing-wrap ${['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''}`}
                        >
                          {renderBlankCell(draft, col)}
                        </td>
                      ))}
                      <td className="sticky-col-right" style={{ textAlign: 'center' }}>
                        {draft._dirty ? (
                          <button
                            type="button"
                            className="btn btn-emerald btn-sm"
                            style={{ padding: '4px 10px' }}
                            disabled={savingRowId === draft._tempId}
                            onClick={() => saveBlankRow(draft)}
                            title="Save row"
                          >
                            {savingRowId === draft._tempId ? '...' : '✓'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>

          {/* Separate Sticky Bottom Totals Row — Simple "+" Row Button, NO Σ(0) at the end! */}
          <tfoot>
            <tr>
              <td className="sticky-col-left" style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="sheet-simple-plus-dark"
                  onClick={handleAppendBlankRow}
                  title="Add new row"
                >
                  +
                </button>
              </td>
              {visibleColumns.map((col) => {
                const hasTotal = col.show_total && liveTotals[col.column_key] !== undefined;
                return (
                  <td
                    key={col.id}
                    className={['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''}
                  >
                    {hasTotal
                      ? col.column_type === 'number'
                        ? formatNum(liveTotals[col.column_key])
                        : formatINR(liveTotals[col.column_key])
                      : col.column_key === 'service_name'
                        ? 'COLUMN TOTALS'
                        : ''}
                  </td>
                );
              })}
              <td className="sticky-col-right" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Column Popup (Opened via "+" while in Edit Mode) */}
      {colModalOpen && (
        <div className="modal-backdrop" onClick={() => setColModalOpen(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">+ Add Column</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setColModalOpen(false)}>
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={handleAddColumn}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Column Name *</label>
                  <input
                    className="input"
                    value={newCol.label}
                    onChange={(e) => setNewCol((p) => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. Commission, Bank Ref"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Column Type</label>
                    <select
                      className="select"
                      value={newCol.column_type}
                      onChange={(e) =>
                        setNewCol((p) => ({
                          ...p,
                          column_type: e.target.value,
                          show_total: ['currency', 'number', 'formula'].includes(e.target.value) ? true : p.show_total,
                        }))
                      }
                    >
                      <option value="text">Text</option>
                      <option value="number">Number (Digits Only)</option>
                      <option value="currency">Currency (₹)</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown Select</option>
                      <option value="formula">Calculated Formula (fx)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Header Color</label>
                    <select className="select" value={newCol.color} onChange={(e) => setNewCol((p) => ({ ...p, color: e.target.value }))}>
                      {COLORS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {newCol.column_type === 'select' && (
                  <div className="form-group">
                    <label className="form-label">Dropdown Options (comma separated)</label>
                    <input className="input" value={newCol.options} onChange={(e) => setNewCol((p) => ({ ...p, options: e.target.value }))} placeholder="Option 1, Option 2" />
                  </div>
                )}

                {newCol.column_type === 'formula' && (
                  <div className="form-group">
                    <label className="form-label">Formula Expression</label>
                    <input
                      className="input"
                      value={newCol.formula}
                      onChange={(e) => setNewCol((p) => ({ ...p, formula: e.target.value }))}
                      placeholder="[service_charge] + [customer_tax] - [internal_tax]"
                      required
                    />
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {formulaKeys.map((fk) => (
                        <button
                          type="button"
                          key={fk.key}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => setNewCol((p) => ({ ...p, formula: `${p.formula}[${fk.key}]` }))}
                        >
                          + [{fk.key}]
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="perm-check">
                  <input type="checkbox" checked={newCol.show_total} onChange={(e) => setNewCol((p) => ({ ...p, show_total: e.target.checked }))} />
                  Show Total in Sticky Footer
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setColModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Column</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
