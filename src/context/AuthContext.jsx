import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [loading, setLoading] = useState(true);

  const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin');

  const hasPerm = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === 'super_admin' || user.role === 'admin') return true;
      return Boolean(user.permissions && user.permissions[perm]);
    },
    [user]
  );

  const loadStores = useCallback(async (u) => {
    try {
      const data = await api.getStores();
      const list = data.stores || [];
      setStores(list);
      const canViewAll = u.role === 'super_admin' || u.role === 'admin' || Boolean(u.permissions?.view_all_stores);
      if (canViewAll) {
        setSelectedStoreId((prev) => prev || 'all');
      } else {
        setSelectedStoreId(u.store_id ? String(u.store_id) : (list[0] ? String(list[0].id) : 'all'));
      }
    } catch {
      setStores([]);
    }
  }, []);

  const refreshStores = useCallback(async () => {
    if (user) await loadStores(user);
  }, [user, loadStores]);

  useEffect(() => {
    const boot = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.me();
        setUser(me);
        await loadStores(me);
      } catch {
        setToken('');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    boot();

    const onUnauthorized = () => {
      setUser(null);
      setStores([]);
    };
    window.addEventListener('sevadesk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sevadesk:unauthorized', onUnauthorized);
  }, [loadStores]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setUser(res.user);
    await loadStores(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      if (getToken()) await api.logout();
    } catch {
      // still clear session locally even if server offline
    }
    setToken('');
    setUser(null);
    setStores([]);
    setSelectedStoreId('all');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        stores,
        selectedStoreId,
        setSelectedStoreId,
        refreshStores,
        loading,
        isAdmin,
        hasPerm,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
