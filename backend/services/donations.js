import crypto from 'crypto';
import db from '../db-postgres.js';
import { settleDonation } from './settlement.js';
import { buildSpokenText, stylePromptFor } from '../utils/voices.js';

// ---------------------------------------------------------------------------
// Claim codes: wallet credit for web donors who have no Telegram wallet
// ---------------------------------------------------------------------------

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L
const CODE_LENGTH = 10;

export function generateClaimCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let body = '';
  for (const b of bytes) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `HT-${body.slice(0, 5)}-${body.slice(5)}`;
}

/** Codes are typed by people: ignore case, spaces and dashes. */
export function normalizeClaimCode(code) {
  const body = String(code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^HT/, '');
  return body.length === CODE_LENGTH ? `HT-${body.slice(0, 5)}-${body.slice(5)}` : null;
}

export const hashClaimCode = (code) => crypto.createHash('sha256').update(`claim:v1:${code}`).digest('hex');

/** Credit remaining on a code, or null if the code doesn't exist. */
export async function getCreditBalance(code, { client } = {}) {
  const normalized = normalizeClaimCode(code);
  if (!normalized) return null;
  const { rows } = await (client || db).query(
    'SELECT remaining FROM wallet_credits WHERE code_hash = $1', [hashClaimCode(normalized)]);
  return rows[0] ? Number(rows[0].remaining) : null;
}

/** Take up to maxAmount from a code (row-locked). Returns {creditId, applied} or null. */
export async function redeemCredit(client, code, maxAmount) {
  const normalized = normalizeClaimCode(code);
  if (!normalized) return null;
  const { rows } = await client.query(
    'SELECT id, remaining FROM wallet_credits WHERE code_hash = $1 FOR UPDATE', [hashClaimCode(normalized)]);
  if (!rows[0]) return null;
  const applied = Math.min(Number(rows[0].remaining), Number(maxAmount));
  if (applied <= 0) return { creditId: rows[0].id, applied: 0 };
  await client.query(
    'UPDATE wallet_credits SET remaining = remaining - $1, last_used_at = NOW() WHERE id = $2',
    [applied, rows[0].id]);
  return { creditId: rows[0].id, applied };
}

/** Give back credit taken for a payment that didn't go through. */
export async function releaseCredit(client, creditId, amount) {
  if (!creditId || !(Number(amount) > 0)) return;
  await client.query('UPDATE wallet_credits SET remaining = remaining + $1 WHERE id = $2', [amount, creditId]);
}

// ---------------------------------------------------------------------------
// Refunds as credit (rejected media, failed TTS on a paid web donation)
// ---------------------------------------------------------------------------

/**
 * Turn an unpaid-out donation into wallet credit for the donor, inside the caller's transaction.
 * Telegram donors get their wallet topped up; web donors get a claim code (also saved on the payment
 * so the return page can show it). Demo donations get nothing.
 * @returns {Promise<{already: true} | {type: 'none'|'wallet'|'code', amount: number, code?: string, donation: object}>}
 */
export async function refundDonationAsCredit(client, donationId, reason) {
  const { rows } = await client.query(`
    UPDATE donations
       SET status = 'refunded',
           media_status = CASE WHEN kind = 'media' THEN 'rejected' ELSE media_status END
     WHERE id = $1 AND status NOT IN ('paid', 'refunded')
     RETURNING id, amount, donor_id, is_demo, payment_id, streamer_id, kind`, [donationId]);
  const donation = rows[0];
  if (!donation) return { already: true };

  if (donation.is_demo) return { type: 'none', amount: 0, donation };
  const credit = await creditDonor(client, {
    amount: Number(donation.amount),
    donorTelegramId: donation.donor_id,
    paymentId: donation.payment_id,
    donationId: donation.id,
    reason,
  });
  return { ...credit, donation };
}

/**
 * Give a donor money back as credit: Telegram donors to their wallet, web donors as a claim code
 * (saved on the payment so the return page can show it).
 */
export async function creditDonor(client, { amount, donorTelegramId = null, paymentId = null, donationId = null, reason = null }) {
  if (!(Number(amount) > 0)) return { type: 'none', amount: 0 };
  if (donorTelegramId) {
    await client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2', [amount, donorTelegramId]);
    return { type: 'wallet', amount: Number(amount) };
  }
  const code = generateClaimCode();
  await client.query(`
    INSERT INTO wallet_credits (code_hash, amount, remaining, reason, source_donation_id)
    VALUES ($1, $2, $2, $3, $4)`, [hashClaimCode(code), amount, reason, donationId]);
  if (paymentId) await client.query('UPDATE payments SET claim_code = $1 WHERE id = $2', [code, paymentId]);
  return { type: 'code', amount: Number(amount), code };
}

/** Same as refundDonationAsCredit, in its own transaction, then tell the Telegram donor if any. */
export async function failPaidDonation(donationId, reason, { notify = notifyTelegramCredit } = {}) {
  const client = await db.getClient();
  let result;
  try {
    await client.query('BEGIN');
    result = await refundDonationAsCredit(client, donationId, reason);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  if (result.type === 'wallet') await notify(result.donation.donor_id, result.amount, reason).catch((e) => console.error('[donations] notify failed:', e.message));
  return result;
}

async function notifyTelegramCredit(telegramId, amount, reason) {
  const { bot } = await import('../../bot/bot.js');
  if (!bot) return;
  const why = reason === 'media_rejected' ? 'ሚዲያው በ Streamer ተቀባይነት አላገኘም' : 'ልገሳው ሊላክ አልቻለም';
  await bot.sendMessage(telegramId, `↩️ ${why}። ${amount} ብር ወደ Wallet ተመልሷል።`);
}

// ---------------------------------------------------------------------------
// Fulfilment: a verified, paid payment becomes a donation
// ---------------------------------------------------------------------------

const defaultDeps = {
  enqueue: async (...args) => (await import('../queue-optimized.js')).enqueueTTSJob(...args),
  io: () => global.socketIO || null,
  notifyTopup: async ({ telegramId, amount }) => {
    const { bot } = await import('../../bot/bot.js');
    if (bot) await bot.sendMessage(telegramId, `✅ ${amount} ብር ወደ Wallet ገብቷል።`);
  },
};

/** Tests replace the queue / sockets / notifier used by the HTTP routes. */
export function setFulfilDeps(overrides) {
  Object.assign(defaultDeps, overrides);
}

const emitTo = (io, rooms, event, payload) => {
  if (!io) return;
  for (const room of rooms.filter(Boolean)) {
    try { io.to(room).emit(event, payload); } catch (e) { console.error(`[donations] emit ${event} failed:`, e.message); }
  }
};

/**
 * Fulfil a payment the provider has confirmed. Idempotent: only the first caller that moves the
 * payment from 'pending' to 'paid' creates the donation.
 * @param {string} paymentId
 * @param {{amountEtb?: number, raw?: object}} verified  what the provider reported
 */
export async function fulfilPayment(paymentId, verified = {}, deps = {}) {
  const { enqueue, io, notifyTopup } = { ...defaultDeps, ...deps };
  const client = await db.getClient();
  let payment;
  let streamer = null;
  let donation = null;
  let after = null; // work to do once committed
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      UPDATE payments
         SET status = 'paid', paid_at = NOW(),
             amount_etb = COALESCE($2, amount_etb, amount),
             raw = COALESCE($3::jsonb, raw)
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [paymentId, verified.amountEtb ?? null, verified.raw ? JSON.stringify(verified.raw) : null]);
    payment = res.rows[0];
    if (!payment) {
      await client.query('COMMIT');
      return { already: true };
    }

    const purpose = payment.purpose || {};
    // Demo gateway and providers running on test keys never move real money.
    const isDemo = payment.provider === 'demo' || purpose.testMode === true;

    if (purpose.kind === 'wallet_topup') {
      // Demo money must never become real wallet balance.
      if (!isDemo && payment.donor_telegram_id) {
        const amount = Number(payment.amount_etb ?? payment.amount);
        await client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2', [amount, payment.donor_telegram_id]);
        await client.query(`
          INSERT INTO recharges (donor_id, name_on_payment, status, amount)
          VALUES ($1, $2, 'approved', $3)`, [payment.donor_telegram_id, `${payment.provider}:${payment.tx_ref}`, amount]);
        after = { kind: 'wallet_topup', telegramId: payment.donor_telegram_id, amount };
      }
      await client.query('COMMIT');
      if (after) notifyTopup(after).catch((e) => console.error('[donations] top-up notify failed:', e.message));
      return { already: false, kind: 'wallet_topup', payment };
    }

    const s = await client.query(
      "SELECT telegram_id, link_uuid FROM users WHERE telegram_id = $1 AND role = 'streamer'", [purpose.streamerId]);
    streamer = s.rows[0];
    const price = Math.round(Number(purpose.price));
    const kind = purpose.kind;
    if (!['tts', 'sound', 'media'].includes(kind) || !(price > 0)) {
      throw new Error(`Payment ${paymentId} has an invalid purpose`);
    }

    if (!streamer) {
      // Streamer removed between checkout and payment: the donor gets the money back as credit.
      const refund = isDemo
        ? { type: 'none', amount: 0 }
        : await creditDonor(client, {
          amount: price, donorTelegramId: payment.donor_telegram_id, paymentId: payment.id, reason: 'streamer_unavailable',
        });
      await client.query('COMMIT');
      return { already: false, kind, donation: null, refund };
    }

    const ins = await client.query(`
      INSERT INTO donations
        (streamer_id, donor_id, donor_name, amount, message, status, kind, source, is_demo, payment_id,
         sound_id, audio_file, media_url, media_start_s, media_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'web', $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        purpose.streamerId,
        payment.donor_telegram_id || null,
        purpose.donorName || payment.donor_name || null,
        price,
        purpose.message ?? purpose.soundLabel ?? null,
        kind === 'media' ? 'awaiting_approval' : 'queued',
        kind,
        isDemo,
        payment.id,
        kind === 'sound' ? purpose.soundId : null,
        kind === 'sound' ? purpose.soundUrl : null,
        kind === 'media' ? purpose.mediaUrl : null,
        kind === 'media' ? (purpose.mediaStart || 0) : null,
        kind === 'media' ? 'pending' : null,
      ]);
    donation = ins.rows[0];

    if (kind === 'sound') {
      await settleDonation(client, {
        donationId: donation.id, price, audioFile: purpose.soundUrl, fundedBy: 'payment',
        streamerTelegramId: streamer.telegram_id,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const room = streamer.link_uuid;
  const purpose = payment.purpose;
  const base = {
    id: donation.id,
    donor_name: donation.donor_name,
    amount: Number(donation.amount),
    kind: donation.kind,
    source: 'web',
    is_demo: donation.is_demo,
    created_at: donation.created_at,
    link_uuid: room,
  };

  if (donation.kind === 'tts') {
    try {
      await enqueue('generate-tts', {
        donationId: donation.id,
        spokenText: buildSpokenText(donation.donor_name, donation.message),
        originalText: donation.message,
        engine: purpose.engine,
        voice: purpose.voice,
        stylePrompt: stylePromptFor(purpose.engine, purpose.voice),
        price: Number(donation.amount),
        tgId: null,
        chatId: null,
        link_uuid: room,
        streamer_id: streamer.telegram_id,
        donorName: donation.donor_name,
        fundedBy: 'payment',
        source: 'web',
      }, { jobId: `donation_${donation.id}` });
    } catch (error) {
      console.error(`[donations] enqueue failed for donation ${donation.id}:`, error.message);
      const refund = await failPaidDonation(donation.id, 'tts_unavailable');
      return { already: false, kind: 'tts', donation, refund };
    }
  } else if (donation.kind === 'sound') {
    emitTo(io(), [room, 'admin'], 'new_donation', {
      ...base, status: 'paid', text: purpose.soundLabel, sound_label: purpose.soundLabel, audio_url: purpose.soundUrl,
    });
  } else if (donation.kind === 'media') {
    emitTo(io(), [room, 'admin'], 'media_request', {
      ...base, text: donation.message, media_url: donation.media_url, media_start_s: donation.media_start_s,
      media_status: 'pending',
    });
  }
  return { already: false, kind: donation.kind, donation };
}

