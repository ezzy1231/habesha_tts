import express from 'express';
import db from '../db-postgres.js';
import { parseOverlayToken } from '../utils/overlayToken.js';
import { getStreamerSettings } from '../utils/streamerSettings.js';
import { parseYouTubeUrl } from '../utils/media.js';

export function presentOverlayItem(d) {
  return {
    id: d.id,
    kind: d.kind || 'tts',
    donor_name: d.donor_name,
    text: d.text,
    amount: Number(d.amount),
    audio_url: d.audio_url,
    is_demo: Boolean(d.is_demo),
    created_at: d.created_at,
    ...(d.kind === 'media' ? { video_id: parseYouTubeUrl(d.media_url)?.videoId || null, start: Number(d.media_start_s || 0) } : {}),
  };
}

// Public endpoints used by the OBS browser-source overlay.
// Auth = the signed overlay token in the URL (see utils/overlayToken.js).
const router = express.Router();

const PENDING_WINDOW_HOURS = Number(process.env.OVERLAY_PENDING_WINDOW_HOURS || 6);
const PENDING_LIMIT = 20;

export async function resolveOverlayStreamer(token) {
  const userId = parseOverlayToken(token);
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT id, telegram_id, link_uuid, COALESCE(full_name, display_name, username) AS name
       FROM users
      WHERE id = $1 AND role = 'streamer' AND link_uuid IS NOT NULL`,
    [userId]
  );
  return rows[0] || null;
}

async function requireOverlay(req, res, next) {
  try {
    const streamer = await resolveOverlayStreamer(req.params.token);
    if (!streamer) return res.status(404).json({ error: 'Overlay not found' });
    req.overlayStreamer = streamer;
    next();
  } catch (error) {
    console.error('[overlay] auth failed:', error.message);
    res.status(500).json({ error: 'Overlay unavailable' });
  }
}

// Streamer info + recent donations that have not been played yet
router.get('/:token', requireOverlay, async (req, res) => {
  try {
    const { telegram_id, name } = req.overlayStreamer;
    const settings = await getStreamerSettings(telegram_id);
    const { rows } = await db.query(
      `SELECT d.id, COALESCE(d.donor_name, u.display_name) AS donor_name, d.message AS text, d.amount,
              d.audio_file AS audio_url, d.created_at, d.kind, d.is_demo, d.media_url, d.media_start_s
         FROM donations d
         LEFT JOIN users u ON u.telegram_id = d.donor_id
        WHERE d.streamer_id = $1
          AND d.status = 'paid'
          AND d.played = FALSE
          AND (d.audio_file IS NOT NULL OR (d.kind = 'media' AND d.media_status = 'approved'))
          AND d.created_at > NOW() - ($2::int * INTERVAL '1 hour')
        ORDER BY d.created_at ASC
        LIMIT $3`,
      [telegram_id, PENDING_WINDOW_HOURS, PENDING_LIMIT]
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      streamer: { name },
      config: { ...(settings?.overlay || {}), mediaMaxSeconds: settings?.media_max_seconds ?? 60 },
      pending: rows.map(presentOverlayItem),
    });
  } catch (error) {
    console.error('[overlay] failed to load pending donations:', error.message);
    res.status(500).json({ error: 'Failed to load overlay' });
  }
});

// Called by the overlay after an alert finished playing
router.post('/:token/donations/:donationId/played', requireOverlay, async (req, res) => {
  const donationId = Number.parseInt(req.params.donationId, 10);
  if (!Number.isInteger(donationId) || donationId <= 0) {
    return res.status(400).json({ error: 'Invalid donation id' });
  }
  try {
    const result = await db.query(
      `UPDATE donations SET played = TRUE,
              media_status = CASE WHEN kind = 'media' THEN 'played' ELSE media_status END
        WHERE id = $1 AND streamer_id = $2 RETURNING id`,
      [donationId, req.overlayStreamer.telegram_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Donation not found' });
    // Let the dashboard update its "played" state without a refresh
    req.app.get('io')?.to(req.overlayStreamer.link_uuid).emit('donation_played', { id: donationId });
    res.json({ success: true });
  } catch (error) {
    console.error('[overlay] failed to mark played:', error.message);
    res.status(500).json({ error: 'Failed to mark as played' });
  }
});

export default router;
