import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { blockNonNumericKey, formatINR, formatNum, sanitizeNumber } from '../utils/format';
import {
  IconClients,
  IconClose,
  IconEdit,
  IconFile,
  IconPlus,
  IconSearch,
  IconStock,
  IconStore,
  IconTrash,
  IconUpload,
} from '../components/Icons';

const DOC_TYPES = [
  'Aadhaar Card (Front)',
  'Aadhaar Card (Back)',
  'PAN Card',
  'Passport Photo',
  'Ration / Smart Card',
  'Income Certificate',
  'Community Certificate',
  'Bank Passbook',
  'Other Document',
];

export default function StoresPage() {
  const { refreshStores, hasPerm } = useAuth();
  const { showToast } = useToast();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeTab, setStoreTab] = useState('stock'); // 'stock' | 'clients'

  // Create / Edit Store modal
  const [storeModal, setStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [storeForm, setStoreForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    seed_default_wallets: true,
    is_active: true,
  });

  // Per-store Stock state
  const [stockItems, setStockItems] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockModal, setStockModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [stockForm, setStockForm] = useState({
    name: '',
    sku: '',
    category: 'Stationery',
    quantity: '',
    unit: 'pcs',
    min_threshold: '10',
    cost_price: '',
    sell_price: '',
  });
  const [stockImage, setStockImage] = useState(null);
  const [adjustStockItem, setAdjustStockItem] = useState(null);
  const [adjForm, setAdjForm] = useState({ quantity: '', movement_type: 'restock', note: '' });

  // Per-store Clients state
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [addClientModal, setAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    phone: '',
    aadhaar_number: '',
    pan_number: '',
    bank_account: '',
    address: '',
    notes: '',
  });
  const [clientVault, setClientVault] = useState(null);
  const [docType, setDocType] = useState('Aadhaar Card (Front)');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getStores();
      setStores(res.stores || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const loadStoreDetails = useCallback(async (storeObj) => {
    if (!storeObj) return;
    try {
      const [stRes, clRes] = await Promise.all([
        api.getStock({ store_id: storeObj.id, search: stockSearch }),
        api.getClients({ store_id: storeObj.id, search: clientSearch }),
      ]);
      setStockItems(stRes.items || []);
      setClients(clRes.clients || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [stockSearch, clientSearch, showToast]);

  useEffect(() => {
    if (selectedStore) {
      const t = setTimeout(() => loadStoreDetails(selectedStore), 140);
      return () => clearTimeout(t);
    }
  }, [selectedStore, loadStoreDetails]);

  const openCreateStore = () => {
    setEditingStore(null);
    setStoreForm({ name: '', code: '', address: '', phone: '', email: '', seed_default_wallets: true, is_active: true });
    setStoreModal(true);
  };

  const openEditStore = (s, e) => {
    e.stopPropagation();
    setEditingStore(s);
    setStoreForm({
      name: s.name,
      code: s.code,
      address: s.address || '',
      phone: s.phone || '',
      email: s.email || '',
      seed_default_wallets: false,
      is_active: s.is_active !== false,
    });
    setStoreModal(true);
  };

  const saveStore = async (e) => {
    e.preventDefault();
    try {
      if (editingStore) {
        await api.updateStore(editingStore.id, storeForm);
        showToast('Store updated', 'success');
      } else {
        await api.createStore(storeForm);
        showToast('New store branch created!', 'success');
      }
      setStoreModal(false);
      await Promise.all([loadStores(), refreshStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteStore = async (s, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete store "${s.name}"?`)) return;
    try {
      await api.deleteStore(s.id);
      showToast('Store deleted', 'success');
      await Promise.all([loadStores(), refreshStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== STORE STOCK HANDLERS =====
  const openAddStock = () => {
    setEditingStock(null);
    setStockImage(null);
    setStockForm({ name: '', sku: '', category: 'Stationery', quantity: '', unit: 'pcs', min_threshold: '10', cost_price: '', sell_price: '' });
    setStockModal(true);
  };

  const openEditStock = (item) => {
    setEditingStock(item);
    setStockImage(null);
    setStockForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category || 'General',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || 'pcs',
      min_threshold: String(item.min_threshold ?? '10'),
      cost_price: String(item.cost_price ?? ''),
      sell_price: String(item.sell_price ?? ''),
    });
    setStockModal(true);
  };

  const saveStock = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('store_id', String(selectedStore.id));
      Object.entries(stockForm).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      if (stockImage) fd.append('image', stockImage);
      if (editingStock) {
        await api.updateStock(editingStock.id, fd);
        showToast('Stock updated', 'success');
      } else {
        await api.createStock(fd);
        showToast(`Added "${stockForm.name}" to ${selectedStore.name}`, 'success');
      }
      setStockModal(false);
      await Promise.all([loadStoreDetails(selectedStore), loadStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitStockAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.adjustStock(adjustStockItem.id, {
        quantity: Number(adjForm.quantity),
        movement_type: adjForm.movement_type,
        note: adjForm.note,
      });
      showToast('Stock updated', 'success');
      setAdjustStockItem(null);
      await Promise.all([loadStoreDetails(selectedStore), loadStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteStock = async (item) => {
    if (!window.confirm(`Delete "${item.name}" from ${selectedStore.name}?`)) return;
    try {
      await api.deleteStock(item.id);
      showToast('Stock item deleted', 'success');
      await Promise.all([loadStoreDetails(selectedStore), loadStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== STORE CLIENT VAULT HANDLERS =====
  const handleSaveStoreClient = async (e) => {
    e.preventDefault();
    try {
      await api.createClient({
        store_id: selectedStore.id,
        name: newClientForm.name,
        phone: newClientForm.phone,
        aadhaar_number: newClientForm.aadhaar_number,
        pan_number: newClientForm.pan_number,
        address: newClientForm.address,
        notes: newClientForm.notes,
        extra_details: { bank_account: newClientForm.bank_account || '' },
      });
      showToast(`Added "${newClientForm.name}" to ${selectedStore.name}`, 'success');
      setAddClientModal(false);
      setNewClientForm({ name: '', phone: '', aadhaar_number: '', pan_number: '', bank_account: '', address: '', notes: '' });
      await Promise.all([loadStoreDetails(selectedStore), loadStores()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openClientVault = async (clientId) => {
    setSelectedAssetIds([]);
    try {
      const res = await api.getClient(clientId);
      setClientVault(res);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile || !clientVault?.client) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('doc_type', docType);
      fd.append('title', docTitle.trim() || docType);
      await api.uploadClientDoc(clientVault.client.id, fd);
      showToast('Asset uploaded to Cloudinary!', 'success');
      setDocFile(null);
      setDocTitle('');
      const refreshed = await api.getClient(clientVault.client.id);
      setClientVault(refreshed);
      loadStoreDetails(selectedStore);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const toggleAssetSelect = (docId) => {
    setSelectedAssetIds((prev) => (prev.includes(docId) ? prev.filter((x) => x !== docId) : [...prev, docId]));
  };

  const openSelectedAssets = () => {
    const docs = (clientVault?.documents || []).filter((d) => selectedAssetIds.includes(d.id));
    docs.forEach((d) => window.open(d.cloudinary_url, '_blank', 'noopener,noreferrer'));
  };

  // ===== VIEW 2: SELECTED STORE WORKSPACE (STORE STOCK + STORE CLIENTS) =====
  if (selectedStore) {
    return (
      <div>
        <div className="toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedStore(null);
                setStockSearch('');
                setClientSearch('');
              }}
            >
              ← All Stores
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedStore.name} <span className="badge badge-blue" style={{ marginLeft: 6 }}>{selectedStore.code}</span>
              </h2>
              <p className="card-subtitle">{selectedStore.address || 'Manage this store’s dedicated Stock & Clients'}</p>
            </div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${storeTab === 'stock' ? 'active' : ''}`} onClick={() => setStoreTab('stock')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconStock size={15} /> Store Stock ({stockItems.length})
            </span>
          </button>
          <button className={`tab-btn ${storeTab === 'clients' ? 'active' : ''}`} onClick={() => setStoreTab('clients')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconClients size={15} /> Store Clients ({clients.length})
            </span>
          </button>
        </div>

        {storeTab === 'stock' ? (
          <>
            <div className="toolbar">
              <div className="search-box">
                <IconSearch size={14} />
                <input
                  className="input"
                  placeholder={`Search stock in ${selectedStore.name}...`}
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                />
              </div>
              {hasPerm('stock') && (
                <button className="btn btn-primary" onClick={openAddStock}>
                  <IconPlus size={15} /> Add Stock to {selectedStore.name}
                </button>
              )}
            </div>

            {stockItems.length === 0 ? (
              <div className="empty-state" style={{ border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                No stock items in <strong>{selectedStore.name}</strong> yet. Click <strong>+ Add Stock</strong> above.
              </div>
            ) : (
              <div className="cards-grid">
                {stockItems.map((item) => {
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
                        borderColor: item.stock_status === 'out_of_stock' ? '#fda4af' : item.stock_status === 'low_stock' ? '#fcd34d' : undefined,
                      }}
                    >
                      {item.image_url && (
                        <div style={{ height: 110, background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                          <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.category} {item.sku ? `· ${item.sku}` : ''}</div>
                          </div>
                          <span className={`badge ${statusBadge}`}>{statusText}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-subtle)', padding: '9px 11px', borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Available</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNum(item.quantity)} <span style={{ fontSize: 12, color: '#64748b' }}>{item.unit}</span></div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12 }}>
                            <div>Alert ≤ <strong>{formatNum(item.min_threshold)}</strong></div>
                            <div style={{ color: '#059669' }}>Sell: {formatINR(item.sell_price)}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-emerald btn-sm" style={{ flex: 1 }} onClick={() => { setAdjustStockItem(item); setAdjForm({ quantity: '', movement_type: 'restock', note: '' }); }}>+ Restock</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setAdjustStockItem(item); setAdjForm({ quantity: '', movement_type: 'manual_out', note: '' }); }}>− Use</button>
                          <button className="btn btn-ghost btn-icon" onClick={() => openEditStock(item)}><IconEdit size={14} /></button>
                          <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => deleteStock(item)}><IconTrash size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="toolbar">
              <div className="search-box" style={{ minWidth: 270 }}>
                <IconSearch size={14} />
                <input
                  className="input"
                  placeholder="Filter by mobile number or name..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
              <div className="toolbar-group">
                <span className="badge badge-blue" style={{ padding: '6px 11px' }}>{clients.length} Client(s)</span>
                <button className="btn btn-primary btn-sm" onClick={() => setAddClientModal(true)}>
                  <IconPlus size={14} /> Add Customer to {selectedStore.name}
                </button>
              </div>
            </div>

            {clients.length === 0 ? (
              <div className="empty-state" style={{ border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                No clients linked to <strong>{selectedStore.name}</strong> yet.
              </div>
            ) : (
              <div className="cards-grid">
                {clients.map((c) => (
                  <div key={c.id} className="customer-card" onClick={() => openClientVault(c.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                        <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 13.5, marginTop: 2 }}>{c.phone}</div>
                      </div>
                      <span className="badge badge-purple">{c.doc_count} Assets</span>
                    </div>
                    {c.aadhaar_number && (
                      <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                        Aadhaar: {c.aadhaar_number}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>{c.tx_count} visits</span>
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>Check Assets →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Add/Edit Stock Modal */}
        {stockModal && (
          <div className="modal-backdrop" onClick={() => setStockModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{editingStock ? `Edit Stock` : `Add Stock to ${selectedStore.name}`}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setStockModal(false)}><IconClose size={18} /></button>
              </div>
              <form onSubmit={saveStock}>
                <div className="modal-body">
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Item Name *</label>
                      <input className="input" value={stockForm.name} onChange={(e) => setStockForm((p) => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">SKU / Code</label>
                      <input className="input" value={stockForm.sku} onChange={(e) => setStockForm((p) => ({ ...p, sku: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input className="input" value={stockForm.category} onChange={(e) => setStockForm((p) => ({ ...p, category: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input className="input" value={stockForm.unit} onChange={(e) => setStockForm((p) => ({ ...p, unit: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-grid-4">
                    {!editingStock && (
                      <div className="form-group">
                        <label className="form-label">Opening Qty</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input"
                          value={stockForm.quantity}
                          onKeyDown={(e) => blockNonNumericKey(e, true)}
                          onChange={(e) => setStockForm((p) => ({ ...p, quantity: sanitizeNumber(e.target.value, true) }))}
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Low Alert Qty</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={stockForm.min_threshold}
                        onKeyDown={(e) => blockNonNumericKey(e, true)}
                        onChange={(e) => setStockForm((p) => ({ ...p, min_threshold: sanitizeNumber(e.target.value, true) }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={stockForm.cost_price}
                        onKeyDown={(e) => blockNonNumericKey(e, true)}
                        onChange={(e) => setStockForm((p) => ({ ...p, cost_price: sanitizeNumber(e.target.value, true) }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sell (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={stockForm.sell_price}
                        onKeyDown={(e) => blockNonNumericKey(e, true)}
                        onChange={(e) => setStockForm((p) => ({ ...p, sell_price: sanitizeNumber(e.target.value, true) }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Product Image (Optional)</label>
                    <input type="file" className="input" style={{ padding: 5 }} accept="image/*" onChange={(e) => setStockImage(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setStockModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingStock ? 'Update Stock' : 'Save Stock'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Restock / Use Modal */}
        {adjustStockItem && (
          <div className="modal-backdrop" onClick={() => setAdjustStockItem(null)}>
            <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{adjForm.movement_type === 'restock' ? 'Restock' : 'Use'} — {adjustStockItem.name}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setAdjustStockItem(null)}><IconClose size={18} /></button>
              </div>
              <form onSubmit={submitStockAdjust}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Quantity ({adjustStockItem.unit}) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      value={adjForm.quantity}
                      onKeyDown={(e) => blockNonNumericKey(e, true)}
                      onChange={(e) => setAdjForm((p) => ({ ...p, quantity: sanitizeNumber(e.target.value, true) }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note</label>
                    <input className="input" value={adjForm.note} onChange={(e) => setAdjForm((p) => ({ ...p, note: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setAdjustStockItem(null)}>Cancel</button>
                  <button type="submit" className={`btn ${adjForm.movement_type === 'restock' ? 'btn-emerald' : 'btn-danger'}`}>Update</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Customer inside Store Modal */}
        {addClientModal && (
          <div className="modal-backdrop" onClick={() => setAddClientModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Add Customer — {selectedStore.name}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setAddClientModal(false)}><IconClose size={18} /></button>
              </div>
              <form onSubmit={handleSaveStoreClient}>
                <div className="modal-body">
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Customer Name *</label>
                      <input className="input" value={newClientForm.name} onChange={(e) => setNewClientForm((p) => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number * (Numbers Only)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input"
                        value={newClientForm.phone}
                        onKeyDown={(e) => blockNonNumericKey(e, false)}
                        onChange={(e) => setNewClientForm((p) => ({ ...p, phone: sanitizeNumber(e.target.value, false) }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-grid-3">
                    <div className="form-group">
                      <label className="form-label">Aadhaar Number</label>
                      <input className="input" value={newClientForm.aadhaar_number} onChange={(e) => setNewClientForm((p) => ({ ...p, aadhaar_number: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PAN Number</label>
                      <input className="input" value={newClientForm.pan_number} onChange={(e) => setNewClientForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bank Account / IFSC</label>
                      <input className="input" value={newClientForm.bank_account} onChange={(e) => setNewClientForm((p) => ({ ...p, bank_account: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input className="input" value={newClientForm.address} onChange={(e) => setNewClientForm((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <input className="input" value={newClientForm.notes} onChange={(e) => setNewClientForm((p) => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setAddClientModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Customer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Client Assets Modal inside Store */}
        {clientVault && (
          <div className="modal-backdrop" onClick={() => setClientVault(null)}>
            <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-title">{clientVault.client.name} — Assets</div>
                  <div className="card-subtitle">Mobile: {clientVault.client.phone} · {selectedStore.name}</div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setClientVault(null)}><IconClose size={18} /></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleUploadDoc} style={{ padding: 12, borderRadius: 9, background: 'var(--primary-soft)', border: '1px solid var(--border-strong)' }}>
                  <div className="form-grid-4">
                    <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                      {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className="input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Asset title" />
                    <input type="file" className="input" style={{ padding: 5 }} accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} required />
                    <button type="submit" className="btn btn-primary" disabled={uploadingDoc}>
                      <IconUpload size={14} /> {uploadingDoc ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </form>

                {selectedAssetIds.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                    <strong style={{ color: '#065f46' }}>{selectedAssetIds.length} asset(s) chosen</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-emerald btn-sm" onClick={openSelectedAssets}>Open Selected</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAssetIds([])}>Clear</button>
                    </div>
                  </div>
                )}

                <div className="doc-grid">
                  {(clientVault.documents || []).map((doc) => {
                    const checked = selectedAssetIds.includes(doc.id);
                    const isImage = doc.resource_type === 'image' && doc.file_format !== 'pdf';
                    return (
                      <div key={doc.id} className={`doc-card ${checked ? 'asset-selected' : ''}`} onClick={() => toggleAssetSelect(doc.id)} style={{ cursor: 'pointer' }}>
                        <div className="doc-preview">
                          {isImage ? <img src={doc.cloudinary_url} alt={doc.title} /> : <IconFile size={32} />}
                        </div>
                        <div className="doc-info">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="badge badge-blue">{doc.doc_type}</span>
                            <input type="checkbox" checked={checked} onChange={() => toggleAssetSelect(doc.id)} onClick={(e) => e.stopPropagation()} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{doc.title}</div>
                          <a href={doc.cloudinary_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-secondary btn-sm" style={{ marginTop: 4 }}>
                            Open
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== VIEW 1: ALL STORES GRID (CLICK ANY STORE TO OPEN STORE STOCK & STORE CLIENTS) =====
  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Stores</h2>
          <p className="card-subtitle">
            Click any store to manage its <strong>Store Stock</strong> and <strong>Store Clients</strong>
          </p>
        </div>
        {hasPerm('stores') && (
          <button className="btn btn-primary" onClick={openCreateStore}>
            <IconPlus size={15} /> Add New Store
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading stores...</div>
      ) : (
        <div className="cards-grid">
          {stores.map((s) => (
            <div
              key={s.id}
              className="store-sheet-card"
              onClick={() => {
                setSelectedStore(s);
                setStoreTab('stock');
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconStore size={19} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <span className="badge badge-blue">{s.code}</span>
                      {Number(s.low_stock_count) > 0 && <span className="badge badge-rose">{s.low_stock_count} Low Stock</span>}
                    </div>
                  </div>
                </div>

                {hasPerm('stores') && (
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => openEditStore(s, e)}><IconEdit size={14} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={(e) => deleteStore(s, e)}><IconTrash size={14} /></button>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: 'var(--surface-subtle)', padding: 10, borderRadius: 8, fontSize: 12 }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Stock Items</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.stock_count ?? 0}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Clients</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.client_count ?? 0}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Workers</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.worker_count ?? 0}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStore(s);
                    setStoreTab('stock');
                  }}
                >
                  Store Stock
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStore(s);
                    setStoreTab('clients');
                  }}
                >
                  Store Clients
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {storeModal && (
        <div className="modal-backdrop" onClick={() => setStoreModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingStore ? `Edit Store: ${editingStore.name}` : 'Add New Store'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setStoreModal(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={saveStore}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Store Name *</label>
                    <input className="input" value={storeForm.name} onChange={(e) => setStoreForm((p) => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Store Code *</label>
                    <input className="input" value={storeForm.code} onChange={(e) => setStoreForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} required />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input"
                      value={storeForm.phone}
                      onKeyDown={(e) => blockNonNumericKey(e, false)}
                      onChange={(e) => setStoreForm((p) => ({ ...p, phone: sanitizeNumber(e.target.value, false) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="input" value={storeForm.email} onChange={(e) => setStoreForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="textarea" value={storeForm.address} onChange={(e) => setStoreForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStoreModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingStore ? 'Save Changes' : 'Create Store'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
