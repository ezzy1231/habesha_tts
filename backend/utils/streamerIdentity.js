// Is this caller the streamer who owns link_uuid? Accepts the dashboard's legacy API key
// or a session JWT (Bearer header, authToken cookie, or socket auth payload).
import crypto from 'crypto';
import db from '../db-postgres.js';
import { verifyToken } from './token.js';

const UUID_RE = /^[0-9a-f-]{8,64}$/i;

export function parseCookieHeader(header = '') {
  return String(header).split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) { try { acc[k] = decodeURIComponent(v.join('=')); } catch { acc[k] = v.join('='); } }
    return acc;
  }, {});
}

const sameSecret = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/**
 * @param {{uuid: string, apiKey?: string, token?: string, cookieHeader?: string}} p
 * @returns {Promise<string|null>} the streamer's telegram_id, or null
 */
export async function authorizeStreamer({ uuid, apiKey, token, cookieHeader }) {
  if (typeof uuid !== 'string' || !UUID_RE.test(uuid)) return null;
  const { rows } = await db.query(
    "SELECT telegram_id, api_key FROM users WHERE link_uuid = $1 AND role = 'streamer'", [uuid]);
  const streamer = rows[0];
  if (!streamer) return null;

  if (apiKey && streamer.api_key && sameSecret(apiKey, streamer.api_key)) return String(streamer.telegram_id);

  const jwt = token || parseCookieHeader(cookieHeader).authToken;
  if (jwt) {
    let payload = null;
    try { payload = verifyToken(jwt); } catch { payload = null; }
    if (payload?.role === 'streamer' && String(payload.telegram_id) === String(streamer.telegram_id)) {
      return String(streamer.telegram_id);
    }
  }
  return null;
}

/** Same check for an Express request (Authorization: Bearer <apiKey or JWT>, or cookie). */
export function authorizeStreamerRequest(req, uuid) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  return authorizeStreamer({ uuid, apiKey: bearer, token: bearer, cookieHeader: req.headers.cookie });
}
