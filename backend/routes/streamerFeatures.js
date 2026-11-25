// Streamer dashboard features: /api/v1/streamer/:uuid/{settings,sounds,media,analytics}
// Auth: the dashboard's API key or a session (Bearer / cookie), for this uuid only.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db-postgres.js';
import { authorizeStreamerRequest } from '../utils/streamerIdentity.js';
import { getStreamerSettings, DEFAULT_OVERLAY } from '../utils/streamerSettings.js';
import { normalizeWordList } from '../utils/moderation.js';
import { frontendBase } from '../services/payments.js';
import {
  listStreamerSounds, inspectSound, uploadSoundFile, deleteSoundFile, parseSoundFields, MAX_SOUND_BYTES,
} from '../services/sounds.js';

const router = express.Router();

export async function requireStreamerOwner(req, res, next) {
  try {
    const streamerId = await authorizeStreamerRequest(req, req.params.uuid);
    if (!streamerId) return res.status(401).json({ error: 'Unauthorized' });
    req.streamerId = streamerId;
    req.linkUuid = req.params.uuid;
    return next();
  } catch (error) {
    console.error('[streamer] auth failed:', error.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

const writeLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

const RESERVED_SLUGS = new Set(['admin', 'api', 'streamer', 'streamers', 'donate', 'overlay', 'login', 'pay', 'ui-kit', 'habeshatts', 'support', 'help']);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const colorRe = /^#[0-9a-fA-F]{6}$/;
const httpsUrl = z.string().max(500).url().refine((u) => u.startsWith('https://'), 'Must be an https URL');

export const overlaySchema = z.object({
  theme: z.enum(['habesha', 'minimal', 'neon']).optional(),
  position: z.enum(['top', 'center', 'bottom']).optional(),
  durationMs: z.number().int().min(3000).max(30000).optional(),
  chime: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  scale: z.number().min(0.5).max(2).optional(),
  imageUrl: httpsUrl.nullable().optional(),
  tiers: z.array(z.object({
    minAmount: z.number().int().min(1).max(1_000_000),
    imageUrl: httpsUrl.nullable().optional(),
    color: z.string().regex(colorRe).nullable().optional(),
    effect: z.enum(['none', 'confetti', 'fireworks', 'shake']).optional(),
  }).strict()).max(5).optional(),
}).strict();

const settingsSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, 'Use 3–30 letters, numbers or _').optional(),
  minTtsAmount: z.number().int().min(0).max(10000).optional(),
  blockedWords: z.array(z.string().max(64)).max(500).optional(),
  soundboardEnabled: z.boolean().optional(),
  mediaEnabled: z.boolean().optional(),
  mediaMinAmount: z.number().int().min(10).max(100000).optional(),
  mediaMaxSeconds: z.number().int().min(10).max(600).optional(),
  overlay: overlaySchema.optional(),
}).strict();

export function presentSettings(s) {
  return {
    slug: s.public_slug,
    publicUrl: `${frontendBase()}/@${s.public_slug}`,
    minTtsAmount: s.min_tts_amount,
    blockedWords: s.blocked_words,
    soundboardEnabled: Boolean(s.soundboard_enabled),
    mediaEnabled: Boolean(s.media_enabled),
    mediaMinAmount: s.media_min_amount,
    mediaMaxSeconds: s.media_max_seconds,
    overlay: s.overlay,
  };
}

router.get('/:uuid/settings', requireStreamerOwner, async (req, res) => {
  const s = await getStreamerSettings(req.streamerId);
  if (!s) return res.status(404).json({ error: 'Not found' });
  return res.json({ settings: presentSettings(s) });
});

router.put('/:uuid/settings', requireStreamerOwner, writeLimiter, express.json({ limit: '64kb' }), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings', field: parsed.error.issues[0]?.path?.join('.') });
  }
  const v = parsed.data;
  const current = await getStreamerSettings(req.streamerId);
  if (!current) return res.status(404).json({ error: 'Not found' });
  if (v.slug && RESERVED_SLUGS.has(v.slug)) return res.status(400).json({ error: 'That link is reserved', field: 'slug' });

  const overlay = v.overlay ? { ...DEFAULT_OVERLAY, ...current.overlay, ...v.overlay } : null;
  if (overlay?.tiers) overlay.tiers = [...overlay.tiers].sort((a, b) => a.minAmount - b.minAmount);
  try {
    await db.query(`
      UPDATE streamer_settings SET
        public_slug        = COALESCE($2, public_slug),
        min_tts_amount     = COALESCE($3, min_tts_amount),
        blocked_words      = COALESCE($4::jsonb, blocked_words),
        soundboard_enabled = COALESCE($5, soundboard_enabled),
        media_enabled      = COALESCE($6, media_enabled),
        media_min_amount   = COALESCE($7, media_min_amount),
        media_max_seconds  = COALESCE($8, media_max_seconds),
        overlay            = COALESCE($9::jsonb, overlay),
        updated_at = NOW()
      WHERE streamer_id = $1`,
    [req.streamerId, v.slug ?? null, v.minTtsAmount ?? null,
      v.blockedWords ? JSON.stringify(normalizeWordList(v.blockedWords)) : null,
      v.soundboardEnabled ?? null, v.mediaEnabled ?? null, v.mediaMinAmount ?? null, v.mediaMaxSeconds ?? null,
      overlay ? JSON.stringify(overlay) : null]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That link is already taken', field: 'slug' });
    console.error('[streamer] settings update failed:', error.message);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
  const saved = await getStreamerSettings(req.streamerId);
  if (overlay) global.socketIO?.to(req.linkUuid).emit('overlay_config_updated', { overlay: saved.overlay });
  return res.json({ settings: presentSettings(saved) });
});

// ---------------------------------------------------------------------------
// Soundboard
// ---------------------------------------------------------------------------

router.get('/:uuid/sounds', requireStreamerOwner, async (req, res) => {
  const sounds = await listStreamerSounds(req.streamerId);
  return res.json({ sounds });
});

// Upload: raw audio body, metadata in the query (?label=&price=&cooldown=)
router.post('/:uuid/sounds', requireStreamerOwner, uploadLimiter,
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: MAX_SOUND_BYTES + 1024 }),
  async (req, res) => {
    const { count } = (await db.query('SELECT COUNT(*)::int AS count FROM sounds WHERE streamer_id = $1', [req.streamerId])).rows[0];
    if (count >= 50) return res.status(400).json({ error: 'You can have up to 50 sounds' });
    const { fields, error } = parseSoundFields({ label: req.query.label, price: req.query.price ?? 20, cooldown: req.query.cooldown ?? 30 });
    if (error) return res.status(400).json({ error });
    if (!fields.label) return res.status(400).json({ error: 'Label is required' });
    const check = inspectSound(req.body);
    if (!check.ok) return res.status(400).json({ error: check.error });
    try {
      const fileUrl = await uploadSoundFile(req.body, { ext: check.ext, contentType: check.contentType, owner: req.streamerId });
      const { rows: [row] } = await db.query(`
        INSERT INTO sounds (streamer_id, label, file_url, price, cooldown_s)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.streamerId, fields.label, fileUrl, fields.price, fields.cooldown_s]);
      const sound = (await listStreamerSounds(req.streamerId)).find((s) => s.id === row.id);
      return res.status(201).json({ sound });
    } catch (err) {
      console.error('[streamer] sound upload failed:', err.message);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });

router.put('/:uuid/sounds/:soundId', requireStreamerOwner, writeLimiter, express.json({ limit: '4kb' }), async (req, res) => {
  const soundId = Number(req.params.soundId);
  if (!Number.isInteger(soundId)) return res.status(400).json({ error: 'Invalid sound' });
  const { fields, error } = parseSoundFields(req.body || {});
  if (error) return res.status(400).json({ error });
  const { rows: [sound] } = await db.query('SELECT id, streamer_id FROM sounds WHERE id = $1', [soundId]);
  if (!sound || (sound.streamer_id !== null && String(sound.streamer_id) !== String(req.streamerId))) {
    return res.status(404).json({ error: 'Sound not found' });
  }
  if (sound.streamer_id === null) {
    // Global sound: the streamer may only change their own price / on-off.
    await db.query(`
      INSERT INTO streamer_sounds (streamer_id, sound_id, price, enabled)
      VALUES ($1, $2, $3, COALESCE($4, TRUE))
      ON CONFLICT (streamer_id, sound_id) DO UPDATE SET
        price = COALESCE($3, streamer_sounds.price),
        enabled = COALESCE($4, streamer_sounds.enabled)`,
    [req.streamerId, soundId, fields.price ?? null, fields.enabled ?? null]);
  } else {
    await db.query(`
      UPDATE sounds SET label = COALESCE($2, label), price = COALESCE($3, price),
                        cooldown_s = COALESCE($4, cooldown_s), enabled = COALESCE($5, enabled)
       WHERE id = $1`,
    [soundId, fields.label ?? null, fields.price ?? null, fields.cooldown_s ?? null, fields.enabled ?? null]);
  }
  const updated = (await listStreamerSounds(req.streamerId)).find((s) => s.id === soundId);
  return res.json({ sound: updated });
});

router.delete('/:uuid/sounds/:soundId', requireStreamerOwner, writeLimiter, async (req, res) => {
  const soundId = Number(req.params.soundId);
  const { rows: [sound] } = await db.query(
    'DELETE FROM sounds WHERE id = $1 AND streamer_id = $2 RETURNING file_url', [soundId, req.streamerId]);
  if (!sound) return res.status(404).json({ error: 'Sound not found' });
  deleteSoundFile(sound.file_url);
  return res.json({ success: true });
});

export default router;
