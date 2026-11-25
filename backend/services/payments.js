import crypto from 'crypto';
import db from '../db-postgres.js';
import { getProvider, isTestMode } from '../payments/index.js';
import { fulfilPayment, redeemCredit, releaseCredit, failPaidDonation } from './donations.js';

export const frontendBase = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
export const backendBase = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');

export const newTxRef = () => `ht-${crypto.randomBytes(12).toString('hex')}`;
const isTxRef = (s) => typeof s === 'string' && /^ht-[0-9a-f]{24}$/.test(s);

/** USD support for the diaspora: priced in birr, charged in dollars at a configured rate. */
export function usdRate() {
  const r = Number(process.env.USD_ETB_RATE);
  return Number.isFinite(r) && r > 0 ? r : null;
}

export function chargeAmount(etb, currency) {
  if (currency === 'ETB') return Number(etb.toFixed(2));
  const rate = usdRate();
  if (!rate) throw Object.assign(new Error('USD payments are not available'), { status: 400 });
  return Math.max(1, Math.ceil((etb / rate) * 100) / 100);
}

export class CheckoutError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/**
 * Create a pending payment and a provider checkout.
 * @param {object} p
 * @param {'chapa'|'arifpay'|'demo'} p.providerName
 * @param {object} p.purpose  validated purpose; purpose.price is the gross price in birr
 * @returns {Promise<{txRef: string, redirectUrl: string, status: string}>}
 */
export async function startCheckout({
  providerName, purpose, currency = 'ETB', donorName = null, donorTelegramId = null, claimCode = null,
  description = 'Donation', phone = null, deps = {},
}) {
  const price = Number(purpose.price);
  if (!(price > 0)) throw new CheckoutError('Invalid amount');
  if (!['ETB', 'USD'].includes(currency)) throw new CheckoutError('Unsupported currency');

  const txRef = newTxRef();
  const id = crypto.randomUUID();
  const returnUrl = `${frontendBase()}/donate/return?tx=${txRef}`;

  const client = await db.getClient();
  let credit = null;
  let provider = null;
  let charge;
  let providerUsed;
  try {
    await client.query('BEGIN');
    if (claimCode) {
      credit = await redeemCredit(client, claimCode, price);
      if (!credit) throw new CheckoutError('Claim code not found');
    }
    const due = Number((price - (credit?.applied || 0)).toFixed(2));
    if (due <= 0) {
      providerUsed = 'credit';
      charge = price;
      currency = 'ETB';
    } else {
      provider = getProvider(providerName);
      if (!provider) throw new CheckoutError('That payment method is not available');
      if (!provider.currencies.includes(currency)) throw new CheckoutError(`${provider.label} does not accept ${currency}`);
      if (purpose.kind === 'wallet_topup' && isTestMode(provider)) throw new CheckoutError('Test payments cannot top up a wallet');
      providerUsed = provider.name;
      charge = chargeAmount(due, currency);
    }
    const storedPurpose = { ...purpose, testMode: provider ? isTestMode(provider) : false };
    await client.query(`
      INSERT INTO payments (id, provider, tx_ref, amount, currency, amount_etb, purpose, donor_name, donor_telegram_id,
                            credit_code_id, credit_applied, return_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, providerUsed, txRef, charge, currency, providerUsed === 'credit' ? price : (currency === 'ETB' ? charge : null),
      JSON.stringify(storedPurpose), donorName, donorTelegramId, credit?.creditId || null, credit?.applied || 0, returnUrl]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  if (providerUsed === 'credit') {
    await fulfilPayment(id, { amountEtb: price, raw: { credit: true } }, deps);
    return { txRef, redirectUrl: returnUrl, status: 'paid' };
  }

  try {
    const { checkoutUrl, providerRef } = await provider.createCheckout({
      txRef, amount: charge, currency, donorName, returnUrl, cancelUrl: returnUrl, description, phone,
      callbackUrl: `${backendBase()}/api/payments/webhook/${provider.name}`,
    });
    await db.query('UPDATE payments SET checkout_url = $1, provider_ref = $2 WHERE id = $3', [checkoutUrl, providerRef, id]);
    return { txRef, redirectUrl: checkoutUrl, status: 'pending' };
  } catch (error) {
    console.error(`[payments] ${provider.name} checkout failed for ${txRef}:`, error.message);
    await markPaymentFailed(id, 'failed', { error: error.message.slice(0, 300) });
    throw new CheckoutError('The payment provider is not responding. Please try again.', 502);
  }
}

/** Close a pending payment that didn't go through and give back any credit it used. */
export async function markPaymentFailed(paymentId, status = 'failed', raw = null) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE payments SET status = $2, raw = COALESCE($3::jsonb, raw)
       WHERE id = $1 AND status = 'pending'
       RETURNING credit_code_id, credit_applied`, [paymentId, status, raw ? JSON.stringify(raw) : null]);
    if (rows[0]) await releaseCredit(client, rows[0].credit_code_id, Number(rows[0].credit_applied));
    await client.query('COMMIT');
    return Boolean(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function findPaymentByTxRef(txRef) {
  if (!isTxRef(txRef)) return null;
  const { rows } = await db.query('SELECT * FROM payments WHERE tx_ref = $1', [txRef]);
  return rows[0] || null;
}

/**
 * Ask the provider about a pending payment and act on the answer. Safe to call any number of times.
 * @returns {Promise<'paid'|'pending'|'failed'|'expired'>}
 */
export async function confirmPayment(payment, deps = {}) {
  if (!payment) return undefined;
  // A donor who finished paying after we expired the checkout still gets their donation,
  // as long as no claim-code credit (already released) was part of it.
  const late = payment.status === 'expired' && Number(payment.credit_applied) === 0;
  if (payment.status !== 'pending' && !late) return payment.status;
  const provider = getProvider(payment.provider);
  if (!provider || provider.name === 'demo') return payment.status;
  let result;
  try {
    result = await provider.verify(payment);
  } catch (error) {
    console.error(`[payments] verify ${payment.tx_ref} failed:`, error.message);
    return 'pending';
  }
  if (late && result.status !== 'paid') return payment.status;
  if (result.status === 'paid') {
    if (late) await db.query("UPDATE payments SET status = 'pending' WHERE id = $1 AND status = 'expired'", [payment.id]);
    const amountEtb = payment.currency === 'ETB' ? result.amount : Number(payment.purpose?.price) || null;
    await fulfilPayment(payment.id, { amountEtb, raw: result.raw }, deps);
    return 'paid';
  }
  if (result.status === 'failed') {
    await markPaymentFailed(payment.id, 'failed', result.raw);
    return 'failed';
  }
  return 'pending';
}

/** Complete a demo payment from the hosted demo page. */
export async function completeDemoPayment(txRef, deps = {}) {
  const payment = await findPaymentByTxRef(txRef);
  if (!payment || payment.provider !== 'demo') return null;
  if (payment.status === 'pending') await fulfilPayment(payment.id, { raw: { demo: true } }, deps);
  return payment;
}

/**
 * Catch payments whose webhook never arrived: re-verify recent pending ones, expire old ones.
 * Runs on a timer; bounded so one slow provider can't pile up work.
 */
export async function sweepPendingPayments({ limit = 25, expireAfterMinutes = 120 } = {}) {
  const { rows } = await db.query(`
    SELECT * FROM payments
     WHERE status = 'pending' AND created_at < NOW() - INTERVAL '2 minutes'
     ORDER BY created_at ASC LIMIT $1`, [limit]);
  let paid = 0;
  let expired = 0;
  for (const payment of rows) {
    const status = await confirmPayment(payment);
    if (status === 'paid') paid += 1;
    else if (status === 'pending' && Date.now() - new Date(payment.created_at).getTime() > expireAfterMinutes * 60_000) {
      if (await markPaymentFailed(payment.id, 'expired')) expired += 1;
    }
  }
  const media = await expireStaleMediaRequests();
  return { checked: rows.length, paid, expired, mediaRefunded: media };
}

/** Media requests nobody approved within MEDIA_REQUEST_TTL_HOURS go back to the viewer as credit. */
export async function expireStaleMediaRequests({ hours = Number(process.env.MEDIA_REQUEST_TTL_HOURS || 12) } = {}) {
  const { rows } = await db.query(`
    SELECT id FROM donations
     WHERE kind = 'media' AND status = 'awaiting_approval' AND created_at < NOW() - ($1::int * INTERVAL '1 hour')
     ORDER BY created_at LIMIT 50`, [hours]);
  let n = 0;
  for (const { id } of rows) {
    try {
      const r = await failPaidDonation(id, 'media_expired');
      if (!r.already) n += 1;
    } catch (error) {
      console.error(`[payments] media ${id} expiry failed:`, error.message);
    }
  }
  return n;
}
