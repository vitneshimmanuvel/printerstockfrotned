import { useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
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
  IconClose,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconPin,
  IconServices,
  IconSheet,
  IconShield,
  IconStore,
  IconSun,
} from './components/Icons';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', perm: 'dashboard', section: 'Operations', Icon: IconDashboard },
  { id: 'sheet', label: 'Live Sheet', perm: 'sheet', section: 'Operations', Icon: IconSheet },
  { id: 'services', label: 'Services Builder', perm: 'services', section: 'Operations', Icon: IconServices },
  { id: 'clients', label: 'Customer Details', perm: 'clients', section: 'Operations', Icon: IconClients },
  { id: 'stores', label: 'Stores', perm: 'stores', section: 'Company & Admin', Icon: IconStore },
  { id: 'users', label: 'Users & Access', perm: 'users', section: 'Company & Admin', Icon: IconShield },
  { id: 'activity', label: 'Activity Logs', perm: 'activity_logs', section: 'Company & Admin', Icon: IconActivity },
];

export default function App() {
  const { user, stores, selectedStoreId, setSelectedStoreId, loading, isAdmin, hasPerm, logout } = useAuth();
  const { themeMode, setThemeMode, cycleTheme } = useTheme();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  const [sidebarPinned, setSidebarPinned] = useState(false); // Desktop: false = collapsed icon rail, stretches on hover!
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
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Loading Sterling Enterprises...</div>
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

  const ActiveThemeIcon = themeMode === 'dark' ? IconMoon : themeMode === 'light' ? IconSun : IconMonitor;

  return (
    <div className={`app-shell ${sidebarPinned ? 'sidebar-pinned' : 'sidebar-hover-mode'}`}>
      {sidebarOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarPinned ? 'pinned' : 'collapsible'} ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">SE</div>
          <div className="sidebar-reveal" style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">Sterling Enterprises</div>
            <div className="brand-sub">Internal System</div>
          </div>

          {/* Desktop Pin/Unpin Toggle */}
          <button
            type="button"
            className={`sidebar-pin-btn sidebar-reveal ${sidebarPinned ? 'active' : ''}`}
            onClick={() => setSidebarPinned((v) => !v)}
            title={sidebarPinned ? 'Unpin (auto-collapse & stretch on hover)' : 'Pin sidebar open'}
          >
            <IconPin size={14} />
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setSidebarOpen(false)}
            title="Close Menu"
          >
            <IconClose size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {opsItems.length > 0 && <div className="nav-section-label sidebar-reveal">Operations</div>}
          {opsItems.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeKey === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                title={item.label}
              >
                <span className="nav-icon-slot"><Icon size={18} /></span>
                <span className="nav-item-text sidebar-reveal">{item.label}</span>
              </button>
            );
          })}

          {adminItems.length > 0 && <div className="nav-section-label sidebar-reveal">Company & Admin</div>}
          {adminItems.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeKey === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                title={item.label}
              >
                <span className="nav-icon-slot"><Icon size={18} /></span>
                <span className="nav-item-text sidebar-reveal">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System Theme Switcher (Light / System / Dark) */}
        <div className="sidebar-theme-box">
          <button
            type="button"
            className="theme-compact-btn"
            onClick={cycleTheme}
            title={`Theme: ${themeMode} (click to switch)`}
          >
            <ActiveThemeIcon size={16} />
          </button>

          <div className="theme-segmented sidebar-reveal" role="group" aria-label="Theme mode">
            <button
              type="button"
              className={`theme-seg-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => setThemeMode('light')}
              title="Light Mode"
            >
              <IconSun size={13} /> Light
            </button>
            <button
              type="button"
              className={`theme-seg-btn ${themeMode === 'system' ? 'active' : ''}`}
              onClick={() => setThemeMode('system')}
              title="System Default"
            >
              <IconMonitor size={13} /> Auto
            </button>
            <button
              type="button"
              className={`theme-seg-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => setThemeMode('dark')}
              title="Dark Mode"
            >
              <IconMoon size={13} /> Dark
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{(user.name || 'U').slice(0, 1).toUpperCase()}</div>
            <div className="user-meta sidebar-reveal">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role.replace('_', ' ')}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon sidebar-reveal"
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
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle Menu">
              <IconMenu size={19} />
            </button>
            <h1 className="page-title">{currentNav.label}</h1>
          </div>

          <div className="topbar-right">
            {activeKey === 'sheet' && (
              <>
                {isAdmin && (
                  <button
                    type="button"
                    className="topbar-sheet-btn"
                    onClick={() => setRechargeModalOpen(true)}
                    title="Open Admin Recharge Balance Sheet"
                  >
                    <IconShield size={14} />
                    <span className="topbar-btn-label">Sheet Settings · Recharge Sheet</span>
                    <span className="topbar-btn-short">Recharge</span>
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
              </>
            )}

            {/* Quick Theme Toggle Button on Mobile Topbar */}
            <button
              type="button"
              className="mobile-theme-btn"
              onClick={cycleTheme}
              title={`Theme: ${themeMode}`}
              aria-label="Switch Theme"
            >
              <ActiveThemeIcon size={17} />
            </button>
          </div>
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
