import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../utils/format';
import { IconSearch } from '../components/Icons';

function classifyAction(action = '') {
  if (action === 'LOGIN') return { label: 'Login', badge: 'badge-emerald' };
  if (action === 'LOGOUT') return { label: 'Logout', badge: 'badge-slate' };
  if (action.startsWith('CREATE') || action.includes('ADD')) return { label: 'Data Entered', badge: 'badge-blue' };
  if (action.startsWith('UPDATE') || action.includes('EDIT') || action.includes('ADJUST') || action.includes('RESTOCK')) {
    return { label: 'Edit Made', badge: 'badge-amber' };
  }
  if (action.startsWith('DELETE') || action.startsWith('HIDE')) return { label: 'Removed / Hidden', badge: 'badge-rose' };
  return { label: action, badge: 'badge-purple' };
}

function renderStructuredDetails(details) {
  if (!details || typeof details !== 'object') return '—';
  const items = [];

  for (const [k, v] of Object.entries(details)) {
    if (v === null || v === undefined || v === '') continue;
    if (k === 'edited' && typeof v === 'object') {
      for (const [ek, ev] of Object.entries(v)) {
        items.push(
          <span key={`ed-${ek}`} className="badge badge-amber" style={{ fontSize: 11.5 }}>
            {ek}: {String(ev)}
          </span>
        );
      }
    } else if (typeof v === 'object') {
      items.push(
        <span key={k} className="badge badge-slate" style={{ fontSize: 11.5 }}>
          {k}: {JSON.stringify(v)}
        </span>
      );
    } else {
      items.push(
        <span key={k} className="badge badge-slate" style={{ fontSize: 11.5 }}>
          {k}: <strong>{String(v)}</strong>
        </span>
      );
    }
  }

  if (items.length === 0) return '—';
  return <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{items}</div>;
}

export default function ActivityLogsPage() {
  const { selectedStoreId } = useAuth();
  const { showToast } = useToast();

  const [usersSummary, setUsersSummary] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState('all');
  const [actionGroup, setActionGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getActivityLogs({
        store_id: selectedStoreId,
        user_id: selectedUserId,
        action_group: actionGroup === 'all' ? '' : actionGroup,
        search,
        date_from: dateFrom,
        date_to: dateTo,
        limit: 250,
      });
      setLogs(res.logs || []);
      setUsersSummary(res.users_summary || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, selectedUserId, actionGroup, search, dateFrom, dateTo, showToast]);

  useEffect(() => {
    const t = setTimeout(loadLogs, 150);
    return () => clearTimeout(t);
  }, [loadLogs]);

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>User Activity Logs — Login, Logout, Data Entered & Edits</h2>
          <p className="card-subtitle">
            Click any user below to see their exact login time, logout time, entered rows, and edits made
          </p>
        </div>
      </div>

      {/* Per-User Login / Logout / Entries / Edits Summary Table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">Users Session & Activity Summary</div>
          {selectedUserId !== 'all' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUserId('all')}>
              Show All Users
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Store</th>
                <th>Last Login Time</th>
                <th>Last Logout Time</th>
                <th className="num-cell">Data Entered</th>
                <th className="num-cell">Edits Made</th>
                <th className="num-cell">Total Events</th>
              </tr>
            </thead>
            <tbody>
              {usersSummary.map((u) => {
                const isSelected = String(selectedUserId) === String(u.id);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(isSelected ? 'all' : String(u.id))}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : undefined,
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{u.email} · {u.role.replace('_', ' ')}</div>
                    </td>
                    <td>{u.store_name || 'All Stores'}</td>
                    <td style={{ fontSize: 12.5, color: '#059669', fontWeight: 600 }}>
                      {u.last_login_at ? formatDateTime(u.last_login_at) : '—'}
                    </td>
                    <td style={{ fontSize: 12.5, color: '#475569', fontWeight: 500 }}>
                      {u.last_logout_at ? formatDateTime(u.last_logout_at) : 'Active / Not Logged Out'}
                    </td>
                    <td className="num-cell"><span className="badge badge-blue">{u.entries_added}</span></td>
                    <td className="num-cell"><span className="badge badge-amber">{u.edits_made}</span></td>
                    <td className="num-cell" style={{ fontWeight: 700 }}>{u.total_actions}</td>
                  </tr>
                );
              })}
              {usersSummary.length === 0 && (
                <tr><td colSpan={7} className="empty-state">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Tabs & Search for Detailed Row-by-Row Log */}
      <div className="tabs">
        <button className={`tab-btn ${actionGroup === 'all' ? 'active' : ''}`} onClick={() => setActionGroup('all')}>All Rows</button>
        <button className={`tab-btn ${actionGroup === 'sessions' ? 'active' : ''}`} onClick={() => setActionGroup('sessions')}>Login / Logout</button>
        <button className={`tab-btn ${actionGroup === 'entries' ? 'active' : ''}`} onClick={() => setActionGroup('entries')}>Data Entered</button>
        <button className={`tab-btn ${actionGroup === 'edits' ? 'active' : ''}`} onClick={() => setActionGroup('edits')}>Edits Made</button>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <div className="search-box" style={{ minWidth: 240 }}>
            <IconSearch size={14} />
            <input
              className="input"
              placeholder="Search user, action, row data..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 175 }} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="all">All Users</option>
            {usersSummary.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="input" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <span className="badge badge-slate" style={{ padding: '6px 11px' }}>{logs.length} Row(s)</span>
      </div>

      {/* Each Row = One Structured Data Event */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 170 }}>Date & Time</th>
              <th>User</th>
              <th>Store</th>
              <th>Type</th>
              <th>Action</th>
              <th>Data Entered / Edits Made</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">Loading activity rows...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No activity rows match your filter.</td></tr>
            ) : (
              logs.map((log) => {
                const meta = classifyAction(log.action);
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12.5, whiteSpace: 'nowrap', fontWeight: 500 }}>{formatDateTime(log.created_at)}</td>
                    <td style={{ fontWeight: 700 }}>{log.user_name}</td>
                    <td>{log.store_name || 'Company'}</td>
                    <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                    <td style={{ fontSize: 12, color: '#475569' }}>{log.action}</td>
                    <td style={{ maxWidth: 460 }}>{renderStructuredDetails(log.details)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
