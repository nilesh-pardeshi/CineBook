import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('cb:unauthorized', logout);
    return () => window.removeEventListener('cb:unauthorized', logout);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      logout,
      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        tokenStore.set(res.access_token);
        setUser(res.user);
        return res.user;
      },
      register: async (data) => {
        const res = await api.post('/auth/register', data);
        tokenStore.set(res.access_token);
        setUser(res.user);
        return res.user;
      },
    }),
    [user, loading, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
