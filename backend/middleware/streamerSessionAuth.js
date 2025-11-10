import crypto from 'crypto';
import { verifyToken } from '../utils/token.js';
import db from '../db-postgres.js';

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

export async function streamerSessionAuth(req, res, next) {
  try {
    // Prefer cookie; fall back to Authorization: Bearer <token>
    const cookies = parseCookies(req.headers?.cookie || '');
    let token = cookies.authToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = verifyToken(token);
    if (!payload || !payload.telegram_id || payload.role !== 'streamer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Optional: ensure session exists by token hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      await db.query(
        `UPDATE login_sessions SET last_activity = NOW() WHERE telegram_id = $1 AND token_hash = $2`,
        [payload.telegram_id, tokenHash]
      );
    } catch {}

    req.streamerId = payload.telegram_id;
    req.user = { telegram_id: payload.telegram_id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
