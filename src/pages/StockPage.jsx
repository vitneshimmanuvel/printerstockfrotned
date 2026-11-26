import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDateTime, formatINR, formatNum } from '../utils/format';
import { IconClose, IconEdit, IconPlus, IconSearch, IconStore, IconTrash } from '../components/Icons';

export default function StockPage() {
  const { user, stores, selectedStoreId, hasPerm } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState('showcase');
  const [activeStoreTab, setActiveStoreTab] = useState('all'); // local store switcher tab
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    store_id: '',
    name: '',
    sku: '',
    category: 'Stationery',
    quantity: 0,
    unit: 'pcs',
    min_threshold: 10,
    cost_price: 0,
    sell_price: 0,
  });
  const [imageFile, setImageFile] = useState(null);

  const [adjustItem, setAdjustItem] = useState(null);
  const [adjForm, setAdjForm] = useState({ quantity: '', movement_type: 'restock', note: '' });

  // Sync local store tab when global topbar store switcher changes
  useEffect(() => {
    setActiveStoreTab(selectedStoreId || 'all');
  }, [selectedStoreId]);

  const effectiveStoreId = hasPerm('view_all_stores')
    ? activeStoreTab
    : (user?.store_id ? String(user.store_id) : selectedStoreId);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stRes, mvRes] = await Promise.all([
        api.getStock({ store_id: effectiveStoreId, search, low_only: lowOnly ? 'true' : '' }),
        api.getStockMovements({ store_id: effectiveStoreId, limit: 150 }),
      ]);
      setItems(stRes.items || []);
      setSummary(stRes.summary || {});
      setMovements(mvRes.movements || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [effectiveStoreId, search, lowOnly, showToast]);

  useEffect(() => {
    const t = setTimeout(loadData, 160);
    return () => clearTimeout(t);
  }, [loadData]);

  // Group items clearly per store so each store's unique inventory is crystal clear!
  const groupedByStore = useMemo(() => {
    const targetStores =
      effectiveStoreId && effectiveStoreId !== 'all'
        ? stores.filter((s) => String(s.id) === String(effectiveStoreId))
        : stores;

    return targetStores.map((store) => {
      const storeItems = items.filter((it) => String(it.store_id) === String(store.id));
      const lowCount = storeItems.filter((it) => it.stock_status !== 'in_stock').length;
      const storeSellVal = storeItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.sell_price) || 0), 0);
      return {
        store,
        items: storeItems,
        lowCount,
        storeSellVal,
      };
    });
  }, [stores, items, effectiveStoreId]);

  const openCreateForStore = (presetStoreId) => {
    const chosenStore =
      presetStoreId ||
      (effectiveStoreId && effectiveStoreId !== 'all' ? effectiveStoreId : (user?.store_id ? String(user.store_id) : (stores[0] ? String(stores[0].id) : '')));

    setEditing(null);
    setImageFile(null);
    setForm({
      store_id: String(chosenStore),
      name: '',
      sku: '',
      category: 'Stationery',
      quantity: 0,
      unit: 'pcs',
      min_threshold: 10,
      cost_price: 0,
      sell_price: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setImageFile(null);
    setForm({
      store_id: String(item.store_id),
      name: item.name,
      sku: item.sku || '',
      category: item.category || 'General',
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      min_threshold: item.min_threshold || 0,
      cost_price: item.cost_price || 0,
      sell_price: item.sell_price || 0,
    });
    setModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    if (!form.store_id) {
      showToast('Please pick which Store this stock item belongs to', 'error');
      return;
    }
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      if (imageFile) fd.append('image', imageFile);

      if (editing) {
        await api.updateStock(editing.id, fd);
        showToast('Stock item updated', 'success');
      } else {
        await api.createStock(fd);
        const stName = stores.find((s) => String(s.id) === String(form.store_id))?.name || 'store';
        showToast(`Added "${form.name}" to ${stName}`, 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.adjustStock(adjustItem.id, {
        quantity: Number(adjForm.quantity),
        movement_type: adjForm.movement_type,
        note: adjForm.note,
      });
      showToast('Stock level updated', 'success');
      setAdjustItem(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete stock item "${item.name}" from ${item.store_name}?`)) return;
    try {
      await api.deleteStock(item.id);
      showToast('Stock item deleted', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const renderStockCard = (item) => {
    const statusBadge =
      item.stock_status === 'out_of_stock'
        ? 'badge-rose'
        : item.stock_status === 'low_stock'
          ? 'badge-amber'
          : 'badge-emerald';
    const statusText =
      item.stock_status === 'out_of_stock'
        ? 'Out of Stock'
        : item.stock_status === 'low_stock'
          ? 'Low Stock'
          : 'In Stock';

    return (
      <div
        key={item.id}
        className="card"
        style={{
          overflow: 'hidden',
          borderColor:
            item.stock_status === 'out_of_stock'
              ? '#fda4af'
              : item.stock_status === 'low_stock'
                ? '#fcd34d'
                : undefined,
        }}
      >
        {item.image_url && (
          <div style={{ height: 115, background: '#f1f5f9', overflow: 'hidden' }}>
            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{item.name}</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                {item.category} {item.sku ? `· ${item.sku}` : ''}
              </div>
            </div>
            <span className={`badge ${statusBadge}`}>{statusText}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: '#f8fafc', padding: '9px 11px', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Available Stock</div>
              <div style={{ fontSize: 21, fontWeight: 700 }}>
                {formatNum(item.quantity)} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>{item.unit}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              <div>Alert ≤ <strong>{formatNum(item.min_threshold)}</strong></div>
              <div style={{ color: '#059669' }}>Sell: {formatINR(item.sell_price)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-emerald btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setAdjustItem(item);
                setAdjForm({ quantity: '', movement_type: 'restock', note: '' });
              }}
            >
              + Restock
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAdjustItem(item);
                setAdjForm({ quantity: '', movement_type: 'manual_out', note: '' });
              }}
            >
              − Use
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => openEdit(item)}><IconEdit size={14} /></button>
            <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => deleteItem(item)}><IconTrash size={14} /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Per-Store Stock Management & Automatic Showcase</h2>
          <p className="card-subtitle">
            Each store has its own completely separate stock inventory — pick a store tab or add items directly inside each store section
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreateForStore(null)}>
          <IconPlus size={15} /> Add Stock Item
        </button>
      </div>

      {/* Clear Per-Store Selector Pill Tabs */}
      {hasPerm('view_all_stores') && stores.length > 0 && (
        <div className="store-pill-tabs">
          <button
            type="button"
            className={`store-pill-tab ${activeStoreTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveStoreTab('all')}
          >
            <IconStore size={15} />
            <span>All Stores (Separated by Store)</span>
            <span className="badge badge-slate">{stores.length} stores</span>
          </button>

          {stores.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`store-pill-tab ${String(activeStoreTab) === String(s.id) ? 'active' : ''}`}
              onClick={() => setActiveStoreTab(String(s.id))}
            >
              <IconStore size={14} />
              <span>{s.name}</span>
              <span className="badge badge-slate">{s.code}</span>
              {Number(s.low_stock_count) > 0 && (
                <span className="badge badge-rose">{s.low_stock_count} low</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Live Stock Showcase KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Stock SKUs ({effectiveStoreId === 'all' ? 'All Stores' : 'This Store'})</div>
          <div className="kpi-value">{formatNum(summary.total_items)}</div>
          <div className="kpi-sub">{formatNum(summary.total_units)} total units on hand</div>
        </div>
        <div className="kpi-card kpi-emerald">
          <div className="kpi-label">Healthy (In Stock)</div>
          <div className="kpi-value">{formatNum(summary.in_stock_count)}</div>
          <div className="kpi-sub">Retail value: {formatINR(summary.total_sell_value)}</div>
        </div>
        <div className="kpi-card kpi-amber">
          <div className="kpi-label">Low Stock Alerts</div>
          <div className="kpi-value">{formatNum(summary.low_stock_count)}</div>
          <div className="kpi-sub">At or below reorder threshold</div>
        </div>
        <div className="kpi-card kpi-rose">
          <div className="kpi-label">Out of Stock</div>
          <div className="kpi-value">{formatNum(summary.out_of_stock_count)}</div>
          <div className="kpi-sub">Cost value: {formatINR(summary.total_cost_value)}</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'showcase' ? 'active' : ''}`} onClick={() => setTab('showcase')}>
          Store Stock Showcase ({items.length})
        </button>
        <button className={`tab-btn ${tab === 'movements' ? 'active' : ''}`} onClick={() => setTab('movements')}>
          Auto-Deduction & Restock Log ({movements.length})
        </button>
      </div>

      {tab === 'showcase' ? (
        <>
          <div className="toolbar">
            <div className="toolbar-group">
              <div className="search-box">
                <IconSearch size={15} />
                <input
                  className="input"
                  placeholder="Search item name, SKU, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className="perm-check" style={{ background: '#fff' }}>
                <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
                Show Low / Out of Stock Only
              </label>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading per-store stock inventory...</div>
          ) : groupedByStore.length === 0 ? (
            <div className="empty-state">No stores available.</div>
          ) : (
            groupedByStore.map(({ store, items: storeItems, lowCount, storeSellVal }) => (
              <div key={store.id} className="store-stock-section">
                <div className="store-stock-section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconStore size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {store.name} <span className="badge badge-blue" style={{ marginLeft: 6 }}>{store.code}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {storeItems.length} item(s) · Retail Value: {formatINR(storeSellVal)}
                        {lowCount > 0 && (
                          <span style={{ color: '#e11d48', fontWeight: 700, marginLeft: 8 }}>
                            · {lowCount} Low/Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openCreateForStore(String(store.id))}
                  >
                    <IconPlus size={14} /> Add Stock to {store.name}
                  </button>
                </div>

                <div style={{ padding: 14 }}>
                  {storeItems.length === 0 ? (
                    <div className="empty-state" style={{ padding: 24, border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                      No stock items created for <strong>{store.name}</strong> yet.
                      Click <strong>"+ Add Stock to {store.name}"</strong> above to add this store&apos;s own items.
                    </div>
                  ) : (
                    <div className="cards-grid">{storeItems.map(renderStockCard)}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Store</th>
                <th>Item</th>
                <th>Type</th>
                <th className="num-cell">Change</th>
                <th className="num-cell">Qty After</th>
                <th>Note / By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12 }}>{formatDateTime(m.created_at)}</td>
                  <td><span className="badge badge-slate">{m.store_name}</span></td>
                  <td style={{ fontWeight: 600 }}>{m.item_name}</td>
                  <td>
                    <span className={`badge ${Number(m.quantity_change) >= 0 ? 'badge-emerald' : 'badge-amber'}`}>
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="num-cell" style={{ fontWeight: 700, color: Number(m.quantity_change) >= 0 ? '#059669' : '#e11d48' }}>
                    {Number(m.quantity_change) >= 0 ? '+' : ''}{formatNum(m.quantity_change)} {m.unit}
                  </td>
                  <td className="num-cell" style={{ fontWeight: 700 }}>{formatNum(m.quantity_after)} {m.unit}</td>
                  <td style={{ fontSize: 12 }}>
                    <div>{m.note}</div>
                    <div style={{ color: '#64748b' }}>{m.created_by_name}</div>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={7} className="empty-state">No stock movements logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Stock Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing ? `Edit Stock: ${editing.name}` : 'Create Store Stock Item'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={saveItem}>
              <div className="modal-body">
                {/* Store Highlighted First */}
                <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#1e40af' }}>Target Store * (Each store has separate stock)</label>
                    <select
                      className="select"
                      value={form.store_id}
                      onChange={(e) => setForm((p) => ({ ...p, store_id: e.target.value }))}
                      disabled={Boolean(editing) || (!hasPerm('view_all_stores') && Boolean(user?.store_id))}
                      required
                    >
                      <option value="">-- Select Which Store Owns This Stock --</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Item Name *</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. A4 Paper, Lamination Pouch, Airtel SIM"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU / Code</label>
                    <input className="input" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} placeholder="STK-001" />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input className="input" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input className="input" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="pcs, sheets, packs, bottles" />
                  </div>
                </div>

                <div className="form-grid-4">
                  {!editing && (
                    <div className="form-group">
                      <label className="form-label">Opening Qty</label>
                      <input type="number" step="0.01" className="input" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Low Alert Qty</label>
                    <input type="number" step="0.01" className="input" value={form.min_threshold} onChange={(e) => setForm((p) => ({ ...p, min_threshold: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price (₹)</label>
                    <input type="number" step="0.01" className="input" value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sell Price (₹)</label>
                    <input type="number" step="0.01" className="input" value={form.sell_price} onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Image (Optional — Cloudinary)</label>
                  <input type="file" className="input" style={{ padding: 5 }} accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add to Store Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock / Deduct Modal */}
      {adjustItem && (
        <div className="modal-backdrop" onClick={() => setAdjustItem(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{adjForm.movement_type === 'restock' ? 'Restock' : 'Use Stock'} — {adjustItem.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAdjustItem(null)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={submitAdjust}>
              <div className="modal-body">
                <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', fontSize: 13 }}>
                  Store: <strong>{adjustItem.store_name}</strong><br />
                  Current Available: <strong>{formatNum(adjustItem.quantity)} {adjustItem.unit}</strong>
                </div>
                <div className="form-group">
                  <label className="form-label">Movement Type</label>
                  <select className="select" value={adjForm.movement_type} onChange={(e) => setAdjForm((p) => ({ ...p, movement_type: e.target.value }))}>
                    <option value="restock">+ Restock / Purchase</option>
                    <option value="manual_out">− Manual Use / Deduct</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity ({adjustItem.unit}) *</label>
                  <input type="number" step="0.01" min="0.01" className="input" value={adjForm.quantity} onChange={(e) => setAdjForm((p) => ({ ...p, quantity: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input className="input" value={adjForm.note} onChange={(e) => setAdjForm((p) => ({ ...p, note: e.target.value }))} placeholder="Supplier / reason" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustItem(null)}>Cancel</button>
                <button type="submit" className={`btn ${adjForm.movement_type === 'restock' ? 'btn-emerald' : 'btn-danger'}`}>
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
