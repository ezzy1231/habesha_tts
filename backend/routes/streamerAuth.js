import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db-postgres.js';
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimiter.js';
import { signStreamerToken } from '../utils/token.js';
import { logOtpAction } from '../utils/auditLog.js';
import { streamerSessionAuth } from '../middleware/streamerSessionAuth.js';
import { getStreamerBalance } from '../utils/balance.js';
import { emitAdminEvent } from '../utils/adminNotifications.js';
import { validateSchema } from '../middleware/validateSchema.js';
import { setStreamerLiveState } from '../utils/liveStatus.js';
import {
  listNotificationSounds,
  findNotificationSound,
  buildNotificationSoundStorageValue,
  notificationSoundUpdateSchema,
} from '../utils/notificationSounds.js';

// Feature flag to allow safe rollout
const ENABLE_STREAMER_OTP = (process.env.ENABLE_STREAMER_OTP || 'true').toLowerCase() === 'true';

const router = express.Router();
router.use(express.json());

const serializeLiveSnapshot = (row) => {
  if (!row) return null;
  return {
    telegram_id: row.telegram_id,
    username: row.username,
    full_name: row.full_name,
    link_uuid: row.link_uuid,
    live_status: Boolean(row.live_status),
    live_since: row.live_since,
    last_live_ping: row.last_live_ping,
  };
};

function extractAuthToken(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('authToken='));
  if (cookieToken) {
    const [, value = ''] = cookieToken.split('=');
    if (value) return decodeURIComponent(value);
  }
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

const withdrawSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  telebirrUsername: z.string().trim().min(3, 'Telebirr username is required').max(64, 'Telebirr username is too long'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^2519\d{8}$/, 'Phone number must be in the format 2519XXXXXXXX'),
});

const FLAG_ACTION_LABELS = {
  temp_ban: '⏳ Time Ban',
  permanent_ban: '🚫 Ban',
  unban_request: '✅ Unban',
};
const FLAG_ACTIONS = Object.keys(FLAG_ACTION_LABELS);
const flagDonationSchema = z
  .object({
    action: z.enum(FLAG_ACTIONS, {
      errorMap: () => ({ message: 'Unsupported flag action.' }),
    }),
    note: z
      .string()
      .trim()
      .max(400, 'Notes must be 400 characters or fewer')
      .optional(),
  })
  .transform((payload) => ({
    action: payload.action,
    note: payload.note && payload.note.length ? payload.note : undefined,
  }));

async function ensureStreamerOwnsUuid(uuid, streamerId) {
  const res = await db.query('SELECT telegram_id FROM users WHERE link_uuid = $1 AND role = \'streamer\' LIMIT 1', [uuid]);
  const record = res.rows[0];
  if (!record) {
    return false;
  }
  return String(record.telegram_id) === String(streamerId);
}

// Centralized cookie options to support cross-site setups
function buildCookieOptions(maxAgeMs) {
  const crossSite = (process.env.CROSS_SITE_COOKIES || 'false').toLowerCase() === 'true';
  let sameSitePreference = (process.env.COOKIE_SAMESITE || (crossSite ? 'None' : 'Lax')).toLowerCase();
  if (!['none', 'lax', 'strict'].includes(sameSitePreference)) sameSitePreference = crossSite ? 'none' : 'lax';
  const isLocalHttp = (process.env.FRONTEND_URL || '').startsWith('http://localhost');
  // Chrome requires Secure when SameSite=None (even on localhost). So force secure in that case.
  let securePreference = (process.env.COOKIE_SECURE || (sameSitePreference === 'none' ? 'true' : (process.env.NODE_ENV === 'production' ? 'true' : 'false'))).toLowerCase();
  // If developer explicitly set COOKIE_SECURE=false but SameSite=None we override to true and warn.
  if (sameSitePreference === 'none' && securePreference !== 'true') {
    console.warn('[Auth Cookies] Overriding COOKIE_SECURE to true because SameSite=None requires Secure.');
    securePreference = 'true';
  }
  // If local http and developer wants cross-site but cannot serve https, fallback to Lax to at least keep cookie on same-site calls.
  if (isLocalHttp && sameSitePreference === 'none') {
    console.warn('[Auth Cookies] Localhost over HTTP cannot set cross-site cookie reliably; falling back to SameSite=Lax for dev.');
    sameSitePreference = 'lax';
  }
  const opts = { httpOnly: true, secure: securePreference === 'true', sameSite: sameSitePreference, maxAge: maxAgeMs };
  return opts;
}

// Helper to send OTP via telegram bot (best effort, dynamic import to avoid circular refs)
async function sendOtpMessage(telegram_id, otp) {
  try {
    const { bot } = await import('../../bot/bot.js');
    if (!bot) return;
    const msg = `🔐 *Habesha TTS Login Verification*\n\nYour one-time login code:\n\`${otp}\`\n\n⚠️ _Valid for 10 minutes. Do not share._`;
    await bot.sendMessage(String(telegram_id), msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn('[OTP] Failed to send OTP Telegram message:', e?.message || e);
  }
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// POST /api/v1/streamer/request-otp
router.post('/request-otp', otpRequestLimiter, async (req, res) => {
  if (!ENABLE_STREAMER_OTP) return res.status(503).json({ error: 'OTP auth temporarily disabled' });
  const telegram_id = req.body?.telegram_id || req.body?.telegram_user_id;
  if (!telegram_id || !/^\d{5,20}$/.test(String(telegram_id))) {
    return res.status(400).json({ error: 'Invalid telegram_id' });
  }
  try {
    const userRes = await db.query('SELECT telegram_id, username FROM users WHERE telegram_id = $1 AND role = \'streamer\'', [telegram_id]);
    const user = userRes.rows[0];
    if (!user) {
      await logOtpAction({ telegram_id, action: 'otp_requested', status: 'failed', error_message: 'not_found', ip_address: req.ip, user_agent: req.headers['user-agent'] });
      return res.status(404).json({ error: 'Streamer account not found' });
    }

    // Invalidate previous unused tokens (optional best-effort)
    await db.query('DELETE FROM otp_tokens WHERE telegram_id = $1 AND is_used = FALSE', [telegram_id]);

    const otp = randomOtp();
    const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000));
    await db.query('INSERT INTO otp_tokens (telegram_id, otp, expires_at) VALUES ($1, $2, $3)', [telegram_id, otp, expiresAt.toISOString()]);

    await logOtpAction({ telegram_id, action: 'otp_requested', status: 'success', ip_address: req.ip, user_agent: req.headers['user-agent'] });
    sendOtpMessage(telegram_id, otp); // fire and forget

    return res.json({ message: 'OTP sent if streamer exists', expires_in_minutes: Number(process.env.OTP_EXPIRY_MINUTES || 10) });
  } catch (e) {
    await logOtpAction({ telegram_id, action: 'otp_requested', status: 'failed', error_message: e?.message, ip_address: req.ip, user_agent: req.headers['user-agent'] });
    return res.status(500).json({ error: 'Failed to create OTP' });
  }
});

// POST /api/v1/streamer/verify-otp
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  if (!ENABLE_STREAMER_OTP) return res.status(503).json({ error: 'OTP auth temporarily disabled' });
  const telegram_id = req.body?.telegram_id || req.body?.telegram_user_id;
  const otp = req.body?.otp;
  if (!telegram_id || !/^\d{5,20}$/.test(String(telegram_id))) {
    return res.status(400).json({ error: 'Invalid telegram_id' });
  }
  if (!otp || !/^\d{6}$/.test(String(otp))) {
    return res.status(400).json({ error: 'Invalid OTP format' });
  }
  try {
    // Account lock check
    const lockRes = await db.query('SELECT locked_until, login_attempts FROM users WHERE telegram_id = $1 AND role = \'streamer\'', [telegram_id]);
    const lockUser = lockRes.rows[0];
    if (!lockUser) return res.status(404).json({ error: 'Streamer account not found' });
    if (lockUser.locked_until && new Date(lockUser.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked. Try later.' });
    }

    const otpRes = await db.query('SELECT id, otp, expires_at, is_used FROM otp_tokens WHERE telegram_id = $1 AND is_used = FALSE ORDER BY created_at DESC LIMIT 1', [telegram_id]);
    const record = otpRes.rows[0];
    if (!record || new Date(record.expires_at) < new Date()) {
      await db.query('UPDATE users SET login_attempts = login_attempts + 1 WHERE telegram_id = $1', [telegram_id]);
      await logOtpAction({ telegram_id, action: 'otp_verified', status: 'failed', error_message: 'expired_or_missing', ip_address: req.ip, user_agent: req.headers['user-agent'] });
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    if (record.otp !== otp) {
      const upd = await db.query('UPDATE users SET login_attempts = login_attempts + 1 WHERE telegram_id = $1 RETURNING login_attempts', [telegram_id]);
      const attempts = upd.rows[0]?.login_attempts || 0;
      if (attempts >= Number(process.env.OTP_MAX_ATTEMPTS || 5)) {
        const lockMinutes = Number(process.env.OTP_LOCK_MINUTES || 15);
  // Correct interval syntax using concat inside Postgres: ($1 || ' minutes')::interval
  await db.query("UPDATE users SET locked_until = NOW() + ($1 || ' minutes')::interval WHERE telegram_id = $2", [lockMinutes, telegram_id]);
      }
      await logOtpAction({ telegram_id, action: 'otp_verified', status: 'failed', error_message: 'mismatch', ip_address: req.ip, user_agent: req.headers['user-agent'] });
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Mark used
    await db.query('UPDATE otp_tokens SET is_used = TRUE WHERE id = $1', [record.id]);

    // Reset attempts & lock
    await db.query('UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE telegram_id = $1', [telegram_id]);

    const jwt = signStreamerToken(telegram_id);
    const token_hash = crypto.createHash('sha256').update(jwt).digest('hex');
    const expDays = Number((process.env.JWT_EXPIRES_IN || '7d').replace('d','')) || 7;
  await db.query("INSERT INTO login_sessions (telegram_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3 || ' days')::interval)", [telegram_id, token_hash, expDays]);

    await logOtpAction({ telegram_id, action: 'otp_verified', status: 'success', ip_address: req.ip, user_agent: req.headers['user-agent'] });

  const cookieOpts = buildCookieOptions(1000 * 60 * 60 * 24 * expDays);
  console.debug('[verify-otp] Setting auth cookie with options:', cookieOpts);
  res.cookie('authToken', jwt, cookieOpts);

    return res.json({ message: 'Login successful', token: jwt });
  } catch (e) {
    console.error('[verify-otp] error:', e?.message || e);
    await logOtpAction({ telegram_id, action: 'otp_verified', status: 'failed', error_message: e?.message, ip_address: req.ip, user_agent: req.headers['user-agent'] });
    return res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;

// --- Authenticated endpoints ---

// GET /api/v1/streamer/me
router.get('/me', streamerSessionAuth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT telegram_id, username, full_name, link_uuid FROM users WHERE telegram_id = $1 AND role = \'streamer\' LIMIT 1',
      [req.streamerId]
    );
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'Streamer not found' });
    return res.json({ user: u });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/v1/streamer/refresh-token
router.post('/refresh-token', streamerSessionAuth, async (req, res) => {
  try {
    const newJwt = signStreamerToken(req.streamerId);
    const token_hash = crypto.createHash('sha256').update(newJwt).digest('hex');
    const expDays = Number((process.env.JWT_EXPIRES_IN || '7d').replace('d','')) || 7;
    await db.query("INSERT INTO login_sessions (telegram_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3 || ' days')::interval)", [req.streamerId, token_hash, expDays]);
  const cookieOpts = buildCookieOptions(1000 * 60 * 60 * 24 * expDays);
  console.debug('[refresh-token] Setting auth cookie with options:', cookieOpts);
  res.cookie('authToken', newJwt, cookieOpts);
    return res.json({ ok: true, token: newJwt });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// POST /api/v1/streamer/logout
router.post('/logout', streamerSessionAuth, async (req, res) => {
  try {
    // Derive current token from cookie (if present) to remove specific session
    const token = extractAuthToken(req);
    if (token) {
      const token_hash = crypto.createHash('sha256').update(token).digest('hex');
      await db.query('DELETE FROM login_sessions WHERE telegram_id = $1 AND token_hash = $2', [req.streamerId, token_hash]);
    } else {
      await db.query('DELETE FROM login_sessions WHERE telegram_id = $1', [req.streamerId]);
    }
    const opts = buildCookieOptions(0);
  console.debug('[logout] Clearing auth cookie with options:', opts);
  res.cookie('authToken', '', { ...opts, maxAge: 0 });
    await logOtpAction({ telegram_id: req.streamerId, action: 'logout', status: 'success', ip_address: req.ip, user_agent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

// JWT-protected donation routes (mirror API-key versions), behind session auth
// GET /api/v1/streamer/:uuid/donations
router.get('/:uuid/donations', streamerSessionAuth, async (req, res) => {
  const { uuid } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(process.env.DONATIONS_PAGE_SIZE || '9');
  const offset = (page - 1) * limit;
  try {
    // Validate streamer and UUID pair
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const donationsRes = await db.query(`
      SELECT d.id, u.display_name AS donor_name, d.message AS text, d.amount, d.status, d.audio_file AS audio_url, d.played, d.created_at
      FROM donations d
      LEFT JOIN users u ON u.telegram_id = d.donor_id
      WHERE d.streamer_id = $1 AND d.status = 'paid'
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.streamerId, limit, offset]);

    const statsRes = await db.query(`
      SELECT COUNT(*) as count
      FROM donations
      WHERE streamer_id = $1 AND status = 'paid'
    `, [req.streamerId]);

    const totalCount = parseInt(statsRes.rows[0].count);
    res.json({
      donations: donationsRes.rows || [],
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount
      }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// POST /api/v1/streamer/:uuid/donations/:donationId/played
router.post('/:uuid/donations/:donationId/played', streamerSessionAuth, async (req, res) => {
  const { uuid, donationId } = req.params;
  const id = parseInt(donationId);
  if (!id) return res.status(400).json({ error: 'Invalid donation id' });
  try {
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const dRes = await db.query('SELECT id FROM donations WHERE id = $1 AND streamer_id = $2', [id, req.streamerId]);
    if (!dRes.rows[0]) return res.status(404).json({ error: 'Donation not found' });
    await db.query('UPDATE donations SET played = TRUE WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to mark played' });
  }
});

router.post(
  '/:uuid/donations/:donationId/flag',
  streamerSessionAuth,
  validateSchema(flagDonationSchema),
  async (req, res) => {
    const { uuid, donationId: donationIdParam } = req.params;
    const donationId = Number.parseInt(donationIdParam, 10);

    if (!Number.isInteger(donationId) || donationId <= 0) {
      return res.status(400).json({ error: 'Invalid donation ID' });
    }

    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { action, note } = req.body;

    try {
      const donationRes = await db.query(
        'SELECT id, donor_id FROM donations WHERE id = $1 AND streamer_id = $2',
        [donationId, req.streamerId]
      );

      if (!donationRes.rowCount) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      const pendingRes = await db.query(
        "SELECT id FROM donor_flag_requests WHERE donation_id = $1 AND streamer_id = $2 AND status = 'pending' LIMIT 1",
        [donationId, req.streamerId]
      );

      if (pendingRes.rowCount) {
        return res.status(409).json({ error: 'You already have a pending review for this donation.' });
      }

      const fallbackReason = note || `${FLAG_ACTION_LABELS[action]} requested by streamer`;
      const insertRes = await db.query(
        `INSERT INTO donor_flag_requests (donation_id, streamer_id, donor_id, action, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, action, reason, created_at`,
        [donationId, req.streamerId, donationRes.rows[0].donor_id || null, action, fallbackReason]
      );

      const flag = insertRes.rows[0];

      emitAdminEvent('donor_flag_created', {
        donationId,
        streamerId: req.streamerId,
        donorId: donationRes.rows[0].donor_id,
        action,
        actionLabel: FLAG_ACTION_LABELS[action],
        reason: flag.reason,
      });

      return res.json({
        success: true,
        flag: {
          id: flag.id,
          status: flag.status,
          action: flag.action,
          actionLabel: FLAG_ACTION_LABELS[flag.action] || flag.action,
          reason: flag.reason,
          created_at: flag.created_at,
        },
      });
    } catch (error) {
      console.error('[streamer flag] Error submitting donor flag (session route):', error);
      return res.status(500).json({ error: 'Failed to submit review request' });
    }
  }
);

// POST /api/v1/streamer/:uuid/withdraw (JWT session)
router.post(
  '/:uuid/withdraw',
  streamerSessionAuth,
  express.json(),
  validateSchema(withdrawSchema),
  async (req, res) => {
  const { uuid } = req.params;
  const { amount, telebirrUsername, phoneNumber } = req.body || {};
  try {
    // Validate UUID belongs to session user
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

  const currentBalance = await getStreamerBalance(req.streamerId);
  if (amount > currentBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const insertRes = await db.query(
      'INSERT INTO withdrawals (user_id, amount, telebirr_username, phone_number, status) VALUES ($1, $2, $3, $4, \'pending\') RETURNING id',
      [req.streamerId, amount, telebirrUsername, phoneNumber]
    );

    const withdrawalId = insertRes.rows[0]?.id;
    emitAdminEvent('withdrawal_created', {
      withdrawalId,
      streamerId: req.streamerId,
      amount,
    });
    return res.json({ success: true, message: 'Withdrawal request submitted' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to submit withdrawal request' });
  }
  }
);

router.get('/:uuid/notification-sounds', streamerSessionAuth, async (req, res) => {
  const { uuid } = req.params;
  try {
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [catalog, userPreference] = await Promise.all([
      listNotificationSounds(),
      db.query('SELECT notification_sound FROM users WHERE telegram_id = $1', [req.streamerId]),
    ]);

    const rawValue = userPreference.rows?.[0]?.notification_sound ?? null;
    const selectedSound = rawValue ? await findNotificationSound({ value: rawValue }, { includeInactive: true }) : null;

    res.json({
      sounds: catalog,
      selectedSound,
      selectedValue: rawValue,
    });
  } catch (e) {
    console.error('[notification-sounds] Failed to fetch catalog:', e);
    res.status(500).json({ error: 'Failed to fetch notification sounds' });
  }
});

router.put(
  '/:uuid/notification-sound',
  streamerSessionAuth,
  validateSchema(notificationSoundUpdateSchema),
  async (req, res) => {
    const { uuid } = req.params;
    const { soundSlug, soundId, reset } = req.body || {};

    try {
      const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
      if (!ownsUuid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (reset) {
        await db.query('UPDATE users SET notification_sound = NULL WHERE telegram_id = $1', [req.streamerId]);
        return res.json({ success: true, selectedSound: null, selectedValue: null });
      }

      const sound = await findNotificationSound({ slug: soundSlug, id: soundId });
      if (!sound) {
        return res.status(404).json({ error: 'Notification sound not found' });
      }

      const storageValue = await buildNotificationSoundStorageValue(sound);
      if (typeof storageValue === 'undefined' || storageValue === null) {
        return res.status(500).json({ error: 'Failed to derive storage value' });
      }

      await db.query('UPDATE users SET notification_sound = $1 WHERE telegram_id = $2', [storageValue, req.streamerId]);
      res.json({ success: true, selectedSound: sound, selectedValue: storageValue });
    } catch (e) {
      console.error('[notification-sounds] Failed to update selection:', e);
      res.status(500).json({ error: 'Failed to update notification sound' });
    }
  }
);

router.post('/:uuid/live', streamerSessionAuth, async (req, res) => {
  const { uuid } = req.params;
  try {
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await setStreamerLiveState({
      streamerId: req.streamerId,
      isLive: true,
      reason: 'manual',
      triggeredBy: 'dashboard',
      io: req.app.get('io'),
    });
    if (!result.streamer) {
      return res.status(404).json({ error: 'Streamer not found' });
    }
    res.json({ success: true, streamer: serializeLiveSnapshot(result.streamer), changed: result.changed });
  } catch (error) {
    console.error('[streamerAuth] Failed to enable live mode:', error);
    res.status(500).json({ error: 'Failed to go live' });
  }
});

router.delete('/:uuid/live', streamerSessionAuth, async (req, res) => {
  const { uuid } = req.params;
  try {
    const ownsUuid = await ensureStreamerOwnsUuid(uuid, req.streamerId);
    if (!ownsUuid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await setStreamerLiveState({
      streamerId: req.streamerId,
      isLive: false,
      reason: 'manual',
      triggeredBy: 'dashboard',
      io: req.app.get('io'),
    });
    if (!result.streamer) {
      return res.status(404).json({ error: 'Streamer not found' });
    }
    res.json({ success: true, streamer: serializeLiveSnapshot(result.streamer), changed: result.changed });
  } catch (error) {
    console.error('[streamerAuth] Failed to disable live mode:', error);
    res.status(500).json({ error: 'Failed to end live session' });
  }
});
