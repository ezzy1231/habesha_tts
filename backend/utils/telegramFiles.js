// Serve Telegram files (profile pictures, payment screenshots) without exposing the bot token.
// bot.getFileLink() returns https://api.telegram.org/file/bot<TOKEN>/..., so it must never reach a
// browser. Instead pages get a short-lived signed URL to /api/files/tg/:fileId, and the server
// fetches the file itself.
import crypto from 'crypto';
import express from 'express';

const secret = () => process.env.OVERLAY_SECRET || process.env.JWT_SECRET || '';
const base = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

const sign = (fileId, exp) => crypto.createHmac('sha256', secret()).update(`tgfile:v1:${fileId}:${exp}`).digest('hex').slice(0, 32);

/** Signed URL valid for `ttlSeconds` (rounded to the hour so browsers can cache it). */
export function signedTelegramFileUrl(fileId, ttlSeconds = 6 * 3600) {
  if (!fileId || !FILE_ID_RE.test(fileId) || !secret()) return null;
  const hour = 3600;
  const exp = Math.ceil((Date.now() / 1000 + ttlSeconds) / hour) * hour;
  return `${base()}/api/files/tg/${encodeURIComponent(fileId)}?exp=${exp}&sig=${sign(fileId, exp)}`;
}

export function verifySignedFile(fileId, exp, sig) {
  if (!FILE_ID_RE.test(String(fileId)) || !/^\d{10}$/.test(String(exp)) || !/^[0-9a-f]{32}$/.test(String(sig))) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = sign(fileId, exp);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)));
}

// Small in-memory cache: a few hundred avatars are tiny.
const cache = new Map();
const MAX_ENTRIES = 300;
const MAX_BYTES = 5 * 1024 * 1024;
const TTL_MS = 60 * 60 * 1000;

export async function getTelegramFile(fileId) {
  const hit = cache.get(fileId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const { bot } = await import('../../bot/bot.js');
  if (!bot) throw new Error('Bot not available');
  const link = await bot.getFileLink(fileId);
  const res = await fetch(link, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Telegram file fetch failed (${res.status})`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('File too large');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error('File too large');
  const ext = link.split('.').pop()?.toLowerCase();
  const contentType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
  const entry = { buffer, contentType, at: Date.now() };
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(fileId, entry);
  return entry;
}

export function sendTelegramFile(res, file, maxAge = 3600) {
  res.set('Content-Type', file.contentType);
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  // Only images are rendered inline; anything else downloads.
  if (!file.contentType.startsWith('image/')) res.set('Content-Disposition', 'attachment');
  res.send(file.buffer);
}

export const telegramFileRouter = express.Router();

telegramFileRouter.get('/tg/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!verifySignedFile(fileId, req.query.exp, req.query.sig)) return res.sendStatus(403);
  try {
    sendTelegramFile(res, await getTelegramFile(fileId));
  } catch (error) {
    console.error('[files] telegram file failed:', error.message);
    res.sendStatus(404);
  }
});
