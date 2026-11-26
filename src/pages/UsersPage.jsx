import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../utils/format';
import { IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from '../components/Icons';

const PERM_LABELS = [
  { key: 'dashboard', label: 'Dashboard Overview' },
  { key: 'sheet', label: 'Operations Sheet' },
  { key: 'manage_columns', label: 'Manage Sheet Columns & Formulas' },
  { key: 'services', label: 'Service Builder' },
  { key: 'wallets', label: 'Wallets & Recharge Plans' },
  { key: 'clients', label: 'Clients & Cloudinary Vault' },
  { key: 'stock', label: 'Stock Management' },
  { key: 'stores', label: 'Add / Manage Stores' },
  { key: 'users', label: 'Manage Users & Access' },
  { key: 'activity_logs', label: 'View Activity Logs' },
  { key: 'view_all_stores', label: 'View All Stores (Company Total)' },
  { key: 'can_delete', label: 'Delete Records' },
];

export default function UsersPage() {
  const { user: currentUser, stores, selectedStoreId } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [presets, setPresets] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'worker',
    store_id: '',
    permissions: {},
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        api.getUsers({ store_id: selectedStoreId, search }),
        api.getRolePresets(),
      ]);
      setUsers(uRes.users || []);
      setPresets(pRes.presets || {});
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, search, showToast]);

  useEffect(() => {
    const t = setTimeout(loadData, 160);
    return () => clearTimeout(t);
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    const workerPerms = presets.worker || {
      dashboard: true,
      sheet: true,
      wallets: true,
      clients: true,
      stock: true,
    };
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'worker',
      store_id: selectedStoreId !== 'all' ? selectedStoreId : (stores[0] ? String(stores[0].id) : ''),
      permissions: { ...workerPerms },
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      password: '',
      role: u.role,
      store_id: u.store_id ? String(u.store_id) : '',
      permissions: { ...(u.permissions || {}) },
      is_active: u.is_active !== false,
    });
    setModalOpen(true);
  };

  const handleRoleChange = (role) => {
    setForm((p) => ({
      ...p,
      role,
      permissions: presets[role] ? { ...presets[role] } : p.permissions,
    }));
  };

  const togglePerm = (key) => {
    setForm((p) => ({
      ...p,
      permissions: { ...p.permissions, [key]: !p.permissions[key] },
    }));
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        store_id: form.store_id ? Number(form.store_id) : null,
      };
      if (editing && !payload.password) delete payload.password;

      if (editing) {
        await api.updateUser(editing.id, payload);
        showToast('User & access permissions updated', 'success');
      } else {
        await api.createUser(payload);
        showToast('User account created!', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    try {
      await api.deleteUser(u.id);
      showToast('User deleted', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Users, Store Workers & Access Permissions</h2>
          <p className="card-subtitle">
            Assign workers to specific stores and control exactly which modules and actions each user can access
          </p>
        </div>
        <div className="toolbar-group">
          <div className="search-box">
            <IconSearch size={15} />
            <input className="input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={15} /> Add User / Worker
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Assigned Store</th>
              <th>Access Modules</th>
              <th>Status</th>
              <th>Last Login</th>
              <th style={{ width: 95 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="empty-state">Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No users found.</td></tr>
            ) : (
              users.map((u) => {
                const enabledCount =
                  u.role === 'super_admin' || u.role === 'admin'
                    ? PERM_LABELS.length
                    : PERM_LABELS.filter((p) => u.permissions?.[p.key]).length;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{u.email} {u.phone ? `· ${u.phone}` : ''}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'super_admin' || u.role === 'admin' ? 'badge-purple' : u.role === 'manager' ? 'badge-blue' : 'badge-slate'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{u.store_name || <span style={{ color: '#7c3aed', fontWeight: 600 }}>All Stores (Company)</span>}</td>
                    <td>
                      <span className="badge badge-cyan">{enabledCount} / {PERM_LABELS.length} permissions</span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-emerald' : 'badge-rose'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(u)} title="Edit Permissions">
                          <IconEdit size={14} />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button className="btn btn-ghost btn-icon" style={{ color: '#e11d48' }} onClick={() => deleteUser(u)}>
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing ? `Edit User: ${editing.name}` : 'Create User / Store Worker'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={saveUser}>
              <div className="modal-body">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input type="email" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">{editing ? 'New Password (leave blank to keep)' : 'Password * (min 6 chars)'}</label>
                    <input
                      type="password"
                      className="input"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      required={!editing}
                      minLength={editing ? undefined : 6}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role Preset</label>
                    <select className="select" value={form.role} onChange={(e) => handleRoleChange(e.target.value)}>
                      <option value="worker">Counter Worker</option>
                      <option value="manager">Store Manager</option>
                      <option value="admin">Company Admin (Full Access)</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned Store</label>
                    <select className="select" value={form.store_id} onChange={(e) => setForm((p) => ({ ...p, store_id: e.target.value }))}>
                      <option value="">Company-Wide (No single store)</option>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="form-label" style={{ marginBottom: 8 }}>Granular Access Permissions</div>
                  <div className="perm-grid">
                    {PERM_LABELS.map((p) => {
                      const lockedAdmin = form.role === 'admin' || form.role === 'super_admin';
                      return (
                        <label key={p.key} className="perm-check">
                          <input
                            type="checkbox"
                            checked={lockedAdmin ? true : Boolean(form.permissions[p.key])}
                            disabled={lockedAdmin}
                            onChange={() => togglePerm(p.key)}
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {editing && (
                  <label className="perm-check" style={{ width: 'fit-content' }}>
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                    Account Active (Can Sign In)
                  </label>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update User' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
