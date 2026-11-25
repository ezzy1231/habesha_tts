// Word filtering for donation text.
// Global list (admin, settings.filteredWords): the message is rejected.
// Per-streamer list (streamer_settings.blocked_words): the word is masked on screen and
// dropped from the spoken text, so the donation still goes through.

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
// Between letters we tolerate invisible characters and a single . _ * - used to dodge filters.
const GAP = '[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD]*[._*\\-]?[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD]*';
const MASK = '***';
const MAX_WORDS = 500;
const MAX_WORD_LENGTH = 64;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** NFC, lower-case, invisible characters removed. */
export function normalizeText(text) {
  return String(text ?? '').normalize('NFC').replace(ZERO_WIDTH, '').toLowerCase();
}

/** Clean a word list: strings only, normalized, deduplicated, bounded. */
export function normalizeWordList(words) {
  if (!Array.isArray(words)) return [];
  const out = new Set();
  for (const w of words) {
    if (typeof w !== 'string' && typeof w !== 'number') continue;
    const n = normalizeText(w).trim().replace(/\s+/g, ' ');
    if (n && Array.from(n).length <= MAX_WORD_LENGTH) out.add(n);
    if (out.size >= MAX_WORDS) break;
  }
  return [...out];
}

const regexCache = new Map();

/** One regex matching any of the words, allowing repeated letters ("baaad") and gaps ("b.a.d"). */
function buildMatcher(words) {
  const key = words.join('\u0000');
  if (regexCache.has(key)) return regexCache.get(key);
  const parts = words.map((w) => Array.from(w)
    .map((ch) => (ch === ' ' ? '\\s+' : `${escapeRegex(ch)}+`))
    .join(GAP));
  // Longest first so "abc" wins over "ab"
  parts.sort((a, b) => b.length - a.length);
  const re = parts.length ? new RegExp(`(?:${parts.join('|')})`, 'giu') : null;
  if (regexCache.size > 200) regexCache.clear();
  regexCache.set(key, re);
  return re;
}

/** True if the text contains any of the words. */
export function containsBlocked(text, words) {
  const list = normalizeWordList(words);
  if (!list.length) return false;
  const re = buildMatcher(list);
  re.lastIndex = 0;
  return re.test(normalizeText(text));
}

/**
 * Mask blocked words.
 * @returns {{display: string, spoken: string, hits: number}}
 *   display: words replaced with ***; spoken: words removed (for TTS).
 */
export function maskBlocked(text, words) {
  const clean = String(text ?? '').normalize('NFC').replace(ZERO_WIDTH, '');
  const list = normalizeWordList(words);
  if (!list.length) return { display: clean, spoken: clean, hits: 0 };
  const re = buildMatcher(list);
  let hits = 0;
  const display = clean.replace(re, () => { hits += 1; return MASK; });
  const spoken = clean.replace(re, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  return { display, spoken, hits };
}

/**
 * Apply both lists.
 * @returns {{ok: false, reason: 'blocked'} | {ok: true, display: string, spoken: string, masked: number}}
 */
export function moderateMessage(text, { globalWords = [], streamerWords = [] } = {}) {
  if (containsBlocked(text, globalWords)) return { ok: false, reason: 'blocked' };
  const { display, spoken, hits } = maskBlocked(text, streamerWords);
  return { ok: true, display, spoken, masked: hits };
}
