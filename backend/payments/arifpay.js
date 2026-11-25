// Arifpay checkout sessions. Endpoints as in Arifpay's official SDK (Arifpay-net/phpsdk):
//   POST {host}/v0[/sandbox]/checkout/session        header x-arifpay-key
//   GET  {host}/v0[/sandbox]/checkout/session/{id}
// Payment is confirmed by fetching the session, never from the redirect or notify call.
import { requestJson, ProviderError, pickRaw } from './http.js';

const HOST = () => (process.env.ARIFPAY_BASE_URL || 'https://gateway.arifpay.net').replace(/\/$/, '');
const BASE = () => `${HOST()}/v0${String(process.env.ARIFPAY_SANDBOX).toLowerCase() === 'true' ? '/sandbox' : ''}`;
const key = () => process.env.ARIFPAY_API_KEY || '';

export const name = 'arifpay';
export const label = 'Arifpay';
export const currencies = ['ETB'];
// Arifpay pays out to a beneficiary account, which must be set with the key.
export const isConfigured = () => Boolean(key() && process.env.ARIFPAY_BENEFICIARY_ACCOUNT && process.env.ARIFPAY_BENEFICIARY_BANK);

const methods = () => (process.env.ARIFPAY_PAYMENT_METHODS || 'TELEBIRR,CBE,AWASH,AMOLE,CARD')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Arifpay expects a local ISO timestamp without a zone, e.g. 2023-01-13T17:09:42.411
const expireDate = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString().replace('Z', '');

export async function createCheckout({ txRef, amount, returnUrl, cancelUrl, callbackUrl, description, phone }) {
  const price = Number(Number(amount).toFixed(2));
  const { ok, status, json } = await requestJson(`${BASE()}/checkout/session`, {
    method: 'POST',
    headers: { 'x-arifpay-key': key() },
    body: {
      cancelUrl: cancelUrl || returnUrl,
      errorUrl: cancelUrl || returnUrl,
      successUrl: returnUrl,
      notifyUrl: callbackUrl,
      nonce: txRef,
      expireDate: expireDate(60),
      paymentMethods: methods(),
      ...(phone ? { phone } : {}),
      items: [{ name: String(description || 'Donation').slice(0, 60), quantity: 1, price, description: 'Habesha TTS' }],
      beneficiaries: [{
        accountNumber: process.env.ARIFPAY_BENEFICIARY_ACCOUNT,
        bank: process.env.ARIFPAY_BENEFICIARY_BANK,
        amount: price,
      }],
      lang: 'EN',
    },
  });
  const data = json?.data || {};
  if (!ok || !data.paymentUrl || !data.sessionId) {
    throw new ProviderError(`Arifpay checkout failed (${status}): ${json?.msg || json?.message || 'no paymentUrl'}`, { status, body: json });
  }
  return { checkoutUrl: data.paymentUrl, providerRef: String(data.sessionId) };
}

export async function verify(payment) {
  if (!payment.provider_ref) return { status: 'pending', raw: { note: 'no session id' } };
  const { status, json } = await requestJson(`${BASE()}/checkout/session/${encodeURIComponent(payment.provider_ref)}`, {
    headers: { 'x-arifpay-key': key() },
  });
  const d = json?.data || {};
  const tx = d.transaction || {};
  const raw = { http: status, ...pickRaw(d, ['id', 'totalAmount', 'test', 'uuid']), transaction: pickRaw(tx, ['transactionId', 'transactionStatus', 'paymentType']) };
  if (!json || status >= 400) return { status: 'pending', raw };
  const s = String(tx.transactionStatus || '').toUpperCase();
  if (s === 'SUCCESS' || s === 'COMPLETED') {
    const enough = Number(d.totalAmount) + 0.001 >= Number(payment.amount);
    if (!enough) return { status: 'failed', raw: { ...raw, mismatch: { enough } } };
    if (d.test === true && process.env.NODE_ENV === 'production' && String(process.env.ARIFPAY_SANDBOX).toLowerCase() !== 'true') {
      return { status: 'failed', raw: { ...raw, mismatch: { testModeInProduction: true } } };
    }
    return { status: 'paid', amount: Number(d.totalAmount), currency: 'ETB', raw };
  }
  if (['FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED'].includes(s)) return { status: 'failed', raw };
  return { status: 'pending', raw };
}

// Arifpay's notify call isn't signed; we treat it only as a hint and verify by fetching the session.
export const verifyWebhook = () => true;
export const txRefFromWebhook = (body) => body?.nonce || body?.transaction?.nonce || null;
export const providerRefFromWebhook = (body) => body?.sessionId || body?.uuid || null;
