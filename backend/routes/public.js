// Public, unauthenticated API for the web donation page: /api/public/*
// Only ever returns fields that are safe to show anyone (never balances, ids or links).
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db-postgres.js';
import { enabledProviders } from '../payments/index.js';
import { startCheckout, findPaymentByTxRef, confirmPayment, CheckoutError, usdRate, backendBase } from '../services/payments.js';
import { getCreditBalance } from '../services/donations.js';
import { getPricingSettings, priceForTts, messageLength } from '../utils/pricing.js';
import { moderateMessage, containsBlocked, maskBlocked } from '../utils/moderation.js';
import { getStreamerSettings, getGlobalBlockedWords } from '../utils/streamerSettings.js';
import { findVoice, availableVoices } from '../utils/voices.js';
import { getTelegramFile, sendTelegramFile } from '../utils/telegramFiles.js';
import { listStreamerSounds, cooldownRemaining } from '../services/sounds.js';
import { parseYouTubeUrl, checkYouTubeVideo } from '../utils/media.js';

const router = express.Router();

const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 12, standardHeaders: true, legacyHeaders: false });
const readLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const creditLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

export const SLUG_RE = /^[a-z0-9_-]{3,40}$/;

/** A streamer who can receive web donations, by public slug. */
export async function findPublicStreamer(slug) {
  const s = String(slug || '').toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  const { rows } = await db.query(`
    SELECT u.telegram_id, u.full_name, u.username, u.display_name, u.live_status, u.link_uuid,
           u.profile_picture_file_id, u.social_link, s.public_slug
      FROM streamer_settings s
      JOIN users u ON u.telegram_id = s.streamer_id
     WHERE s.public_slug = $1 AND u.role = 'streamer' AND u.registration_status = 'approved'
       AND u.link_uuid IS NOT NULL`, [s]);
  return rows[0] || null;
}

export const displayName = (u) => u.full_name || u.display_name || u.username || 'Streamer';

const avatarUrl = (u) => (u.profile_picture_file_id ? `${backendBase()}/api/public/avatars/${u.public_slug}` : null);

/** Every approved streamer gets a settings row (and slug) before being listed. */
async function ensureSettingsRows() {
  await db.query(`
    INSERT INTO streamer_settings (streamer_id, public_slug)
    SELECT u.telegram_id, 'streamer-' || u.id::text
      FROM users u
     WHERE u.role = 'streamer' AND u.registration_status = 'approved'
       AND NOT EXISTS (SELECT 1 FROM streamer_settings s WHERE s.streamer_id = u.telegram_id)
    ON CONFLICT DO NOTHING`);
}

// ---------------------------------------------------------------------------
// Directory and streamer profile
// ---------------------------------------------------------------------------

let directoryCache = { at: 0, data: null };

router.get('/streamers', readLimiter, async (_req, res) => {
  try {
    if (!directoryCache.data || Date.now() - directoryCache.at > 15_000) {
      await ensureSettingsRows();
      const { rows } = await db.query(`
        SELECT s.public_slug, u.full_name, u.username, u.display_name, u.live_status, u.live_since,
               u.profile_picture_file_id, u.social_link,
               s.soundboard_enabled, s.media_enabled
          FROM users u
          JOIN streamer_settings s ON s.streamer_id = u.telegram_id
         WHERE u.role = 'streamer' AND u.registration_status = 'approved' AND u.link_uuid IS NOT NULL
         ORDER BY u.live_status DESC, u.streamer_order ASC, u.id ASC
         LIMIT 500`);
      directoryCache = {
        at: Date.now(),
        data: rows.map((u) => ({
          slug: u.public_slug,
          name: displayName(u),
          live: Boolean(u.live_status),
          liveSince: u.live_status ? u.live_since : null,
          avatarUrl: avatarUrl(u),
          socialLink: safeSocialLink(u.social_link),
          features: { tts: true, soundboard: Boolean(u.soundboard_enabled), media: Boolean(u.media_enabled) },
        })),
      };
    }
    res.set('Cache-Control', 'public, max-age=15');
    return res.json({ streamers: directoryCache.data });
  } catch (error) {
    console.error('[public] directory failed:', error.message);
    return res.status(500).json({ error: 'Failed to load streamers' });
  }
});

/** Only http(s) links are ever rendered as links. */
function safeSocialLink(link) {
  if (!link) return null;
  const s = String(link).trim();
  const withScheme = /^https?:\/\//i.test(s) ? s : (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? `https://${s}` : null);
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}

/** Public profile + everything the donate page needs. Extended by the soundboard/media steps. */
export const profileExtenders = [
  async (profile, { streamer, settings }) => {
    if (!settings.soundboard_enabled) return;
    const sounds = await listStreamerSounds(streamer.telegram_id, { onlyEnabled: true });
    profile.soundboard.sounds = [];
    for (const s of sounds) {
      profile.soundboard.sounds.push({
        id: s.id, label: s.label, price: s.price, previewUrl: s.fileUrl,
        cooldownSeconds: s.cooldownSeconds, availableIn: await cooldownRemaining(streamer.telegram_id, s),
      });
    }
  },
];

router.get('/streamers/:slug', readLimiter, async (req, res) => {
  try {
    const streamer = await findPublicStreamer(req.params.slug);
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    const [settings, pricing] = [await getStreamerSettings(streamer.telegram_id), await getPricingSettings()];
    const profile = {
      slug: streamer.public_slug,
      name: displayName(streamer),
      live: Boolean(streamer.live_status),
      avatarUrl: avatarUrl(streamer),
      socialLink: safeSocialLink(streamer.social_link),
      tts: {
        maxChars: pricing.maxChars,
        stepChars: pricing.stepChars,
        basePrice: pricing.basePrice,
        incrementPrice: pricing.incrementPrice,
        minAmount: settings.min_tts_amount,
        voices: availableVoices().map(({ engine, voice, label, labelEn, gender }) => ({ engine, voice, label, labelEn, gender })),
      },
      soundboard: { enabled: Boolean(settings.soundboard_enabled), sounds: [] },
      media: {
        enabled: Boolean(settings.media_enabled),
        minAmount: settings.media_min_amount,
        maxSeconds: settings.media_max_seconds,
      },
      platformFeePercent: pricing.platformFeePercent,
      providers: enabledProviders(),
      usdRate: usdRate(),
    };
    for (const extend of profileExtenders) await extend(profile, { streamer, settings });
    res.set('Cache-Control', 'no-store');
    return res.json({ streamer: profile });
  } catch (error) {
    console.error('[public] profile failed:', error.message);
    return res.status(500).json({ error: 'Failed to load streamer' });
  }
});

router.get('/avatars/:slug', readLimiter, async (req, res) => {
  const streamer = await findPublicStreamer(req.params.slug).catch(() => null);
  if (!streamer?.profile_picture_file_id) return res.sendStatus(404);
  try {
    return sendTelegramFile(res, await getTelegramFile(streamer.profile_picture_file_id), 3600);
  } catch (error) {
    console.error('[public] avatar failed:', error.message);
    return res.sendStatus(404);
  }
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  slug: z.string().min(3).max(40),
  kind: z.enum(['tts', 'sound', 'media']),
  donorName: z.string().trim().min(1).max(40),
  provider: z.enum(['chapa', 'arifpay', 'demo']),
  currency: z.enum(['ETB', 'USD']).default('ETB'),
  claimCode: z.string().max(20).optional().nullable(),
  message: z.string().max(2000).optional(),
  engine: z.enum(['cloud', 'gemini']).optional(),
  voice: z.string().max(40).optional(),
  soundId: z.number().int().positive().optional(),
  mediaUrl: z.string().max(300).optional(),
  mediaStart: z.number().int().min(0).max(36000).optional(),
  amount: z.number().int().min(1).max(100000).optional(),
}).strict();

/**
 * Builders turn a validated request into the payment purpose (what gets fulfilled) and its price.
 * Each throws CheckoutError for bad input.
 */
export const purposeBuilders = {
  async tts({ body, streamer, settings, donorName, globalWords }) {
    const pricing = await getPricingSettings();
    const text = String(body.message || '').trim();
    const len = messageLength(text);
    if (!len) throw new CheckoutError('Write a message');
    if (len > pricing.maxChars) throw new CheckoutError(`Message is too long (${len}/${pricing.maxChars})`);
    const mod = moderateMessage(text, { globalWords, streamerWords: settings.blocked_words });
    if (!mod.ok) throw new CheckoutError('Your message contains words that are not allowed. Please change it.');
    if (!mod.spoken.replace(/\*+/g, '').trim()) throw new CheckoutError('Nothing would be read out. Please change your message.');
    const voice = findVoice(body.engine || 'cloud', body.voice || 'am-ET-Wavenet-A');
    if (!voice) throw new CheckoutError('That voice is not available');
    return {
      kind: 'tts',
      streamerId: streamer.telegram_id,
      donorName,
      message: mod.display,
      engine: voice.engine,
      voice: voice.voice,
      price: priceForTts(text, pricing, settings.min_tts_amount),
    };
  },

  async sound({ body, streamer, settings, donorName }) {
    if (!settings.soundboard_enabled) throw new CheckoutError('This streamer has the soundboard turned off');
    const sound = (await listStreamerSounds(streamer.telegram_id, { onlyEnabled: true })).find((s) => s.id === body.soundId);
    if (!sound) throw new CheckoutError('That sound is not available');
    const wait = await cooldownRemaining(streamer.telegram_id, sound);
    if (wait > 0) throw new CheckoutError(`"${sound.label}" was just played. Try again in ${wait} s.`, 409);
    return {
      kind: 'sound',
      streamerId: streamer.telegram_id,
      donorName,
      soundId: sound.id,
      soundLabel: sound.label,
      soundUrl: sound.fileUrl,
      price: sound.price,
    };
  },

  async media({ body, streamer, settings, donorName, globalWords }) {
    if (!settings.media_enabled) throw new CheckoutError('This streamer has media share turned off');
    const parsedUrl = parseYouTubeUrl(body.mediaUrl);
    if (!parsedUrl) throw new CheckoutError('Paste a YouTube link (youtube.com or youtu.be)');
    const video = await checkYouTubeVideo(parsedUrl.videoId);
    if (!video.ok) throw new CheckoutError(video.error);
    if (video.title && containsBlocked(video.title, globalWords)) throw new CheckoutError('That video is not allowed');
    let note = null;
    if (body.message?.trim()) {
      const text = body.message.trim().slice(0, 200);
      const mod = moderateMessage(text, { globalWords, streamerWords: settings.blocked_words });
      if (!mod.ok) throw new CheckoutError('Your message contains words that are not allowed. Please change it.');
      note = mod.display;
    }
    const price = Math.max(settings.media_min_amount, body.amount || 0);
    return {
      kind: 'media',
      streamerId: streamer.telegram_id,
      donorName,
      mediaUrl: parsedUrl.url,
      mediaVideoId: parsedUrl.videoId,
      mediaStart: body.mediaStart ?? parsedUrl.start,
      mediaTitle: video.title,
      message: note,
      price,
    };
  },
};

router.post('/checkout', checkoutLimiter, express.json({ limit: '16kb' }), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues.map((i) => i.path.join('.')) });
  const body = parsed.data;
  try {
    const streamer = await findPublicStreamer(body.slug);
    if (!streamer) throw new CheckoutError('Streamer not found', 404);
    if (!streamer.live_status) throw new CheckoutError("This streamer isn't live right now. Come back when they are!", 409);
    const settings = await getStreamerSettings(streamer.telegram_id);
    const globalWords = await getGlobalBlockedWords();
    if (containsBlocked(body.donorName, globalWords)) throw new CheckoutError('Please choose a different name.');
    const donorName = maskBlocked(body.donorName, settings.blocked_words).display;

    const build = purposeBuilders[body.kind];
    if (!build) throw new CheckoutError('Not available yet');
    const purpose = await build({ body, streamer, settings, donorName, globalWords });

    const result = await startCheckout({
      providerName: body.provider,
      purpose,
      currency: body.currency,
      donorName,
      claimCode: body.claimCode || null,
      description: `${displayName(streamer)} ${purpose.kind}`,
    });
    return res.json({ ...result, price: purpose.price });
  } catch (error) {
    if (error instanceof CheckoutError) return res.status(error.status).json({ error: error.message });
    console.error('[public] checkout failed:', error);
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Payment status for the return page
// ---------------------------------------------------------------------------

router.get('/payments/:txRef', readLimiter, async (req, res) => {
  try {
    let payment = await findPaymentByTxRef(req.params.txRef);
    if (!payment) return res.status(404).json({ error: 'Not found' });
    if (payment.status === 'pending' && payment.provider !== 'demo') {
      await confirmPayment(payment);
      payment = await findPaymentByTxRef(req.params.txRef);
    }
    const p = payment.purpose || {};
    const { rows: [donation] } = await db.query(
      'SELECT status, media_status, played FROM donations WHERE payment_id = $1', [payment.id]);
    const { rows: [slugRow] } = await db.query(`
      SELECT s.public_slug, u.full_name, u.username, u.display_name FROM streamer_settings s
        JOIN users u ON u.telegram_id = s.streamer_id WHERE s.streamer_id = $1`, [p.streamerId || 0]);
    res.set('Cache-Control', 'no-store');
    return res.json({
      status: payment.status,
      provider: payment.provider,
      isDemo: payment.provider === 'demo' || p.testMode === true,
      kind: p.kind,
      price: Number(p.price ?? payment.amount),
      charged: Number(payment.amount),
      currency: payment.currency.trim(),
      creditApplied: Number(payment.credit_applied),
      streamer: slugRow ? { slug: slugRow.public_slug, name: displayName(slugRow) } : null,
      donation: donation ? { status: donation.status, mediaStatus: donation.media_status, played: donation.played } : null,
      claimCode: payment.claim_code || null,
    });
  } catch (error) {
    console.error('[public] payment status failed:', error.message);
    return res.status(500).json({ error: 'Failed to load payment' });
  }
});

// ---------------------------------------------------------------------------
// Options shown on the donate page
// ---------------------------------------------------------------------------

router.get('/payment-options', readLimiter, async (_req, res) => {
  const pricing = await getPricingSettings();
  res.json({
    providers: enabledProviders(),
    usdRate: usdRate(),
    platformFeePercent: pricing.platformFeePercent,
  });
});

// Claim code balance. POST so codes never end up in URLs or access logs.
router.post('/credit/check', creditLimiter, express.json({ limit: '2kb' }), async (req, res) => {
  const remaining = await getCreditBalance(req.body?.code).catch(() => null);
  if (remaining === null) return res.status(404).json({ error: 'Code not found' });
  return res.json({ remaining });
});

export default router;
