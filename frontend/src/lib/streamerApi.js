import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, ApiError } from './publicApi';

export function readApiKey(uuid) {
  try {
    return localStorage.getItem(`apiKey_${uuid}`);
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch for the streamer dashboard. Sends the login token when there is one,
 * otherwise the API key saved by the dashboard's key prompt; the login cookie rides along too.
 *   const call = useStreamerApi(uuid);
 *   await call(`/v1/streamer/${uuid}/settings`, { method: 'PUT', json: {...} });
 */
export function useStreamerApi(uuid) {
  const { authToken } = useAuth();
  return useCallback(
    async (path, { method = 'GET', json, body, headers = {}, signal } = {}) => {
      const apiKey = readApiKey(uuid);
      const credentials = [authToken, apiKey].filter(Boolean);
      const send = (cred) => {
        const h = { ...headers };
        if (cred) h.Authorization = `Bearer ${cred}`;
        if (json !== undefined) h['Content-Type'] = 'application/json';
        return fetch(`${API_URL}${path}`, {
          method,
          headers: h,
          body: json !== undefined ? JSON.stringify(json) : body,
          credentials: 'include',
          signal,
        });
      };
      let res;
      try {
        res = await send(credentials[0]);
        // A stale login token should not lock out a streamer who also has a valid API key.
        if ((res.status === 401 || res.status === 403) && credentials[1]) res = await send(credentials[1]);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new ApiError('Network error. Check your connection and try again.', 0);
      }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(out.error || `Request failed (${res.status})`, res.status);
      return out;
    },
    [authToken, uuid],
  );
}
