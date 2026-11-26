// Website account (signed in through the Telegram bot): /api/v1/account/*
import { useCallback, useEffect, useState } from 'react';
import { API_URL, ApiError } from './publicApi';

const TOKEN_KEY = 'habesha.accountToken';
const CHANGE_EVENT = 'habesha:account-changed';

export const getAccountToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
};

export function setAccountToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = getAccountToken();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_URL}/v1/account${path}`, {
      method, signal, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && token) setAccountToken(null); // expired session
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  return json;
}

export const accountApi = {
  startLogin: () => request('/login/start', { method: 'POST' }),
  loginStatus: (nonce) => request('/login/status', { method: 'POST', body: { nonce } }),
  verifyLogin: (nonce, code) => request('/login/verify', { method: 'POST', body: { nonce, code } }),
  me: (opts) => request('/me', opts),
  registerDonor: (displayName) => request('/register/donor', { method: 'POST', body: { displayName } }),
  registerStreamer: (body) => request('/register/streamer', { method: 'POST', body }),
  changeName: (displayName) => request('/me/name', { method: 'PUT', body: { displayName } }),
  complaint: (text) => request('/complaints', { method: 'POST', body: { text } }),
  topup: (amount, provider) => request('/topup', { method: 'POST', body: { amount, provider } }),
};

/** Read a File as bare base64 (no data: prefix). */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Could not read the file'));
  reader.readAsDataURL(file);
});

/**
 * Current account for any page. `account` is null when signed out, undefined while loading.
 * Pages that change the account call `refresh()`; signing in/out anywhere updates every user of the hook.
 */
export function useAccount() {
  const [state, setState] = useState(() => ({ account: getAccountToken() ? undefined : null, topup: null, error: null }));

  const refresh = useCallback(async (signal) => {
    if (!getAccountToken()) {
      setState({ account: null, topup: null, error: null });
      return;
    }
    try {
      const r = await accountApi.me({ signal });
      setState({ account: r.account, topup: r.topup, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ account: getAccountToken() ? undefined : null, topup: null, error });
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    const onChange = () => refresh();
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      ctrl.abort();
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [refresh]);

  const signOut = useCallback(() => setAccountToken(null), []);
  return { ...state, refresh, signOut };
}
