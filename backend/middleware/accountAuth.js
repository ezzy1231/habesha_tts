// Website account sessions (signed in through the Telegram bot). Bearer token only: the website
// keeps it in localStorage, so no cross-site cookie setup is needed.
import db from '../db-postgres.js';
import { verifyAccountToken } from '../utils/token.js';

export function bearerToken(req) {
  const h = req.headers?.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Telegram id of the signed-in website account, or null. */
export const accountTelegramId = (req) => verifyAccountToken(bearerToken(req));

export async function loadUser(telegramId) {
  const { rows } = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

/** Require a signed-in account; sets req.accountId (Telegram id) and req.accountUser (users row or null). */
export async function requireAccount(req, res, next) {
  const telegramId = accountTelegramId(req);
  if (!telegramId) return res.status(401).json({ error: 'Please sign in' });
  try {
    req.accountId = telegramId;
    req.accountUser = await loadUser(telegramId);
    return next();
  } catch (error) {
    console.error('[account] load user failed:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
