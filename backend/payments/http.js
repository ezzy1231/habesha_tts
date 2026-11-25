// Small JSON-over-HTTPS helper for payment providers (Node 18+ fetch), with a timeout.
export class ProviderError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.body = body;
  }
}

export async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 500) }; }
    return { status: res.status, ok: res.ok, json };
  } catch (error) {
    throw new ProviderError(error.name === 'AbortError' ? 'Provider timed out' : `Provider unreachable: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Only keep what we need from a provider response in our database (no card data, no secrets). */
export function pickRaw(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}
