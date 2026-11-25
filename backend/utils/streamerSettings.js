import db from '../db-postgres.js';
import { normalizeWordList } from './moderation.js';

export const DEFAULT_OVERLAY = Object.freeze({
  theme: 'habesha',          // habesha | minimal | neon
  position: 'bottom',        // top | center | bottom
  durationMs: 9000,          // how long the card stays after audio ends (min)
  chime: true,
  volume: 1,
  scale: 1,
  imageUrl: null,            // alert image or GIF
  tiers: [],                 // [{ minAmount, imageUrl?, color?, effect? }]
});

const runQuery = (client, text, params) => (client || db).query(text, params);

/**
 * The streamer's settings row, created on first use with a slug of `streamer-<users.id>`
 * (a '-' never appears in a Telegram username, so this cannot collide with a chosen slug).
 */
export async function getStreamerSettings(streamerTelegramId, { client } = {}) {
  const existing = await runQuery(client, 'SELECT * FROM streamer_settings WHERE streamer_id = $1', [streamerTelegramId]);
  if (existing.rows[0]) return withDefaults(existing.rows[0]);

  const created = await runQuery(client, `
    INSERT INTO streamer_settings (streamer_id, public_slug)
    SELECT u.telegram_id, 'streamer-' || u.id::text
      FROM users u
     WHERE u.telegram_id = $1 AND u.role = 'streamer'
    ON CONFLICT (streamer_id) DO UPDATE SET streamer_id = EXCLUDED.streamer_id
    RETURNING *`, [streamerTelegramId]);
  return created.rows[0] ? withDefaults(created.rows[0]) : null;
}

export function withDefaults(row) {
  const overlay = row.overlay && typeof row.overlay === 'object' ? row.overlay : {};
  return {
    ...row,
    min_tts_amount: Number(row.min_tts_amount) || 0,
    media_min_amount: Number(row.media_min_amount) || 0,
    media_max_seconds: Number(row.media_max_seconds) || 60,
    blocked_words: normalizeWordList(row.blocked_words),
    overlay: { ...DEFAULT_OVERLAY, ...overlay },
  };
}

let globalWordsCache = { at: 0, words: [] };
export const invalidateGlobalWordsCache = () => { globalWordsCache = { at: 0, words: [] }; };
/** Admin's global blocked-word list (settings.filteredWords), cached for 30 s. */
export async function getGlobalBlockedWords({ client } = {}) {
  if (Date.now() - globalWordsCache.at < 30_000) return globalWordsCache.words;
  try {
    const { rows } = await runQuery(client, "SELECT value FROM settings WHERE key = 'filteredWords'", []);
    let parsed = [];
    try { parsed = JSON.parse(rows[0]?.value || '[]'); } catch { parsed = []; }
    globalWordsCache = { at: Date.now(), words: normalizeWordList(parsed) };
  } catch (error) {
    console.error('[moderation] Failed to load global words:', error.message);
  }
  return globalWordsCache.words;
}
