import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatINR } from '../utils/format';
import { IconClose, IconEdit, IconPlus, IconTrash } from '../components/Icons';

const EMPTY_SERVICE = {
  name: '',
  category: 'Money Transfer',
  description: '',
  default_charge: 0,
  default_tax_percent: 0,
  default_internal_tax_percent: 0,
  default_wallet_id: '',
  linked_stock_item_id: '',
  linked_stock_qty: 0,
  custom_fields: [],
  is_active: true,
};

export default function ServicesPage() {
  const { selectedStoreId } = useAuth();
  const { showToast } = useToast();
  const [services, setServices] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [svRes, wRes, stRes] = await Promise.all([
        api.getServices({ include_inactive: 'true' }),
        api.getWallets({ store_id: selectedStoreId }),
        api.getStock({ store_id: selectedStoreId }),
      ]);
      setServices(svRes.services || []);
      setWallets(wRes.wallets || []);
      setStockItems(stRes.items || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SERVICE);
    setModalOpen(true);
  };

  const openEdit = (sv) => {
    setEditing(sv);
    setForm({
      name: sv.name,
      category: sv.category || 'General',
      description: sv.description || '',
      default_charge: sv.default_charge || 0,
      default_tax_percent: sv.default_tax_percent || 0,
      default_internal_tax_percent: sv.default_internal_tax_percent || 0,
      default_wallet_id: sv.default_wallet_id ? String(sv.default_wallet_id) : '',
      linked_stock_item_id: sv.linked_stock_item_id ? String(sv.linked_stock_item_id) : '',
      linked_stock_qty: sv.linked_stock_qty || 0,
      custom_fields: Array.isArray(sv.custom_fields)
        ? sv.custom_fields.map((f) => ({
            ...f,
            optionsText: Array.isArray(f.options) ? f.options.join(', ') : '',
          }))
        : [],
      is_active: sv.is_active !== false,
    });
    setModalOpen(true);
  };

  const addCustomField = () => {
    setForm((p) => ({
      ...p,
      custom_fields: [...p.custom_fields, { label: '', type: 'text', required: false, optionsText: '' }],
    }));
  };

  const updateField = (idx, patch) => {
    setForm((p) => ({
      ...p,
      custom_fields: p.custom_fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const removeField = (idx) => {
    setForm((p) => ({
      ...p,
      custom_fields: p.custom_fields.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        default_charge: Number(form.default_charge) || 0,
        default_tax_percent: Number(form.default_tax_percent) || 0,
        default_internal_tax_percent: Number(form.default_internal_tax_percent) || 0,
        default_wallet_id: form.default_wallet_id ? Number(form.default_wallet_id) : null,
        linked_stock_item_id: form.linked_stock_item_id ? Number(form.linked_stock_item_id) : null,
        linked_stock_qty: Number(form.linked_stock_qty) || 0,
        custom_fields: form.custom_fields
          .filter((f) => f.label && f.label.trim())
          .map((f) => ({
            key: f.key || undefined,
            label: f.label.trim(),
            type: f.type || 'text',
            required: Boolean(f.required),
            options: f.type === 'select' ? (f.optionsText || '').split(',').map((s) => s.trim()).filter(Boolean) : [],
          })),
      };

      if (editing) {
        await api.updateService(editing.id, payload);
        showToast('Service updated', 'success');
      } else {
        await api.createService(payload);
        showToast('Service created & ready in the Sheet!', 'success');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sv) => {
    if (!window.confirm(`Delete service "${sv.name}"?`)) return;
    try {
      await api.deleteService(sv.id);
      showToast('Service deleted', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dynamic Services Builder</h2>
          <p className="card-subtitle">
            Create any service with custom input fields, default charges, taxes, app/bank pool & auto-deduct stock — instantly callable inside the Sheet
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={15} /> Create Service
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Loading services...</div>
      ) : (
        <div className="cards-grid">
          {services.map((sv) => (
            <div key={sv.id} className="card" style={{ display: 'flex', flexDirection: 'column', opacity: sv.is_active ? 1 : 0.65 }}>
              <div className="card-header" style={{ padding: '13px 15px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{sv.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple">{sv.category}</span>
                    {!sv.is_active && <span className="badge badge-rose">Inactive</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => openEdit(sv)} title="Edit">
                    <IconEdit size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => handleDelete(sv)} title="Delete">
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              <div className="card-body" style={{ padding: '12px 15px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {sv.description && <p style={{ fontSize: 12.5, color: '#64748b' }}>{sv.description}</p>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, background: '#f8fafc', padding: 8, borderRadius: 7 }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Base Charge</div>
                    <div style={{ fontWeight: 700, color: '#059669' }}>{formatINR(sv.default_charge)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Cust Tax</div>
                    <div style={{ fontWeight: 700 }}>{sv.default_tax_percent}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Internal Tax</div>
                    <div style={{ fontWeight: 700, color: '#e11d48' }}>{sv.default_internal_tax_percent}%</div>
                  </div>
                </div>

                {sv.default_wallet_name && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Default App/Pool: </span>
                    <span className="badge badge-cyan">{sv.default_wallet_name}</span>
                  </div>
                )}

                {sv.linked_stock_name && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Auto Stock Deduct: </span>
                    <span className="badge badge-amber">
                      {sv.linked_stock_qty} {sv.linked_stock_unit} × {sv.linked_stock_name}
                    </span>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                    Custom Inputs ({Array.isArray(sv.custom_fields) ? sv.custom_fields.length : 0})
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Array.isArray(sv.custom_fields) && sv.custom_fields.length > 0 ? (
                      sv.custom_fields.map((f, i) => (
                        <span key={i} className="badge badge-slate">
                          {f.label} ({f.type})
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>No extra fields</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing ? `Edit Service: ${editing.name}` : 'Create Custom Service'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}>
                <IconClose size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Service Name *</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Money Transfer, Airtel Recharge, PAN Application"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      className="input"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      placeholder="Money Transfer, Recharge, e-Seva, Printing..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    className="input"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Short description shown to workers"
                  />
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Default Shop Charge (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.default_charge}
                      onChange={(e) => setForm((p) => ({ ...p, default_charge: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Customer Tax (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.default_tax_percent}
                      onChange={(e) => setForm((p) => ({ ...p, default_tax_percent: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Internal / App Tax (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.default_internal_tax_percent}
                      onChange={(e) => setForm((p) => ({ ...p, default_internal_tax_percent: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Default App / Bank Pool</label>
                    <select
                      className="select"
                      value={form.default_wallet_id}
                      onChange={(e) => setForm((p) => ({ ...p, default_wallet_id: e.target.value }))}
                    >
                      <option value="">-- Select per entry --</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>{w.name} ({w.store_name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Auto-Deduct Stock Item</label>
                    <select
                      className="select"
                      value={form.linked_stock_item_id}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          linked_stock_item_id: e.target.value,
                          linked_stock_qty: e.target.value ? (p.linked_stock_qty || 1) : 0,
                        }))
                      }
                    >
                      <option value="">-- No Stock Linked --</option>
                      {stockItems.map((si) => (
                        <option key={si.id} value={si.id}>{si.name} ({si.store_name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Qty Auto-Deducted</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.linked_stock_qty}
                      onChange={(e) => setForm((p) => ({ ...p, linked_stock_qty: e.target.value }))}
                      disabled={!form.linked_stock_item_id}
                    />
                  </div>
                </div>

                {/* Dynamic Custom Input Fields Builder */}
                <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>Custom Input Fields (Shown when called in Sheet)</div>
                      <div className="form-hint">Name inputs anything you need: Application No, Bank IFSC, Operator, Pages, etc.</div>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomField}>
                      <IconPlus size={14} /> Add Input Field
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.custom_fields.map((field, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1.2fr auto auto',
                          gap: 8,
                          alignItems: 'center',
                          background: '#fff',
                          padding: 8,
                          borderRadius: 7,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <input
                          className="input"
                          placeholder="Input Label (e.g. UTR Number)"
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          required
                        />
                        <select
                          className="select"
                          value={field.type}
                          onChange={(e) => updateField(idx, { type: e.target.value })}
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency (₹)</option>
                          <option value="phone">Phone</option>
                          <option value="date">Date</option>
                          <option value="select">Dropdown Select</option>
                        </select>
                        <input
                          className="input"
                          placeholder={field.type === 'select' ? 'Comma options: Opt1, Opt2' : '(Options only for Select)'}
                          disabled={field.type !== 'select'}
                          value={field.optionsText || ''}
                          onChange={(e) => updateField(idx, { optionsText: e.target.value })}
                        />
                        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                          />
                          Req
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ color: '#e11d48' }}
                          onClick={() => removeField(idx)}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                    {form.custom_fields.length === 0 && (
                      <div style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center', padding: 10 }}>
                        Click "+ Add Input Field" to define custom inputs for this service.
                      </div>
                    )}
                  </div>
                </div>

                {editing && (
                  <label className="perm-check" style={{ width: 'fit-content' }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Service is Active (visible in Sheet)
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
