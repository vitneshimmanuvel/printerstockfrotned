import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { blockNonNumericKey, formatINR, formatNum, sanitizeNumber, todayISO } from '../utils/format';
import { IconClose, IconEdit, IconShield, IconTrash } from './Icons';

const MIN_INITIAL_ROWS = 10;
const COLORS = ['cyan', 'blue', 'emerald', 'amber', 'rose', 'purple', 'orange', 'slate'];

function makeBlankRow(storeId) {
  return {
    _tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    store_id: storeId || '',
    row_date: '',
    app_name: '',
    opening_balance: '',
    added_amount: '',
    used_amount: '',
    commission: '',
    notes: '',
    custom_data: {},
    _dirty: false,
  };
}

export default function AdminRechargeSheet({ open, onClose }) {
  const { stores, selectedStoreId } = useAuth();
  const { showToast } = useToast();

  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [blankRows, setBlankRows] = useState([]);
  const [editedExisting, setEditedExisting] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [colEditMode, setColEditMode] = useState(false);
  const [colModal, setColModal] = useState(false);
  const [newCol, setNewCol] = useState({
    label: '',
    column_type: 'currency',
    formula: '',
    color: 'cyan',
    show_total: true,
  });

  const defaultStoreId =
    selectedStoreId && selectedStoreId !== 'all' ? selectedStoreId : (stores[0] ? String(stores[0].id) : '');

  const loadSheet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminRechargeSheet({ store_id: selectedStoreId });
      const fetchedRows = res.rows || [];
      setColumns(res.columns || []);
      setRows(fetchedRows);
      setTotals(res.totals || {});
      setEditedExisting({});
      const neededBlanks = Math.max(0, MIN_INITIAL_ROWS - fetchedRows.length);
      setBlankRows(Array.from({ length: neededBlanks }, () => makeBlankRow(defaultStoreId)));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, defaultStoreId, showToast]);

  useEffect(() => {
    if (open) {
      loadSheet();
    }
  }, [open, loadSheet]);

  if (!open) return null;

  const activeStoreName =
    selectedStoreId === 'all'
      ? 'All Stores (Company Total)'
      : stores.find((s) => String(s.id) === String(selectedStoreId))?.name || 'Store';

  const handleAddBlankRow = () => {
    setBlankRows((prev) => [...prev, makeBlankRow(defaultStoreId)]);
  };

  const updateBlankCell = (tempId, col, rawVal) => {
    const isNum = col.column_type === 'currency' || col.column_type === 'number';
    const val = isNum ? sanitizeNumber(rawVal, true) : rawVal;
    setBlankRows((prev) =>
      prev.map((r) => {
        if (r._tempId !== tempId) return r;
        if (col.is_system) {
          return { ...r, [col.column_key]: val, _dirty: true };
        }
        return {
          ...r,
          custom_data: { ...(r.custom_data || {}), [col.column_key]: val },
          _dirty: true,
        };
      })
    );
  };

  const updateExistingCellLocal = (row, col, rawVal) => {
    const isNum = col.column_type === 'currency' || col.column_type === 'number';
    const val = isNum ? sanitizeNumber(rawVal, true) : rawVal;
    setEditedExisting((prev) => {
      const curr = prev[row.id] || {};
      if (col.is_system) {
        return { ...prev, [row.id]: { ...curr, [col.column_key]: val } };
      }
      return {
        ...prev,
        [row.id]: {
          ...curr,
          custom_data: { ...(curr.custom_data || {}), [col.column_key]: val },
        },
      };
    });
  };

  const saveSingleBlankRow = async (draft) => {
    if (!draft._dirty) return;
    setSavingAll(true);
    try {
      await api.addAdminRechargeRow({
        store_id: draft.store_id || defaultStoreId || null,
        row_date: draft.row_date || todayISO(),
        app_name: draft.app_name || '',
        opening_balance: Number(draft.opening_balance) || 0,
        added_amount: Number(draft.added_amount) || 0,
        used_amount: Number(draft.used_amount) || 0,
        commission: Number(draft.commission) || 0,
        notes: draft.notes || '',
        custom_data: draft.custom_data || {},
      });
      showToast('Recharge balance row saved', 'success');
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSaveAll = async () => {
    const dirtyBlanks = blankRows.filter((b) => b._dirty);
    const dirtyExistingIds = Object.keys(editedExisting);

    if (dirtyBlanks.length === 0 && dirtyExistingIds.length === 0) {
      showToast('Everything is already saved', 'info');
      return;
    }

    setSavingAll(true);
    try {
      for (const rowId of dirtyExistingIds) {
        await api.updateAdminRechargeRow(rowId, editedExisting[rowId]);
      }
      for (const draft of dirtyBlanks) {
        await api.addAdminRechargeRow({
          store_id: draft.store_id || defaultStoreId || null,
          row_date: draft.row_date || todayISO(),
          app_name: draft.app_name || '',
          opening_balance: Number(draft.opening_balance) || 0,
          added_amount: Number(draft.added_amount) || 0,
          used_amount: Number(draft.used_amount) || 0,
          commission: Number(draft.commission) || 0,
          notes: draft.notes || '',
          custom_data: draft.custom_data || {},
        });
      }
      showToast('All recharge balance changes saved!', 'success');
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete row (${row.app_name || '#' + row.id})?`)) return;
    try {
      await api.deleteAdminRechargeRow(row.id);
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newCol.label.trim()) return;
    try {
      await api.addAdminRechargeColumn(newCol);
      showToast(`Column "${newCol.label}" added`, 'success');
      setColModal(false);
      setNewCol({ label: '', column_type: 'currency', formula: '', color: 'cyan', show_total: true });
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRenameColumn = async (col) => {
    if (!colEditMode) return;
    const nextName = window.prompt('Rename column:', col.label);
    if (!nextName || !nextName.trim() || nextName.trim() === col.label) return;
    try {
      await api.updateAdminRechargeColumn(col.id, { label: nextName.trim() });
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveColumn = async (col) => {
    try {
      const res = await api.deleteAdminRechargeColumn(col.id);
      showToast(res.message || `Removed "${col.label}"`, 'success');
      await loadSheet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const dirtyCount = blankRows.filter((b) => b._dirty).length + Object.keys(editedExisting).length;
  const numericKeys = columns.filter((c) => ['currency', 'number'].includes(c.column_type));

  const liveTotals = { ...totals };
  for (const col of columns) {
    if (!col.show_total) continue;
    let sum = Number(totals[col.column_key]) || 0;
    for (const draft of blankRows) {
      if (!draft._dirty) continue;
      if (col.column_key === 'closing_balance') {
        sum += (Number(draft.opening_balance) || 0) + (Number(draft.added_amount) || 0) - (Number(draft.used_amount) || 0);
      } else {
        const raw = col.is_system ? draft[col.column_key] : draft.custom_data?.[col.column_key];
        const n = parseFloat(raw);
        if (Number.isFinite(n)) sum += n;
      }
    }
    liveTotals[col.column_key] = Math.round(sum * 100) / 100;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" style={{ maxWidth: 1220, height: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#0f172a', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShield size={18} />
            <div className="modal-title" style={{ color: '#fff' }}>
              Admin Recharge Balance Sheet — {activeStoreName}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-emerald btn-sm"
              onClick={handleSaveAll}
              disabled={savingAll}
            >
              {savingAll ? 'Saving...' : dirtyCount > 0 ? `Save Changes (${dirtyCount})` : 'Save Sheet'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ color: '#cbd5e1' }}
              onClick={onClose}
            >
              <IconClose size={19} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="sticky-col-left" style={{ width: 52, textAlign: 'center' }}>#</th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`col-accent-${col.color || 'cyan'} ${['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''}`}
                    style={{ minWidth: (col.width || 145) + 24 }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span
                        onClick={() => colEditMode && handleRenameColumn(col)}
                        style={{ cursor: colEditMode ? 'pointer' : 'default', textDecoration: colEditMode ? 'underline dashed' : 'none' }}
                      >
                        {col.label}
                      </span>
                      {col.column_type === 'formula' && <span style={{ fontSize: 10.5, opacity: 0.8 }}>fx</span>}
                      {colEditMode && (
                        <button
                          type="button"
                          className="col-minus-btn"
                          onClick={() => handleRemoveColumn(col)}
                          title={`Remove ${col.label}`}
                        >
                          −
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="sticky-col-right" style={{ width: colEditMode ? 112 : 84, textAlign: 'center' }}>
                  {colEditMode ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <button
                        type="button"
                        className="sheet-simple-plus-dark"
                        style={{ background: '#2563eb', borderColor: '#3b82f6' }}
                        onClick={() => setColModal(true)}
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
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ padding: 20, color: '#64748b' }}>Loading...</td>
                </tr>
              ) : (
                <>
                  {rows.map((row, idx) => {
                    const patch = editedExisting[row.id] || {};
                    const openVal = patch.opening_balance !== undefined ? Number(patch.opening_balance) || 0 : Number(row.opening_balance) || 0;
                    const addVal = patch.added_amount !== undefined ? Number(patch.added_amount) || 0 : Number(row.added_amount) || 0;
                    const usedVal = patch.used_amount !== undefined ? Number(patch.used_amount) || 0 : Number(row.used_amount) || 0;

                    return (
                      <tr key={row.id}>
                        <td className="sticky-col-left" style={{ textAlign: 'center', color: '#64748b', fontSize: 12.5 }}>{idx + 1}</td>
                        {columns.map((col) => {
                          const isNum = col.column_type === 'currency' || col.column_type === 'number';
                          if (col.column_type === 'formula') {
                            const val = col.column_key === 'closing_balance' ? openVal + addVal - usedVal : (row.computed?.[col.column_key] ?? 0);
                            return (
                              <td key={col.id} className="num-cell">
                                <span style={{ fontWeight: 700, color: val < 0 ? '#e11d48' : '#0891b2' }}>{formatINR(val)}</span>
                              </td>
                            );
                          }

                          const raw = col.is_system
                            ? (patch[col.column_key] !== undefined ? patch[col.column_key] : row[col.column_key])
                            : (patch.custom_data?.[col.column_key] !== undefined ? patch.custom_data[col.column_key] : row.custom_data?.[col.column_key]);
                          const displayVal = col.column_type === 'date' && raw ? String(raw).slice(0, 10) : (raw ?? '');

                          return (
                            <td key={col.id} className={`cell-editing-wrap ${isNum ? 'num-cell' : ''}`}>
                              <input
                                type={col.column_type === 'date' ? 'date' : 'text'}
                                inputMode={isNum ? 'decimal' : undefined}
                                className={`sheet-cell-input ${isNum ? 'num-input' : ''}`}
                                value={displayVal}
                                placeholder={col.label}
                                onKeyDown={(e) => {
                                  if (isNum) blockNonNumericKey(e, true);
                                  if (e.key === 'Enter') handleSaveAll();
                                }}
                                onChange={(e) => updateExistingCellLocal(row, col, e.target.value)}
                              />
                            </td>
                          );
                        })}
                        <td className="sticky-col-right" style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ color: '#e11d48' }}
                            onClick={() => deleteRow(row)}
                            title="Delete row"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {blankRows.map((draft, bIdx) => {
                    const rowNum = rows.length + bIdx + 1;
                    const closingPreview =
                      (Number(draft.opening_balance) || 0) +
                      (Number(draft.added_amount) || 0) -
                      (Number(draft.used_amount) || 0);

                    return (
                      <tr key={draft._tempId} className={`sheet-blank-row ${draft._dirty ? 'dirty' : ''}`}>
                        <td className="sticky-col-left" style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>{rowNum}</td>
                        {columns.map((col) => {
                          const isNum = col.column_type === 'currency' || col.column_type === 'number';
                          if (col.column_type === 'formula') {
                            return (
                              <td key={col.id} className="num-cell">
                                {draft._dirty ? (
                                  <span style={{ fontWeight: 700, color: '#0891b2' }}>{formatINR(closingPreview)}</span>
                                ) : null}
                              </td>
                            );
                          }
                          const val = col.is_system ? (draft[col.column_key] ?? '') : (draft.custom_data?.[col.column_key] ?? '');
                          return (
                            <td key={col.id} className={`cell-editing-wrap ${isNum ? 'num-cell' : ''}`}>
                              <input
                                type={col.column_type === 'date' ? 'date' : 'text'}
                                inputMode={isNum ? 'decimal' : undefined}
                                className={`sheet-cell-input ${isNum ? 'num-input' : ''} ${col.column_type === 'date' && !val ? 'sheet-cell-date-empty' : ''}`}
                                value={val}
                                placeholder={col.label}
                                onKeyDown={(e) => {
                                  if (isNum) blockNonNumericKey(e, true);
                                  if (e.key === 'Enter') saveSingleBlankRow(draft);
                                }}
                                onChange={(e) => updateBlankCell(draft._tempId, col, e.target.value)}
                              />
                            </td>
                          );
                        })}
                        <td className="sticky-col-right" style={{ textAlign: 'center' }}>
                          {draft._dirty ? (
                            <button
                              type="button"
                              className="btn btn-emerald btn-sm"
                              style={{ padding: '4px 10px' }}
                              onClick={() => saveSingleBlankRow(draft)}
                              title="Save row"
                            >
                              ✓
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td className="sticky-col-left" style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="sheet-simple-plus-dark"
                    onClick={handleAddBlankRow}
                    title="Add new row"
                  >
                    +
                  </button>
                </td>
                {columns.map((col) => {
                  const hasTot = col.show_total && liveTotals[col.column_key] !== undefined;
                  return (
                    <td
                      key={col.id}
                      className={['currency', 'number', 'formula'].includes(col.column_type) ? 'num-cell' : ''}
                    >
                      {hasTot
                        ? col.column_type === 'number'
                          ? formatNum(liveTotals[col.column_key])
                          : formatINR(liveTotals[col.column_key])
                        : col.column_key === 'app_name'
                          ? 'TOTALS'
                          : ''}
                    </td>
                  );
                })}
                <td className="sticky-col-right" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add Column Sub-Modal */}
      {colModal && (
        <div className="modal-backdrop" style={{ zIndex: 120 }} onClick={() => setColModal(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">+ Add Column</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setColModal(false)}>
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
                    placeholder="e.g. Airtel Bal, Jio Bal, Bank Transfer"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="select"
                      value={newCol.column_type}
                      onChange={(e) =>
                        setNewCol((p) => ({
                          ...p,
                          column_type: e.target.value,
                          show_total: ['currency', 'number', 'formula'].includes(e.target.value),
                        }))
                      }
                    >
                      <option value="currency">Currency / Balance (₹)</option>
                      <option value="number">Number (Digits Only)</option>
                      <option value="text">Text</option>
                      <option value="date">Date</option>
                      <option value="formula">Formula (fx)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Header Color</label>
                    <select className="select" value={newCol.color} onChange={(e) => setNewCol((p) => ({ ...p, color: e.target.value }))}>
                      {COLORS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                {newCol.column_type === 'formula' && (
                  <div className="form-group">
                    <label className="form-label">Formula</label>
                    <input
                      className="input"
                      value={newCol.formula}
                      onChange={(e) => setNewCol((p) => ({ ...p, formula: e.target.value }))}
                      placeholder="[opening_balance] + [added_amount] - [used_amount]"
                      required
                    />
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {numericKeys.map((c) => (
                        <button
                          type="button"
                          key={c.column_key}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => setNewCol((p) => ({ ...p, formula: `${p.formula}[${c.column_key}]` }))}
                        >
                          + [{c.column_key}]
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={newCol.show_total}
                    onChange={(e) => setNewCol((p) => ({ ...p, show_total: e.target.checked }))}
                  />
                  Show Total in Sticky Footer
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setColModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Column</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
