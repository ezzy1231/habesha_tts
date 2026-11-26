import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signStreamerToken(telegram_id) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ telegram_id, role: 'streamer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Website account session (donor or not-yet-registered user), signed in through the bot.
// Kept separate from streamer tokens: streamerSessionAuth rejects role 'account'.
export function signAccountToken(telegram_id) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ telegram_id: String(telegram_id), role: 'account' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** The Telegram id in a valid account token, or null. */
export function verifyAccountToken(token) {
  const payload = token ? verifyToken(token) : null;
  return payload?.role === 'account' && payload.telegram_id ? String(payload.telegram_id) : null;
}
