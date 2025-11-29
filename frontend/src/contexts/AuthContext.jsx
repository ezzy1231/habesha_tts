import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = 'habeshatts_auth_token';

const readStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authToken, setAuthTokenState] = useState(() => readStoredToken());
  const authTokenRef = useRef(authToken);

  const persistToken = useCallback((tokenValue) => {
    try {
      if (tokenValue) {
        localStorage.setItem(TOKEN_STORAGE_KEY, tokenValue);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {}
    authTokenRef.current = tokenValue || null;
    setAuthTokenState(tokenValue || null);
  }, []);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  const fetchMe = useCallback(async () => {
    setLoading(true);
    try {
      const token = authTokenRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/me`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setError(null);
      } else if (res.status === 401) {
        persistToken(null);
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
  }, [persistToken]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = async () => {
    try {
      const token = authTokenRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/logout`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {}
    persistToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    logout,
    refresh: fetchMe,
    isAuthenticated: !!user,
    authToken,
    setAuthToken: persistToken,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
