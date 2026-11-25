import crypto from 'crypto';

/** Constant-time string comparison (hashing first so lengths don't leak). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** True when `token` matches the configured ADMIN_TOKEN. */
export function isValidAdminToken(token) {
  return safeEqual(token, process.env.ADMIN_TOKEN);
}
