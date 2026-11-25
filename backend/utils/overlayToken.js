import crypto from 'crypto';

// Overlay tokens are signed, not stored: `<users.id>-<32 hex chars of HMAC>`.
// No '.' in the token: static hosts/dev servers treat dotted paths as files.
// They contain no secret streamer data (not the link_uuid, not the API key),
// so a URL accidentally shown on stream only exposes the alert feed.
// Rotate every overlay URL at once by changing OVERLAY_SECRET.

function getSecret() {
  const secret = process.env.OVERLAY_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('OVERLAY_SECRET or JWT_SECRET must be set for overlay tokens');
  return secret;
}

function sign(userId) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`overlay:v1:${userId}`)
    .digest('hex')
    .slice(0, 32);
}

export function makeOverlayToken(userId) {
  return `${userId}-${sign(userId)}`;
}

/** Returns the numeric users.id if the token is valid, otherwise null. */
export function parseOverlayToken(token) {
  if (typeof token !== 'string' || token.length > 80) return null;
  const match = /^(\d{1,12})-([0-9a-f]{32})$/.exec(token);
  if (!match) return null;
  const [, userId, sig] = match;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return Number(userId);
}
