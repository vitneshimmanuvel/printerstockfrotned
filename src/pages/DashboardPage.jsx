import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDateTime, formatINR, formatNum } from '../utils/format';

export default function DashboardPage({ onNavigate }) {
  const { selectedStoreId, setSelectedStoreId, hasPerm } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard({
        store_id: selectedStoreId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, dateFrom, dateTo, showToast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return <div className="empty-state">Loading company & store dashboard...</div>;
  }

  const kpis = data?.kpis || {};
  const stores = data?.stores || [];
  const services = data?.services || [];
  const stockShowcase = data?.stock_showcase || [];
  const activity = data?.recent_activity || [];

  const lowStockItems = stockShowcase.filter((i) => i.stock_status !== 'in_stock');

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {selectedStoreId === 'all' ? 'Company Overview (All Stores)' : 'Store Performance Dashboard'}
          </h2>
          <p className="card-subtitle">Revenue, profit, store comparison, low-stock overview across branches & recent activity</p>
        </div>

        <div className="toolbar-group">
          <input
            type="date"
            className="input"
            style={{ width: 150 }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From Date"
          />
          <input
            type="date"
            className="input"
            style={{ width: 150 }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To Date"
          />
          {(dateFrom || dateTo) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-emerald">
          <div className="kpi-label">
            <span>Net Profit</span>
            <span className="badge badge-emerald">Today: {formatINR(kpis.today_profit)}</span>
          </div>
          <div className="kpi-value">{formatINR(kpis.total_profit)}</div>
          <div className="kpi-sub">
            Shop Charges {formatINR(kpis.total_charges)} − Internal Tax {formatINR(kpis.total_internal_tax)}
          </div>
        </div>

        <div className="kpi-card kpi-blue">
          <div className="kpi-label">
            <span>Customer Collections</span>
            <span className="badge badge-blue">{formatNum(kpis.total_entries)} txns</span>
          </div>
          <div className="kpi-value">{formatINR(kpis.total_collected)}</div>
          <div className="kpi-sub">
            Principal Volume: {formatINR(kpis.total_volume)} · Today: {formatINR(kpis.today_collected)}
          </div>
        </div>

        <div className="kpi-card kpi-rose">
          <div className="kpi-label">
            <span>Less Stock Alerts</span>
            <span className={`badge ${lowStockItems.length > 0 ? 'badge-rose' : 'badge-emerald'}`}>
              {lowStockItems.length > 0 ? 'Needs Restock' : 'All Healthy'}
            </span>
          </div>
          <div className="kpi-value">{lowStockItems.length}</div>
          <div className="kpi-sub">Low or out-of-stock items across stores</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Customers & Assets</span>
            <span className="badge badge-purple">+{formatNum(kpis.new_today)} today</span>
          </div>
          <div className="kpi-value">{formatNum(kpis.total_clients)}</div>
          <div className="kpi-sub">{formatNum(kpis.total_documents)} Cloudinary assets stored</div>
        </div>
      </div>

      {/* Low Stock / Less Stock Overview by Store (Prominent!) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Stocks Overview — Less Stock & Branch Status</div>
            <div className="card-subtitle">
              {lowStockItems.length > 0
                ? `${lowStockItems.length} item(s) are running low or out of stock — showing exact branch below`
                : 'All stock items across stores are above minimum threshold'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('stores')}>
            Open Stores & Stock →
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Store / Branch</th>
                <th>Stock Item</th>
                <th>Category</th>
                <th className="num-cell">Current Qty</th>
                <th className="num-cell">Min Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(lowStockItems.length > 0 ? lowStockItems : stockShowcase).map((item) => (
                <tr
                  key={item.id}
                  style={{
                    background:
                      item.stock_status === 'out_of_stock'
                        ? 'var(--rose-soft)'
                        : item.stock_status === 'low_stock'
                          ? 'var(--amber-soft)'
                          : undefined,
                  }}
                >
                  <td>
                    <span className="badge badge-blue">{item.store_name}</span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td>{item.category}</td>
                  <td className="num-cell" style={{ fontWeight: 700, color: item.stock_status === 'out_of_stock' ? '#e11d48' : item.stock_status === 'low_stock' ? '#d97706' : '#059669' }}>
                    {formatNum(item.quantity)} {item.unit}
                  </td>
                  <td className="num-cell">{formatNum(item.min_threshold)} {item.unit}</td>
                  <td>
                    <span
                      className={`badge ${
                        item.stock_status === 'out_of_stock'
                          ? 'badge-rose'
                          : item.stock_status === 'low_stock'
                            ? 'badge-amber'
                            : 'badge-emerald'
                      }`}
                    >
                      {item.stock_status === 'out_of_stock' ? 'Out of Stock' : item.stock_status === 'low_stock' ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
              {stockShowcase.length === 0 && (
                <tr><td colSpan={6} className="empty-state">No stock items configured yet. Open any Store to add stock.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store-by-Store Totals + Top Services */}
      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Store-by-Store Totals</div>
              <div className="card-subtitle">Click a store to filter dashboard metrics</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('stores')}>
              Manage Stores
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Workers</th>
                  <th>Clients</th>
                  <th>Less Stock</th>
                  <th className="num-cell">Collected</th>
                  <th className="num-cell">Profit</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr
                    key={s.id}
                    style={{ cursor: hasPerm('view_all_stores') ? 'pointer' : 'default' }}
                    onClick={() => hasPerm('view_all_stores') && setSelectedStoreId(String(s.id))}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.code}</div>
                    </td>
                    <td>{s.worker_count}</td>
                    <td>{s.client_count}</td>
                    <td>
                      <span className={`badge ${Number(s.low_stock_count) > 0 ? 'badge-rose' : 'badge-emerald'}`}>
                        {s.low_stock_count} low
                      </span>
                    </td>
                    <td className="num-cell">{formatINR(s.collected)}</td>
                    <td className="num-cell" style={{ color: '#059669', fontWeight: 700 }}>{formatINR(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Services & Recent Activity</div>
            {hasPerm('activity_logs') && (
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('activity')}>
                Full Activity Logs
              </button>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 330, overflowY: 'auto' }}>
            {services.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                {services.slice(0, 5).map((sv, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 9px', background: 'var(--surface-subtle)', borderRadius: 7 }}>
                    <span style={{ fontWeight: 600 }}>{sv.service_name} ({sv.count})</span>
                    <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>{formatINR(sv.profit)}</span>
                  </div>
                ))}
              </div>
            )}
            {activity.map((log) => (
              <div key={log.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{log.user_name}</span>
                  <span className="badge badge-slate">{log.action}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {log.store_name ? `${log.store_name} · ` : ''}{formatDateTime(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
