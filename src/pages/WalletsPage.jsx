import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDateTime, formatINR } from '../utils/format';
import { IconClose, IconEdit, IconPlus, IconTrash } from '../components/Icons';

export default function WalletsPage() {
  const { user, stores, selectedStoreId, hasPerm } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState('wallets');
  const [wallets, setWallets] = useState([]);
  const [plans, setPlans] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const defaultStore = useMemo(() => {
    if (selectedStoreId && selectedStoreId !== 'all') return selectedStoreId;
    return user?.store_id ? String(user.store_id) : stores[0] ? String(stores[0].id) : '';
  }, [selectedStoreId, user, stores]);

  // Wallet modal
  const [walletModal, setWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [wForm, setWForm] = useState({
    store_id: '',
    name: '',
    provider: '',
    wallet_type: 'recharge',
    balance: 0,
    low_balance_alert: 2000,
    account_details: '',
  });

  // Top-up / adjust modal
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjForm, setAdjForm] = useState({ amount: '', entry_type: 'topup', note: '' });

  // Recharge plan modal
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [pForm, setPForm] = useState({
    wallet_id: '',
    operator: 'Airtel',
    plan_name: '',
    amount: '',
    validity: '',
    data_benefit: '',
    customer_charge: 5,
    internal_fee: 0,
    description: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, pRes, lRes] = await Promise.all([
        api.getWallets({ store_id: selectedStoreId, include_inactive: 'true' }),
        api.getRechargePlans({ store_id: selectedStoreId }),
        api.getWalletLedger({ store_id: selectedStoreId, limit: 150 }),
      ]);
      setWallets(wRes.wallets || []);
      setPlans(pRes.plans || []);
      setLedger(lRes.ledger || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openNewWallet = () => {
    setEditingWallet(null);
    setWForm({
      store_id: defaultStore,
      name: '',
      provider: '',
      wallet_type: 'recharge',
      balance: 0,
      low_balance_alert: 2000,
      account_details: '',
    });
    setWalletModal(true);
  };

  const openEditWallet = (w) => {
    setEditingWallet(w);
    setWForm({
      store_id: String(w.store_id),
      name: w.name,
      provider: w.provider || '',
      wallet_type: w.wallet_type || 'recharge',
      balance: w.balance,
      low_balance_alert: w.low_balance_alert || 0,
      account_details: w.account_details || '',
    });
    setWalletModal(true);
  };

  const saveWallet = async (e) => {
    e.preventDefault();
    try {
      if (editingWallet) {
        await api.updateWallet(editingWallet.id, wForm);
        showToast('Wallet updated', 'success');
      } else {
        await api.createWallet({ ...wForm, store_id: Number(wForm.store_id) });
        showToast('App / Bank wallet created', 'success');
      }
      setWalletModal(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.adjustWallet(adjustModal.id, {
        amount: Number(adjForm.amount),
        entry_type: adjForm.entry_type,
        note: adjForm.note,
      });
      showToast('Wallet balance updated', 'success');
      setAdjustModal(null);
      setAdjForm({ amount: '', entry_type: 'topup', note: '' });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteWallet = async (w) => {
    if (!window.confirm(`Delete wallet "${w.name}"?`)) return;
    try {
      await api.deleteWallet(w.id);
      showToast('Wallet deleted', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openNewPlan = () => {
    setEditingPlan(null);
    setPForm({
      wallet_id: wallets[0] ? String(wallets[0].id) : '',
      operator: 'Airtel',
      plan_name: '',
      amount: '',
      validity: '28 Days',
      data_benefit: '',
      customer_charge: 5,
      internal_fee: 0,
      description: '',
    });
    setPlanModal(true);
  };

  const openEditPlan = (p) => {
    setEditingPlan(p);
    setPForm({
      wallet_id: p.wallet_id ? String(p.wallet_id) : '',
      operator: p.operator || '',
      plan_name: p.plan_name || '',
      amount: p.amount || '',
      validity: p.validity || '',
      data_benefit: p.data_benefit || '',
      customer_charge: p.customer_charge || 0,
      internal_fee: p.internal_fee || 0,
      description: p.description || '',
    });
    setPlanModal(true);
  };

  const savePlan = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...pForm,
        wallet_id: pForm.wallet_id ? Number(pForm.wallet_id) : null,
        amount: Number(pForm.amount) || 0,
        customer_charge: Number(pForm.customer_charge) || 0,
        internal_fee: Number(pForm.internal_fee) || 0,
      };
      if (editingPlan) {
        await api.updateRechargePlan(editingPlan.id, payload);
        showToast('Recharge plan updated', 'success');
      } else {
        await api.createRechargePlan(payload);
        showToast('Recharge plan added', 'success');
      }
      setPlanModal(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deletePlan = async (p) => {
    if (!window.confirm(`Delete recharge plan "${p.plan_name}"?`)) return;
    try {
      await api.deleteRechargePlan(p.id);
      showToast('Plan deleted', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const totalBalance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>App Balances, Bank Transfer Pools & Recharge Plans</h2>
          <p className="card-subtitle">
            Track live balances on Airtel, Jio, Bank Transfer DMT & Cash — automatically deducted when selected in the Sheet
          </p>
        </div>
        <div className="toolbar-group">
          <div className="badge badge-cyan" style={{ fontSize: 13, padding: '6px 12px' }}>
            Combined Balance: <strong>{formatINR(totalBalance)}</strong>
          </div>
          <button className="btn btn-secondary" onClick={openNewPlan}>
            <IconPlus size={14} /> Add Recharge Plan
          </button>
          <button className="btn btn-primary" onClick={openNewWallet}>
            <IconPlus size={14} /> Add App / Bank Pool
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'wallets' ? 'active' : ''}`} onClick={() => setTab('wallets')}>
          App & Bank Wallets ({wallets.length})
        </button>
        <button className={`tab-btn ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
          Internal Recharge Plans ({plans.length})
        </button>
        <button className={`tab-btn ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>
          Balance Ledger ({ledger.length})
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Loading wallets & plans...</div>
      ) : tab === 'wallets' ? (
        <div className="cards-grid">
          {wallets.map((w) => {
            const isLow = Number(w.balance) <= Number(w.low_balance_alert);
            return (
              <div key={w.id} className="card" style={{ borderColor: isLow ? '#fda4af' : undefined }}>
                <div className="card-header" style={{ padding: '13px 15px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className="badge badge-cyan">{w.provider || w.wallet_type}</span>
                      <span className="badge badge-slate">{w.store_name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEditWallet(w)}><IconEdit size={14} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => deleteWallet(w)}><IconTrash size={14} /></button>
                  </div>
                </div>

                <div className="card-body" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Live Available Balance</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isLow ? '#e11d48' : '#0f172a' }}>
                      {formatINR(w.balance)}
                    </div>
                    <div style={{ fontSize: 11.5, color: isLow ? '#e11d48' : '#64748b' }}>
                      Alert threshold: {formatINR(w.low_balance_alert)} {isLow ? '· LOW BALANCE!' : ''}
                    </div>
                  </div>

                  {w.account_details && (
                    <div style={{ fontSize: 12, color: '#475569', background: '#f8fafc', padding: '7px 9px', borderRadius: 6 }}>
                      {w.account_details}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-emerald btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setAdjustModal(w);
                        setAdjForm({ amount: '', entry_type: 'topup', note: '' });
                      }}
                    >
                      + Refill / Top-Up
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAdjustModal(w);
                        setAdjForm({ amount: '', entry_type: 'debit', note: '' });
                      }}
                    >
                      − Deduct
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'plans' ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Plan Name</th>
                <th>Linked App Wallet</th>
                <th className="num-cell">Plan Amt</th>
                <th>Validity / Benefits</th>
                <th className="num-cell">Shop Charge</th>
                <th className="num-cell">Internal Fee</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><span className="badge badge-blue">{p.operator}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.plan_name}</td>
                  <td>{p.wallet_name || 'Any'}</td>
                  <td className="num-cell" style={{ fontWeight: 700 }}>{formatINR(p.amount)}</td>
                  <td>
                    <div>{p.validity}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{p.data_benefit}</div>
                  </td>
                  <td className="num-cell" style={{ color: '#059669', fontWeight: 600 }}>{formatINR(p.customer_charge)}</td>
                  <td className="num-cell" style={{ color: '#e11d48' }}>{formatINR(p.internal_fee)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEditPlan(p)}><IconEdit size={14} /></button>
                      <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => deletePlan(p)}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={8} className="empty-state">No recharge plans added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>App / Bank Wallet</th>
                <th>Store</th>
                <th>Type</th>
                <th className="num-cell">Change</th>
                <th className="num-cell">Before</th>
                <th className="num-cell">Balance After</th>
                <th>Note / By</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12 }}>{formatDateTime(l.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{l.wallet_name}</td>
                  <td>{l.store_name}</td>
                  <td>
                    <span className={`badge ${Number(l.amount) >= 0 ? 'badge-emerald' : 'badge-rose'}`}>
                      {l.entry_type}
                    </span>
                  </td>
                  <td className="num-cell" style={{ fontWeight: 700, color: Number(l.amount) >= 0 ? '#059669' : '#e11d48' }}>
                    {Number(l.amount) >= 0 ? '+' : ''}{formatINR(l.amount)}
                  </td>
                  <td className="num-cell">{formatINR(l.balance_before)}</td>
                  <td className="num-cell" style={{ fontWeight: 700 }}>{formatINR(l.balance_after)}</td>
                  <td style={{ fontSize: 12 }}>
                    <div>{l.note}</div>
                    <div style={{ color: '#64748b' }}>{l.created_by_name}</div>
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={8} className="empty-state">No wallet transactions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Wallet Modal */}
      {walletModal && (
        <div className="modal-backdrop" onClick={() => setWalletModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingWallet ? `Edit ${editingWallet.name}` : 'Add Recharge App / Bank Pool'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setWalletModal(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={saveWallet}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Store *</label>
                    <select
                      className="select"
                      value={wForm.store_id}
                      onChange={(e) => setWForm((p) => ({ ...p, store_id: e.target.value }))}
                      disabled={Boolean(editingWallet) || (!hasPerm('view_all_stores') && Boolean(user?.store_id))}
                      required
                    >
                      <option value="">Select Store</option>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Wallet / Pool Name *</label>
                    <input
                      className="input"
                      value={wForm.name}
                      onChange={(e) => setWForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Airtel Mitra, Jio POS, HDFC DMT"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Provider / App Name</label>
                    <input
                      className="input"
                      value={wForm.provider}
                      onChange={(e) => setWForm((p) => ({ ...p, provider: e.target.value }))}
                      placeholder="Airtel, Jio, Vi, SBI Bank, Cash..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pool Type</label>
                    <select
                      className="select"
                      value={wForm.wallet_type}
                      onChange={(e) => setWForm((p) => ({ ...p, wallet_type: e.target.value }))}
                    >
                      <option value="recharge">Mobile / DTH Recharge App</option>
                      <option value="bank_transfer">Bank Transfer / DMT Pool</option>
                      <option value="upi">UPI / Wallet App</option>
                      <option value="cash">Physical Cash Drawer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  {!editingWallet && (
                    <div className="form-group">
                      <label className="form-label">Opening Balance (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={wForm.balance}
                        onChange={(e) => setWForm((p) => ({ ...p, balance: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Low Balance Alert Threshold (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={wForm.low_balance_alert}
                      onChange={(e) => setWForm((p) => ({ ...p, low_balance_alert: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Account / Login ID Notes</label>
                  <input
                    className="input"
                    value={wForm.account_details}
                    onChange={(e) => setWForm((p) => ({ ...p, account_details: e.target.value }))}
                    placeholder="LAPU number, settlement account details..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setWalletModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingWallet ? 'Save Changes' : 'Create Wallet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top-Up / Deduct Modal */}
      {adjustModal && (
        <div className="modal-backdrop" onClick={() => setAdjustModal(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{adjForm.entry_type === 'topup' ? 'Refill / Top-Up' : 'Deduct'} — {adjustModal.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAdjustModal(null)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={submitAdjust}>
              <div className="modal-body">
                <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', fontSize: 13 }}>
                  Current Balance: <strong>{formatINR(adjustModal.balance)}</strong>
                </div>
                <div className="form-group">
                  <label className="form-label">Action</label>
                  <select className="select" value={adjForm.entry_type} onChange={(e) => setAdjForm((p) => ({ ...p, entry_type: e.target.value }))}>
                    <option value="topup">+ Add Balance (Top-Up / Load)</option>
                    <option value="debit">− Deduct Balance (Withdrawal / Fee)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note / Reference</label>
                  <input
                    className="input"
                    value={adjForm.note}
                    onChange={(e) => setAdjForm((p) => ({ ...p, note: e.target.value }))}
                    placeholder="e.g. Loaded via UPI from SBI"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button type="submit" className={`btn ${adjForm.entry_type === 'topup' ? 'btn-emerald' : 'btn-danger'}`}>
                  Confirm Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recharge Plan Modal */}
      {planModal && (
        <div className="modal-backdrop" onClick={() => setPlanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingPlan ? 'Edit Recharge Plan' : 'Add Internal Recharge Plan'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPlanModal(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={savePlan}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Operator *</label>
                    <input
                      className="input"
                      value={pForm.operator}
                      onChange={(e) => setPForm((p) => ({ ...p, operator: e.target.value }))}
                      placeholder="Airtel, Jio, Vi, BSNL, Tata Play"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Linked App Wallet</label>
                    <select className="select" value={pForm.wallet_id} onChange={(e) => setPForm((p) => ({ ...p, wallet_id: e.target.value }))}>
                      <option value="">-- Any Wallet --</option>
                      {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.store_name})</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Plan Name *</label>
                    <input
                      className="input"
                      value={pForm.plan_name}
                      onChange={(e) => setPForm((p) => ({ ...p, plan_name: e.target.value }))}
                      placeholder="e.g. Airtel 299 Unlimited"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={pForm.amount}
                      onChange={(e) => setPForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Validity</label>
                    <input
                      className="input"
                      value={pForm.validity}
                      onChange={(e) => setPForm((p) => ({ ...p, validity: e.target.value }))}
                      placeholder="28 Days / 84 Days"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data / Calling Benefit</label>
                    <input
                      className="input"
                      value={pForm.data_benefit}
                      onChange={(e) => setPForm((p) => ({ ...p, data_benefit: e.target.value }))}
                      placeholder="1.5GB/Day + Unlimited 5G"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Default Customer Charge (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={pForm.customer_charge}
                      onChange={(e) => setPForm((p) => ({ ...p, customer_charge: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Internal App Fee / Tax (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={pForm.internal_fee}
                      onChange={(e) => setPForm((p) => ({ ...p, internal_fee: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingPlan ? 'Update Plan' : 'Save Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
