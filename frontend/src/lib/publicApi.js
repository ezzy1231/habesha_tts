// Calls to the public (no-login) API used by the directory, donate and return pages.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  return json;
}

export const publicApi = {
  streamers: (opts) => request('/public/streamers', opts).then((r) => r.streamers || []),
  streamer: (slug, opts) => request(`/public/streamers/${encodeURIComponent(slug)}`, opts).then((r) => r.streamer),
  checkout: (body) => request('/public/checkout', { method: 'POST', body }),
  payment: (txRef, opts) => request(`/public/payments/${encodeURIComponent(txRef)}`, opts),
  checkCredit: (code) => request('/public/credit/check', { method: 'POST', body: { code } }),
};

/** Same formula as backend/utils/pricing.js, so the page shows the price the server will charge. */
export const messageLength = (text) => Array.from(String(text ?? '')).length;

export function priceForTts(text, tts) {
  if (!tts) return 0;
  const steps = Math.max(1, Math.ceil(messageLength(text) / Math.max(1, tts.stepChars)));
  const price = tts.basePrice + (steps - 1) * tts.incrementPrice;
  return Math.max(price, Number(tts.minAmount) || 0);
}

/** Mirrors backend/services/payments.js chargeAmount for USD display. */
export function usdFor(etb, rate) {
  if (!rate || !(etb > 0)) return null;
  return Math.max(1, Math.ceil((etb / rate) * 100) / 100);
}

/** Rough client-side check; the server parses the link again. */
export function looksLikeYouTube(url) {
  return /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(String(url || '').trim());
}
export const CLAIM_KEY = 'habesha.claimCode';
