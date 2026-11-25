// Pure-logic tests: node --test backend/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { priceForMessage, priceForTts, splitFee, messageLength, DEFAULT_PRICING } from '../utils/pricing.js';
import { containsBlocked, maskBlocked, moderateMessage, normalizeWordList } from '../utils/moderation.js';
import { buildSpokenText, escapeSsml, findVoice } from '../utils/voices.js';
import { generateClaimCode, normalizeClaimCode, hashClaimCode } from '../services/donations.js';

test('price follows base + steps formula (matches the bot)', () => {
  const s = DEFAULT_PRICING; // 30 chars/step, 20 base, 10 per extra step
  assert.equal(priceForMessage('a', s), 20);
  assert.equal(priceForMessage('a'.repeat(30), s), 20);
  assert.equal(priceForMessage('a'.repeat(31), s), 30);
  assert.equal(priceForMessage('a'.repeat(600), s), 20 + 19 * 10);
  assert.equal(priceForMessage('', s), 20);
});

test('Ethiopic and emoji count as one character each', () => {
  assert.equal(messageLength('ሰላም'), 3);
  assert.equal(messageLength('👍🏽'), 2); // emoji + skin-tone modifier are two code points
});

test('streamer minimum raises the price but never lowers it', () => {
  assert.equal(priceForTts('hi', DEFAULT_PRICING, 50), 50);
  assert.equal(priceForTts('a'.repeat(300), DEFAULT_PRICING, 50), 110);
  assert.equal(priceForTts('hi', DEFAULT_PRICING, 0), 20);
});

test('fee split is exact to the cent', () => {
  assert.deepEqual(splitFee(100, 10), { gross: 100, fee: 10, net: 90 });
  assert.deepEqual(splitFee(25, 10), { gross: 25, fee: 2.5, net: 22.5 });
  assert.deepEqual(splitFee(33, 10), { gross: 33, fee: 3.3, net: 29.7 });
  assert.deepEqual(splitFee(1, 10), { gross: 1, fee: 0.1, net: 0.9 });
  assert.deepEqual(splitFee(50, 0), { gross: 50, fee: 0, net: 50 });
  assert.deepEqual(splitFee(50, 150), { gross: 50, fee: 50, net: 0 });
  const { fee, net } = splitFee(77.77, 10);
  assert.equal(Math.round((fee + net) * 100), 7777);
  assert.throws(() => splitFee(-1, 10));
});

test('global list rejects, including common dodges', () => {
  const words = ['bad', 'ቃል'];
  assert.equal(containsBlocked('this is BAD', words), true);
  assert.equal(containsBlocked('b.a.d', words), true);
  assert.equal(containsBlocked('baaaad', words), true);
  assert.equal(containsBlocked('b​ad', words), true);
  assert.equal(containsBlocked('ይህ ቃል ነው', words), true);
  assert.equal(containsBlocked('good message', words), false);
  assert.equal(containsBlocked('anything', []), false);
});

test('streamer list masks on screen and drops from speech', () => {
  const r = maskBlocked('you are bad and BAD', ['bad']);
  assert.equal(r.display, 'you are *** and ***');
  assert.equal(r.spoken, 'you are and');
  assert.equal(r.hits, 2);
  const none = maskBlocked('hello', []);
  assert.equal(none.display, 'hello');
  assert.equal(none.hits, 0);
});

test('regex metacharacters in words are literal', () => {
  assert.equal(containsBlocked('a+b', ['a+b']), true);
  assert.equal(containsBlocked('aab', ['a+b']), false);
  assert.equal(maskBlocked('x (y) z', ['(y)']).display, 'x *** z');
});

test('moderateMessage: global rejects before streamer masks', () => {
  assert.deepEqual(moderateMessage('bad', { globalWords: ['bad'], streamerWords: ['bad'] }), { ok: false, reason: 'blocked' });
  const r = moderateMessage('meh ok', { globalWords: ['bad'], streamerWords: ['meh'] });
  assert.equal(r.ok, true);
  assert.equal(r.display, '*** ok');
});

test('word lists are cleaned', () => {
  assert.deepEqual(normalizeWordList([' Bad ', 'bad', '', null, 5, {}]), ['bad', '5']);
  assert.deepEqual(normalizeWordList('bad'), []);
});

test('SSML escapes donor text so tags cannot be injected', () => {
  assert.equal(escapeSsml('<audio src="x"/> & co'), '&lt;audio src=&quot;x&quot;/&gt; &amp; co');
  const ssml = buildSpokenText('A<b>', 'hi <break time="10s"/> ***');
  assert.ok(ssml.startsWith('<speak>') && ssml.endsWith('</speak>'));
  assert.ok(!ssml.includes('<break time="10s"/>'));
  assert.ok(!ssml.includes('***'));
  assert.ok(ssml.includes('A&lt;b&gt;'));
});

test('voice lookup only allows offered voices', () => {
  assert.ok(findVoice('cloud', 'am-ET-Wavenet-A'));
  assert.equal(findVoice('cloud', 'en-US-Evil'), null);
});

test('claim codes: format, normalization, hashing', () => {
  const code = generateClaimCode();
  assert.match(code, /^HT-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  assert.equal(normalizeClaimCode(code.toLowerCase().replace(/-/g, ' ')), code);
  assert.equal(normalizeClaimCode('HT-123'), null);
  assert.equal(hashClaimCode(code), hashClaimCode(code));
  assert.notEqual(hashClaimCode(code), hashClaimCode(generateClaimCode()));
});
