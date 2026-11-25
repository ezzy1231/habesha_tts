// Chapa (https://developer.chapa.co). Every payment is confirmed with the verify endpoint;
// redirects and webhooks only tell us *when* to verify.
import crypto from 'crypto';
import { requestJson, ProviderError, pickRaw } from './http.js';

const API = process.env.CHAPA_API_URL || 'https://api.chapa.co/v1';
const secret = () => process.env.CHAPA_SECRET_KEY || '';

export const name = 'chapa';
export const label = 'Chapa';
export const currencies = ['ETB', 'USD'];
export const isConfigured = () => Boolean(secret());

// Chapa limits customization text; keep to letters, digits, spaces and . - _
const clean = (s, max) => String(s || '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, max).trim();

export async function createCheckout({ txRef, amount, currency, donorName, returnUrl, callbackUrl, description }) {
  const [first, ...rest] = clean(donorName, 40).split(' ');
  const { ok, status, json } = await requestJson(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}` },
    body: {
      amount: Number(amount).toFixed(2),
      currency,
      tx_ref: txRef,
      first_name: first || 'Supporter',
      last_name: rest.join(' ') || undefined,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: { title: 'Habesha TTS', description: clean(description, 50) || 'Donation' },
    },
  });
  const checkoutUrl = json?.data?.checkout_url;
  if (!ok || json?.status !== 'success' || !checkoutUrl) {
    throw new ProviderError(`Chapa initialize failed (${status}): ${json?.message ? JSON.stringify(json.message) : 'no checkout_url'}`, { status, body: json });
  }
  return { checkoutUrl, providerRef: txRef };
}

/** @returns {{status: 'paid'|'pending'|'failed', amount?: number, currency?: string, raw: object}} */
export async function verify(payment) {
  const { status, json } = await requestJson(`${API}/transaction/verify/${encodeURIComponent(payment.tx_ref)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const d = json?.data || {};
  const raw = { http: status, ...pickRaw(d, ['status', 'amount', 'currency', 'tx_ref', 'reference', 'method', 'charge', 'created_at']) };
  if (status === 404 || json?.status !== 'success') return { status: 'pending', raw };
  const s = String(d.status || '').toLowerCase();
  if (s === 'success') {
    const sameTx = d.tx_ref === payment.tx_ref;
    const sameCurrency = String(d.currency || '').toUpperCase() === String(payment.currency).trim().toUpperCase();
    const enough = Number(d.amount) + 0.001 >= Number(payment.amount);
    if (!sameTx || !sameCurrency || !enough) {
      return { status: 'failed', raw: { ...raw, mismatch: { sameTx, sameCurrency, enough } } };
    }
    return { status: 'paid', amount: Number(d.amount), currency: d.currency, raw };
  }
  if (['failed', 'cancelled', 'canceled', 'reversed', 'refunded'].includes(s)) return { status: 'failed', raw };
  return { status: 'pending', raw };
}

/**
 * Webhook authenticity (HMAC-SHA256 with the webhook secret). We still verify with the API
 * before fulfilling, so this only filters noise.
 */
export function verifyWebhook({ rawBody, headers }) {
  const key = process.env.CHAPA_WEBHOOK_SECRET || '';
  if (!key) return false;
  const sigs = [headers['x-chapa-signature'], headers['chapa-signature']].filter(Boolean).map(String);
  if (!sigs.length) return false;
  const candidates = [rawBody];
  try { candidates.push(Buffer.from(JSON.stringify(JSON.parse(rawBody.toString('utf8'))))); } catch { /* not JSON */ }
  const expected = candidates.map((buf) => crypto.createHmac('sha256', key).update(buf).digest('hex'));
  return sigs.some((sig) => expected.some((exp) => sig.length === exp.length
    && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))));
}

export const txRefFromWebhook = (body) => body?.tx_ref || body?.trx_ref || null;
