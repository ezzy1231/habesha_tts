// Soundboard: a global library (streamer_id NULL, managed by admin) plus each streamer's own uploads.
// Streamers can override price/enabled for global sounds via streamer_sounds.
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import db from '../db-postgres.js';

export const MAX_SOUND_BYTES = 1024 * 1024;
export const MAX_SOUND_SECONDS = 10;
export const PRICE_MIN = 5;
export const PRICE_MAX = 10000;
export const COOLDOWN_MAX = 3600;

const runQuery = (client, text, params) => (client || db).query(text, params);

/** Sounds a streamer offers, with their effective price and state. */
export async function listStreamerSounds(streamerId, { onlyEnabled = false, client } = {}) {
  const { rows } = await runQuery(client, `
    SELECT s.id, s.label, s.file_url, s.cooldown_s,
           COALESCE(ss.price, s.price) AS price,
           s.price AS default_price,
           (s.enabled AND COALESCE(ss.enabled, TRUE)) AS enabled,
           (s.streamer_id IS NULL) AS is_global
      FROM sounds s
      LEFT JOIN streamer_sounds ss ON ss.sound_id = s.id AND ss.streamer_id = $1
     WHERE (s.streamer_id IS NULL OR s.streamer_id = $1)
       AND (s.enabled OR s.streamer_id = $1)
     ORDER BY (s.streamer_id IS NULL), lower(s.label), s.id`, [streamerId]);
  const list = rows.map((r) => ({
    id: r.id,
    label: r.label,
    fileUrl: r.file_url,
    price: Number(r.price),
    defaultPrice: Number(r.default_price),
    cooldownSeconds: Number(r.cooldown_s),
    enabled: Boolean(r.enabled),
    isGlobal: Boolean(r.is_global),
  }));
  return onlyEnabled ? list.filter((s) => s.enabled) : list;
}

/** Seconds until this sound can be bought again for this streamer (0 = available). */
export async function cooldownRemaining(streamerId, sound, { client } = {}) {
  if (!sound.cooldownSeconds) return 0;
  const { rows } = await runQuery(client, `
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS since
      FROM donations
     WHERE streamer_id = $1 AND sound_id = $2 AND kind = 'sound' AND status = 'paid'`, [streamerId, sound.id]);
  const since = rows[0]?.since;
  if (since === null || since === undefined) return 0;
  return Math.max(0, sound.cooldownSeconds - Number(since));
}

// ---------------------------------------------------------------------------
// Upload validation
// ---------------------------------------------------------------------------

const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function wavDuration(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let off = 12;
  let byteRate = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 16 <= buf.length) byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data' && byteRate) return size / byteRate;
    off += 8 + size + (size % 2);
  }
  return null;
}

/** Estimate MP3 duration from the first frame's bitrate (exact for CBR, close for most VBR). */
function mp3Duration(buf) {
  let off = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3' && buf.length > 10) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    off = 10 + size;
  }
  for (let i = off; i < Math.min(buf.length - 4, off + 4096); i += 1) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const version = (buf[i + 1] >> 3) & 0x3; // 3 = MPEG1
      const layer = (buf[i + 1] >> 1) & 0x3;   // 1 = Layer III
      const idx = (buf[i + 2] >> 4) & 0xf;
      if (layer !== 1 || idx === 0 || idx === 15) continue;
      const kbps = (version === 3 ? MP3_BITRATES_V1_L3 : MP3_BITRATES_V2_L3)[idx];
      if (!kbps) continue;
      return ((buf.length - i) * 8) / (kbps * 1000);
    }
  }
  return null;
}

/**
 * Check an uploaded sound by its bytes (not its claimed type).
 * @returns {{ok: true, ext: string, contentType: string, seconds: number|null} | {ok: false, error: string}}
 */
export function inspectSound(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 64) return { ok: false, error: 'File is empty or not audio' };
  if (buf.length > MAX_SOUND_BYTES) return { ok: false, error: 'File is larger than 1 MB' };
  let type = null;
  let seconds = null;
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    type = { ext: 'wav', contentType: 'audio/wav' };
    seconds = wavDuration(buf);
  } else if (buf.toString('ascii', 0, 4) === 'OggS') {
    type = { ext: 'ogg', contentType: 'audio/ogg' };
  } else if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    type = { ext: 'mp3', contentType: 'audio/mpeg' };
    seconds = mp3Duration(buf);
  }
  if (!type) return { ok: false, error: 'Only MP3, OGG or WAV files' };
  if (seconds !== null && seconds > MAX_SOUND_SECONDS + 0.25) {
    return { ok: false, error: `Sound is ${seconds.toFixed(1)} s; the limit is ${MAX_SOUND_SECONDS} s` };
  }
  return { ok: true, ...type, seconds };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let storage = null;
const bucketName = () => process.env.GCS_AUDIO_BUCKET || 'habeshatts-audio';

/** Upload to the public audio bucket. Tests replace this. */
export let uploadSoundFile = async (buffer, { ext, contentType, owner }) => {
  storage = storage || new Storage();
  const name = `sounds/${owner}/${crypto.randomUUID()}.${ext}`;
  await storage.bucket(bucketName()).file(name).save(buffer, {
    metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    resumable: false,
  });
  return `https://storage.googleapis.com/${bucketName()}/${name}`;
};
export const setUploadSoundFile = (fn) => { uploadSoundFile = fn; };

export async function deleteSoundFile(fileUrl) {
  const prefix = `https://storage.googleapis.com/${bucketName()}/`;
  if (!fileUrl?.startsWith(prefix)) return;
  try {
    storage = storage || new Storage();
    await storage.bucket(bucketName()).file(fileUrl.slice(prefix.length)).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error('[sounds] delete failed:', error.message);
  }
}

export const cleanLabel = (s) => String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);

export function parseSoundFields(src = {}) {
  const out = {};
  if (src.label !== undefined) {
    const label = cleanLabel(src.label);
    if (!label) return { error: 'Label is required' };
    out.label = label;
  }
  if (src.price !== undefined && src.price !== null && src.price !== '') {
    const price = Number(src.price);
    if (!Number.isInteger(price) || price < PRICE_MIN || price > PRICE_MAX) return { error: `Price must be ${PRICE_MIN}–${PRICE_MAX} birr` };
    out.price = price;
  }
  if (src.cooldown !== undefined && src.cooldown !== '') {
    const cooldown = Number(src.cooldown);
    if (!Number.isInteger(cooldown) || cooldown < 0 || cooldown > COOLDOWN_MAX) return { error: `Cooldown must be 0–${COOLDOWN_MAX} seconds` };
    out.cooldown_s = cooldown;
  }
  if (src.enabled !== undefined) out.enabled = src.enabled === true || src.enabled === 'true';
  return { fields: out };
}
