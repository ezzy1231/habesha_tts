import db from '../db-postgres.js';

// Pricing shared by the Telegram bot and the web donation page.
export const DEFAULT_PRICING = Object.freeze({
  maxChars: 600,
  stepChars: 30,
  basePrice: 20,
  incrementPrice: 10,
  platformFeePercent: 10,
});

const NUMERIC_KEYS = ['maxChars', 'stepChars', 'basePrice', 'incrementPrice', 'platformFeePercent'];
const CACHE_MS = 30_000;
let cache = null;
let cacheAt = 0;

/** Pricing settings from the `settings` table, cached for 30 s. */
export async function getPricingSettings({ fresh = false, client = null } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const next = { ...DEFAULT_PRICING };
  try {
    const { rows } = await (client || db).query('SELECT key, value FROM settings WHERE key = ANY($1)', [NUMERIC_KEYS]);
    for (const row of rows) {
      const n = Number(row.value);
      if (Number.isFinite(n) && n >= 0) next[row.key] = n;
    }
  } catch (error) {
    console.error('[pricing] Failed to load settings, using defaults:', error.message);
    if (cache) return cache;
  }
  next.stepChars = Math.max(1, next.stepChars);
  next.platformFeePercent = Math.min(100, Math.max(0, next.platformFeePercent));
  cache = next;
  cacheAt = Date.now();
  return cache;
}

export function invalidatePricingCache() {
  cache = null;
}

/** Characters as the user sees them (Ethiopic and emoji count as one). */
export const messageLength = (text) => Array.from(String(text ?? '')).length;

/** Price in birr for a TTS message under the given settings. */
export function priceForMessage(text, settings = DEFAULT_PRICING) {
  const length = messageLength(text);
  const steps = Math.max(1, Math.ceil(length / settings.stepChars));
  return settings.basePrice + (steps - 1) * settings.incrementPrice;
}

/** Price for a TTS message, raised to the streamer's minimum if one is set. */
export function priceForTts(text, settings = DEFAULT_PRICING, minAmount = 0) {
  return Math.max(priceForMessage(text, settings), Number(minAmount) || 0);
}

const toCents = (n) => Math.round(Number(n) * 100);

/** Split a gross amount into platform fee and streamer net, to the cent. */
export function splitFee(amount, percent = DEFAULT_PRICING.platformFeePercent) {
  const gross = toCents(amount);
  if (!Number.isFinite(gross) || gross < 0) throw new Error(`Invalid amount: ${amount}`);
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  const fee = Math.round((gross * pct) / 100);
  return { gross: gross / 100, fee: fee / 100, net: (gross - fee) / 100 };
}
