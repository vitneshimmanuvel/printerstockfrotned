import { useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SheetPage from './pages/SheetPage';
import ServicesPage from './pages/ServicesPage';
import ClientsPage from './pages/ClientsPage';
import StoresPage from './pages/StoresPage';
import UsersPage from './pages/UsersPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import AdminRechargeSheet from './components/AdminRechargeSheet';
import {
  IconActivity,
  IconClients,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconServices,
  IconSheet,
  IconShield,
  IconStore,
} from './components/Icons';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', perm: 'dashboard', section: 'Operations', Icon: IconDashboard },
  { id: 'sheet', label: 'Live Sheet', perm: 'sheet', section: 'Operations', Icon: IconSheet },
  { id: 'services', label: 'Services Builder', perm: 'services', section: 'Operations', Icon: IconServices },
  { id: 'clients', label: 'Customer Details', perm: 'clients', section: 'Operations', Icon: IconClients },
  { id: 'stores', label: 'Stores / Branches', perm: 'stores', section: 'Company & Admin', Icon: IconStore },
  { id: 'users', label: 'Users & Access', perm: 'users', section: 'Company & Admin', Icon: IconShield },
  { id: 'activity', label: 'Activity Logs', perm: 'activity_logs', section: 'Company & Admin', Icon: IconActivity },
];

export default function App() {
  const { user, stores, selectedStoreId, setSelectedStoreId, loading, isAdmin, hasPerm, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

  const allowedNav = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.id === 'stores') return hasPerm('stores') || hasPerm('stock');
        return hasPerm(item.perm);
      }),
    [hasPerm]
  );

  if (loading) {
    return (
      <div className="login-page">
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Loading SevaDesk Pro...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const currentNav = allowedNav.find((n) => n.id === activePage) || allowedNav[0] || NAV_ITEMS[0];
  const activeKey = currentNav.id;

  const opsItems = allowedNav.filter((i) => i.section === 'Operations');
  const adminItems = allowedNav.filter((i) => i.section === 'Company & Admin');

  const navigate = (id) => {
    setActivePage(id);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activeKey) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'sheet':
        return <SheetPage />;
      case 'services':
        return <ServicesPage />;
      case 'clients':
        return <ClientsPage />;
      case 'stores':
        return <StoresPage />;
      case 'users':
        return <UsersPage />;
      case 'activity':
        return <ActivityLogsPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  const canSwitchAllStores = hasPerm('view_all_stores');

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 25 }}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">SD</div>
          <div>
            <div className="brand-title">SevaDesk Pro</div>
            <div className="brand-sub">Multi-Store e-Seva Suite</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {opsItems.length > 0 && <div className="nav-section-label">Operations</div>}
          {opsItems.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeKey === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {adminItems.length > 0 && <div className="nav-section-label">Company & Admin</div>}
          {adminItems.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeKey === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{(user.name || 'U').slice(0, 1).toUpperCase()}</div>
            <div className="user-meta">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role.replace('_', ' ')}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ color: '#94a3b8' }}
            onClick={logout}
            title="Sign Out"
          >
            <IconLogout size={17} />
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen((v) => !v)}>
              <IconMenu size={18} />
            </button>
            <h1 className="page-title">{currentNav.label}</h1>
          </div>

          {activeKey === 'sheet' && (
            <div className="topbar-right">
              {isAdmin && (
                <button
                  type="button"
                  className="topbar-sheet-btn"
                  onClick={() => setRechargeModalOpen(true)}
                  title="Open Admin Recharge Balance Sheet"
                >
                  <IconShield size={14} />
                  <span>Sheet Settings · Recharge Sheet</span>
                </button>
              )}

              <div className="store-switcher">
                <IconStore size={15} />
                {canSwitchAllStores ? (
                  <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
                    <option value="all">All Store Sheets</option>
                    {stores.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontWeight: 600 }}>{user.store_name || 'Assigned Store'}</span>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="page-content">{renderPage()}</main>
      </div>

      {isAdmin && (
        <AdminRechargeSheet
          open={rechargeModalOpen}
          onClose={() => setRechargeModalOpen(false)}
        />
      )}
    </div>
  );
}
