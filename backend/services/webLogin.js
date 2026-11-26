// Website sign-in through the Telegram bot.
//
// 1. The website asks for a login request and gets a secret nonce plus a t.me deep link.
// 2. The person opens the link; Telegram sends the bot "/start login_<nonce>" from their account.
//    The bot binds the request to that Telegram id and sends them a 6-digit code.
// 3. They type the code on the website, which exchanges nonce + code for a session.
//
// People never need to know their numeric Telegram id, and the code only works together with the
// nonce held by the browser that started the sign-in.
import crypto from 'crypto';
import db from '../db-postgres.js';

export const LOGIN_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const LOGIN_PAYLOAD_PREFIX = 'login_';
const NONCE_RE = /^[A-Za-z0-9_-]{32}$/;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hashCode = (nonce, code) => sha256(`weblogin:v1:${nonce}:${code}`);

export class LoginError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const isValidNonce = (nonce) => NONCE_RE.test(String(nonce || ''));

/** Start a sign-in. Returns the nonce the browser keeps and when it expires. */
export async function createLoginRequest() {
  const nonce = crypto.randomBytes(24).toString('base64url'); // 32 chars, fits Telegram's 64-char start payload
  const { rows: [row] } = await db.query(
    `INSERT INTO web_login_requests (nonce_hash, expires_at)
     VALUES ($1, NOW() + ($2 || ' minutes')::interval) RETURNING expires_at`,
    [sha256(nonce), LOGIN_TTL_MINUTES]);
  // Best-effort cleanup of old rows.
  db.query("DELETE FROM web_login_requests WHERE expires_at < NOW() - interval '1 day'").catch(() => {});
  return { nonce, expiresAt: row.expires_at };
}

/**
 * Called by the bot when `telegramId` opens the deep link. Returns a fresh 6-digit code to send them,
 * or null when the link is unknown, expired, used, or already claimed by a different Telegram account.
 */
export async function bindLoginRequest(nonce, telegramId) {
  if (!isValidNonce(nonce)) return null;
  const code = String(crypto.randomInt(100000, 1000000));
  const { rows: [row] } = await db.query(
    `UPDATE web_login_requests
        SET telegram_id = $2, code_hash = $3, attempts = 0
      WHERE nonce_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        AND (telegram_id IS NULL OR telegram_id = $2)
      RETURNING id`,
    [sha256(nonce), String(telegramId), hashCode(nonce, code)]);
  return row ? code : null;
}

/** Whether the bot has sent a code for this sign-in yet (lets the page say "check Telegram"). */
export async function loginRequestStatus(nonce) {
  if (!isValidNonce(nonce)) throw new LoginError('Invalid sign-in request');
  const { rows: [row] } = await db.query(
    'SELECT telegram_id, used_at, expires_at > NOW() AS live FROM web_login_requests WHERE nonce_hash = $1',
    [sha256(nonce)]);
  if (!row || row.used_at || !row.live) return { status: 'expired' };
  return { status: row.telegram_id ? 'code_sent' : 'waiting' };
}

/** Exchange nonce + code for the Telegram id. Single use; locks after MAX_CODE_ATTEMPTS wrong codes. */
export async function verifyLoginCode(nonce, code) {
  if (!isValidNonce(nonce)) throw new LoginError('Invalid sign-in request');
  if (!/^\d{6}$/.test(String(code || ''))) throw new LoginError('Enter the 6-digit code from Telegram');
  const nonceHash = sha256(nonce);
  const { rows: [row] } = await db.query(
    `SELECT id, telegram_id, code_hash, attempts, used_at, expires_at > NOW() AS live
       FROM web_login_requests WHERE nonce_hash = $1`, [nonceHash]);
  if (!row || row.used_at || !row.live) throw new LoginError('This sign-in expired. Start again.', 410);
  if (!row.telegram_id || !row.code_hash) throw new LoginError('Open the bot first to get your code', 409);
  if (row.attempts >= MAX_CODE_ATTEMPTS) throw new LoginError('Too many wrong codes. Start again.', 429);

  const expected = Buffer.from(row.code_hash);
  const given = Buffer.from(hashCode(nonce, code));
  if (!crypto.timingSafeEqual(expected, given)) {
    await db.query('UPDATE web_login_requests SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw new LoginError('Wrong code', 401);
  }
  // Single use, even under concurrent requests.
  const { rowCount } = await db.query(
    'UPDATE web_login_requests SET used_at = NOW() WHERE id = $1 AND used_at IS NULL', [row.id]);
  if (!rowCount) throw new LoginError('This sign-in expired. Start again.', 410);
  return String(row.telegram_id);
}
