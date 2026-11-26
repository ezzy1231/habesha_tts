// Website accounts: /api/v1/account/*
// The same people and wallet as the Telegram bot. Sign-in goes through the bot (see services/webLogin.js),
// so every account is a Telegram id, and donor / streamer registration lands in the same users table
// and admin approval queue as the bot's.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db-postgres.js';
import { signAccountToken } from '../utils/token.js';
import { requireAccount } from '../middleware/accountAuth.js';
import {
  createLoginRequest, loginRequestStatus, verifyLoginCode, LoginError, LOGIN_PAYLOAD_PREFIX,
} from '../services/webLogin.js';
import { startCheckout, CheckoutError } from '../services/payments.js';
import { containsBlocked } from '../utils/moderation.js';
import { getGlobalBlockedWords } from '../utils/streamerSettings.js';
import { emitAdminEvent } from '../utils/adminNotifications.js';
import { isDonorBanned } from '../../bot/utils/ban.js';
import { liveGateways, MIN_TOPUP, MAX_TOPUP } from '../../bot/utils/rechargeGateway.js';

const router = express.Router();

const startLimiter = rateLimit({ windowMs: 5 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: true, legacyHeaders: false });
const statusLimiter = rateLimit({ windowMs: 60_000, max: 90, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

const json = express.json({ limit: '16kb' });
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
// Photo arrives base64-encoded in JSON (≈4/3 of its size), so this route gets a bigger limit.
const photoJson = express.json({ limit: '8mb' });

const getBot = async () => (await import('../../bot/bot.js')).bot || null;

let botUsernameCache = process.env.TELEGRAM_BOT_USERNAME || null;
async function botUsername() {
  if (botUsernameCache) return botUsernameCache;
  const bot = await getBot();
  const me = bot ? await bot.getMe() : null;
  botUsernameCache = me?.username || null;
  return botUsernameCache;
}

/** Telegram username / first name, for the users.username column (best effort). */
async function telegramProfile(telegramId) {
  try {
    const bot = await getBot();
    const chat = bot ? await bot.getChat(telegramId) : null;
    return { username: chat?.username || chat?.first_name || null };
  } catch {
    return { username: null };
  }
}

const sendError = (res, error, fallback) => {
  if (error instanceof LoginError || error instanceof CheckoutError) return res.status(error.status).json({ error: error.message });
  console.error(`[account] ${fallback}:`, error?.message || error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

/** What the website shows for a signed-in account. Never includes ids, links or tokens of others. */
function serializeAccount(telegramId, user) {
  const base = { telegramId: String(telegramId), registered: Boolean(user) };
  if (!user) return base;
  const banned = isDonorBanned(user);
  return {
    ...base,
    role: user.role,
    displayName: user.display_name || user.full_name || user.username || null,
    balance: user.role === 'donor' ? Number(user.balance || 0) : undefined,
    banned,
    banReason: banned ? user.ban_reason || null : undefined,
    banExpiresAt: banned ? user.ban_expires_at || null : undefined,
    registrationStatus: user.role === 'streamer' ? user.registration_status : undefined,
    // Approved streamers sign in to their dashboard at /streamer/<uuid>/login.
    dashboardPath: user.role === 'streamer' && user.registration_status === 'approved' && user.link_uuid
      ? `/streamer/${user.link_uuid}/login` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Sign in through the bot
// ---------------------------------------------------------------------------

router.post('/login/start', startLimiter, async (_req, res) => {
  try {
    const username = await botUsername();
    if (!username) return res.status(503).json({ error: 'Telegram sign-in is not available right now.' });
    const { nonce, expiresAt } = await createLoginRequest();
    return res.json({
      nonce,
      expiresAt,
      botUrl: `https://t.me/${username}?start=${LOGIN_PAYLOAD_PREFIX}${nonce}`,
    });
  } catch (error) {
    return sendError(res, error, 'login start failed');
  }
});

// POST so the nonce never ends up in URLs or access logs.
router.post('/login/status', statusLimiter, json, async (req, res) => {
  try {
    return res.json(await loginRequestStatus(req.body?.nonce));
  } catch (error) {
    return sendError(res, error, 'login status failed');
  }
});

router.post('/login/verify', verifyLimiter, json, async (req, res) => {
  try {
    const telegramId = await verifyLoginCode(req.body?.nonce, String(req.body?.code || '').trim());
    const { rows: [user] } = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return res.json({ token: signAccountToken(telegramId), account: serializeAccount(telegramId, user) });
  } catch (error) {
    return sendError(res, error, 'login verify failed');
  }
});

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

router.get('/me', requireAccount, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const account = serializeAccount(req.accountId, req.accountUser);
  const gateways = liveGateways().map((g) => ({ name: g.name, label: g.label }));
  return res.json({ account, topup: { providers: gateways, min: MIN_TOPUP, max: MAX_TOPUP } });
});

const nameSchema = z.object({ displayName: z.string().trim().min(2).max(48) }).strict();

async function checkName(displayName) {
  const name = displayName.normalize('NFC').trim();
  if (containsBlocked(name, await getGlobalBlockedWords())) {
    throw new CheckoutError('That name contains words that are not allowed. Please choose another.');
  }
  return name;
}

router.post('/register/donor', writeLimiter, json, requireAccount, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Your name must be 2–48 characters' });
  if (req.accountUser) return res.status(409).json({ error: 'You are already registered' });
  try {
    const name = await checkName(parsed.data.displayName);
    const { username } = await telegramProfile(req.accountId);
    const { rows: [user] } = await db.query(
      `INSERT INTO users (telegram_id, username, display_name, role) VALUES ($1, $2, $3, 'donor')
       ON CONFLICT (telegram_id) DO NOTHING RETURNING *`,
      [req.accountId, username || name, name]);
    if (!user) return res.status(409).json({ error: 'You are already registered' });
    return res.status(201).json({ account: serializeAccount(req.accountId, user) });
  } catch (error) {
    return sendError(res, error, 'donor registration failed');
  }
});

const streamerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  socialLink: z.string().trim().url().max(300).refine((u) => /^https?:\/\//i.test(u), 'Link must start with http:// or https://'),
  phoneNumber: z.string().trim().regex(/^2519\d{8}$/, 'Phone number must look like 2519XXXXXXXX'),
  photo: z.object({
    data: z.string().min(100).max(Math.ceil(PHOTO_MAX_BYTES * 4 / 3) + 4),
    type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }).strict(),
}).strict();

const IMAGE_MAGIC = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
};

router.post('/register/streamer', writeLimiter, photoJson, requireAccount, async (req, res) => {
  const parsed = streamerSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: issue?.message && issue.code === 'custom' ? issue.message : `Check the ${issue?.path?.[0] || 'form'} field` });
  }
  if (req.accountUser) {
    const pending = req.accountUser.role === 'streamer' && req.accountUser.registration_status === 'pending';
    return res.status(409).json({ error: pending ? 'Your application is already being reviewed' : 'You are already registered' });
  }
  const { fullName, socialLink, phoneNumber, photo } = parsed.data;
  const buffer = Buffer.from(photo.data, 'base64');
  if (buffer.length > PHOTO_MAX_BYTES) return res.status(413).json({ error: 'The photo must be under 5 MB' });
  if (buffer.length < 12 || !IMAGE_MAGIC[photo.type](buffer)) return res.status(400).json({ error: 'Upload a JPG, PNG or WebP photo' });

  try {
    const name = await checkName(fullName);
    // Profile pictures everywhere are Telegram file ids (avatars and the admin queue fetch them through
    // the bot). Sending the photo to the applicant's own chat gives us one, and doubles as a receipt.
    const bot = await getBot();
    if (!bot) return res.status(503).json({ error: 'Registration is not available right now.' });
    let fileId;
    try {
      const sent = await bot.sendPhoto(req.accountId, buffer, {
        caption: '📸 የ Streamer ማመልከቻዎ ፎቶ (ከድረ-ገጹ)። ማመልከቻዎ በአስተዳዳሪው በመገምገም ላይ ነው።',
      }, { filename: `profile.${photo.type.split('/')[1]}`, contentType: photo.type });
      fileId = sent?.photo?.[sent.photo.length - 1]?.file_id;
    } catch (error) {
      console.error('[account] sending profile photo failed:', error?.response?.body?.description || error.message);
    }
    if (!fileId) return res.status(502).json({ error: 'Could not save the photo. Make sure you have started the bot, then try again.' });

    const { username } = await telegramProfile(req.accountId);
    const { rows: [user] } = await db.query(
      `INSERT INTO users (telegram_id, username, role, registration_status, full_name, social_link, phone_number, profile_picture_file_id, streamer_order)
       VALUES ($1, $2, 'streamer', 'pending', $3, $4, $5, $6, (SELECT COALESCE(MAX(streamer_order), 0) + 1 FROM users WHERE role = 'streamer'))
       ON CONFLICT (telegram_id) DO NOTHING RETURNING *`,
      [req.accountId, username || name, name, socialLink, phoneNumber, fileId]);
    if (!user) return res.status(409).json({ error: 'You are already registered' });

    emitAdminEvent('streamer_request_created', {
      telegramId: req.accountId, fullName: name, username: user.username, phoneNumber, userId: user.id, source: 'web',
    });
    return res.status(201).json({ account: serializeAccount(req.accountId, user) });
  } catch (error) {
    return sendError(res, error, 'streamer registration failed');
  }
});

/** Donor-only actions: registered donor that isn't banned. */
function requireActiveDonor(req, res, next) {
  const user = req.accountUser;
  if (!user || user.role !== 'donor') return res.status(403).json({ error: 'Register as a donor first' });
  if (isDonorBanned(user)) return res.status(403).json({ error: 'Your account is restricted. Contact support.' });
  return next();
}

router.put('/me/name', writeLimiter, json, requireAccount, requireActiveDonor, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Your name must be 2–48 characters' });
  try {
    const name = await checkName(parsed.data.displayName);
    const { rows: [user] } = await db.query(
      'UPDATE users SET display_name = $1 WHERE telegram_id = $2 RETURNING *', [name, req.accountId]);
    return res.json({ account: serializeAccount(req.accountId, user) });
  } catch (error) {
    return sendError(res, error, 'name change failed');
  }
});

const complaintSchema = z.object({ text: z.string().trim().min(3).max(2000) }).strict();

router.post('/complaints', writeLimiter, json, requireAccount, async (req, res) => {
  const parsed = complaintSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Write at least a few words (up to 2000 characters)' });
  try {
    const { rows: [row] } = await db.query(
      "INSERT INTO complaints (telegram_id, complaint, source) VALUES ($1, $2, 'web') RETURNING id",
      [req.accountId, parsed.data.text]);
    emitAdminEvent('complaint_created', { complaintId: row.id, telegramId: req.accountId, source: 'web' });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return sendError(res, error, 'complaint failed');
  }
});

const topupSchema = z.object({
  amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
  provider: z.string().min(2).max(20),
}).strict();

router.post('/topup', writeLimiter, json, requireAccount, requireActiveDonor, async (req, res) => {
  const parsed = topupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: `Choose an amount between ${MIN_TOPUP} and ${MAX_TOPUP} birr` });
  const { amount, provider } = parsed.data;
  // Same rule as the bot: real-money gateways only, never demo or test keys.
  if (!liveGateways().some((g) => g.name === provider)) return res.status(400).json({ error: 'That payment method is not available' });
  try {
    const { redirectUrl } = await startCheckout({
      providerName: provider,
      purpose: { kind: 'wallet_topup', price: amount },
      donorTelegramId: req.accountId,
      donorName: req.accountUser.display_name || null,
      description: 'Wallet top-up',
    });
    return res.json({ redirectUrl });
  } catch (error) {
    return sendError(res, error, 'top-up failed');
  }
});

export default router;
