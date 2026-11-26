const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getToken() {
  return localStorage.getItem('sevadesk_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('sevadesk_token', token);
  else localStorage.removeItem('sevadesk_token');
}

function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      sp.append(k, String(v));
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : '';
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: isFormData ? options.body : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) {
      setToken('');
      window.dispatchEvent(new Event('sevadesk:unauthorized'));
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  // Auth
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),

  // Dashboard
  getDashboard: (params) => request(`/dashboard/summary${buildQuery(params)}`),

  // Stores
  getStores: () => request('/stores'),
  createStore: (body) => request('/stores', { method: 'POST', body }),
  updateStore: (id, body) => request(`/stores/${id}`, { method: 'PUT', body }),
  deleteStore: (id) => request(`/stores/${id}`, { method: 'DELETE' }),

  // Users
  getRolePresets: () => request('/users/presets'),
  getUsers: (params) => request(`/users${buildQuery(params)}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Services
  getServices: (params) => request(`/services${buildQuery(params)}`),
  createService: (body) => request('/services', { method: 'POST', body }),
  updateService: (id, body) => request(`/services/${id}`, { method: 'PUT', body }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

  // Wallets & Recharge Plans
  getWallets: (params) => request(`/wallets${buildQuery(params)}`),
  createWallet: (body) => request('/wallets', { method: 'POST', body }),
  updateWallet: (id, body) => request(`/wallets/${id}`, { method: 'PUT', body }),
  adjustWallet: (id, body) => request(`/wallets/${id}/adjust`, { method: 'POST', body }),
  deleteWallet: (id) => request(`/wallets/${id}`, { method: 'DELETE' }),
  getWalletLedger: (params) => request(`/wallets/ledger/list${buildQuery(params)}`),
  getRechargePlans: (params) => request(`/wallets/plans/list${buildQuery(params)}`),
  createRechargePlan: (body) => request('/wallets/plans', { method: 'POST', body }),
  updateRechargePlan: (planId, body) => request(`/wallets/plans/${planId}`, { method: 'PUT', body }),
  deleteRechargePlan: (planId) => request(`/wallets/plans/${planId}`, { method: 'DELETE' }),

  // Clients, Dynamic Customer Fields & Cloudinary Docs
  getClientFields: () => request('/clients/fields/list'),
  createClientField: (body) => request('/clients/fields', { method: 'POST', body }),
  updateClientField: (fieldId, body) => request(`/clients/fields/${fieldId}`, { method: 'PUT', body }),
  deleteClientField: (fieldId) => request(`/clients/fields/${fieldId}`, { method: 'DELETE' }),
  lookupClient: (phone) => request(`/clients/lookup${buildQuery({ phone })}`),
  getClients: (params) => request(`/clients${buildQuery(params)}`),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (body) => request('/clients', { method: 'POST', body }),
  updateClient: (id, body) => request(`/clients/${id}`, { method: 'PUT', body }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  uploadClientDoc: (clientId, formData) =>
    request(`/clients/${clientId}/documents`, { method: 'POST', body: formData }),
  deleteClientDoc: (clientId, docId) =>
    request(`/clients/${clientId}/documents/${docId}`, { method: 'DELETE' }),

  // Stock
  getStock: (params) => request(`/stock${buildQuery(params)}`),
  createStock: (formData) => request('/stock', { method: 'POST', body: formData }),
  updateStock: (id, formData) => request(`/stock/${id}`, { method: 'PUT', body: formData }),
  adjustStock: (id, body) => request(`/stock/${id}/adjust`, { method: 'POST', body }),
  deleteStock: (id) => request(`/stock/${id}`, { method: 'DELETE' }),
  getStockMovements: (params) => request(`/stock/movements/list${buildQuery(params)}`),

  // Sheet & Columns (Per-Store & Combined)
  getSheetColumns: (params) => request(`/sheet/columns${buildQuery(params)}`),
  createSheetColumn: (body) => request('/sheet/columns', { method: 'POST', body }),
  updateSheetColumn: (id, body) => request(`/sheet/columns/${id}`, { method: 'PUT', body }),
  reorderSheetColumns: (orderedIds, orderedKeys, sync_store_ids) =>
    request('/sheet/columns/reorder', { method: 'PUT', body: { orderedIds, orderedKeys, sync_store_ids } }),
  deleteSheetColumn: (id, params) => request(`/sheet/columns/${id}${buildQuery(params)}`, { method: 'DELETE' }),
  getSheetEntries: (params) => request(`/sheet/entries${buildQuery(params)}`),
  createSheetEntry: (body) => request('/sheet/entries', { method: 'POST', body }),
  updateSheetEntry: (id, body) => request(`/sheet/entries/${id}`, { method: 'PUT', body }),
  deleteSheetEntry: (id) => request(`/sheet/entries/${id}`, { method: 'DELETE' }),

  // Admin-Only Recharge Balance Sheet
  getAdminRechargeSheet: (params) => request(`/admin-recharge-sheet${buildQuery(params)}`),
  addAdminRechargeColumn: (body) => request('/admin-recharge-sheet/columns', { method: 'POST', body }),
  updateAdminRechargeColumn: (id, body) => request(`/admin-recharge-sheet/columns/${id}`, { method: 'PUT', body }),
  reorderAdminRechargeColumns: (orderedIds) =>
    request('/admin-recharge-sheet/columns/reorder', { method: 'PUT', body: { orderedIds } }),
  deleteAdminRechargeColumn: (id) => request(`/admin-recharge-sheet/columns/${id}`, { method: 'DELETE' }),
  addAdminRechargeRow: (body) => request('/admin-recharge-sheet/rows', { method: 'POST', body }),
  updateAdminRechargeRow: (id, body) => request(`/admin-recharge-sheet/rows/${id}`, { method: 'PUT', body }),
  deleteAdminRechargeRow: (id) => request(`/admin-recharge-sheet/rows/${id}`, { method: 'DELETE' }),

  // Activity Logs
  getActivityLogs: (params) => request(`/activity${buildQuery(params)}`),
};
