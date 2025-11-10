import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setError(null);
      } else if (res.status === 401) {
        setUser(null);
      } else {
        setError('Failed to load session');
      }
    } catch (e) {
      setError('Network error');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
  };

  const value = { user, loading, error, logout, refresh: fetchMe, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
