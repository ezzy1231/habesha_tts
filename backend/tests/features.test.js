// Streamer features (settings, soundboard, media, analytics) over HTTP against a throwaway Postgres.
//   TEST_DATABASE_URL=postgres://... node --test backend/tests/features.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: !url && 'TEST_DATABASE_URL not set', concurrency: false };

const STREAMER = 9200000001;
const OTHER = 9200000002;
const UUID = '22222222-3333-4444-5555-666666666666';
const OTHER_UUID = '33333333-4444-5555-6666-777777777777';
let db; let server; let base; let sounds; let donations;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const emitted = [];
const auth = { Authorization: 'Bearer feat-key' };

// --- synthetic audio --------------------------------------------------------
export function wav(seconds, rate = 8000) {
  const dataLen = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + dataLen);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataLen, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36); b.writeUInt32LE(dataLen, 40);
  return b;
}
function mp3(seconds, kbps = 128) {
  const len = Math.round((seconds * kbps * 1000) / 8);
  const b = Buffer.alloc(Math.max(len, 128));
  b[0] = 0xff; b[1] = 0xfb; b[2] = 0x90; b[3] = 0x64; // MPEG1 Layer III, 128 kbps, 44.1 kHz
  return b;
}

test('inspectSound: type by bytes, size and length limits', opts, async () => {
  sounds = await import('../services/sounds.js');
  assert.equal(sounds.inspectSound(wav(2)).ext, 'wav');
  assert.ok(Math.abs(sounds.inspectSound(wav(2)).seconds - 2) < 0.01);
  assert.match(sounds.inspectSound(wav(12)).error, /limit is 10 s/);
  assert.equal(sounds.inspectSound(mp3(5)).ext, 'mp3');
  assert.match(sounds.inspectSound(mp3(30)).error || '', /limit/);
  assert.equal(sounds.inspectSound(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)])).ext, 'ogg');
  assert.match(sounds.inspectSound(Buffer.from('<html>' + 'x'.repeat(100))).error, /Only MP3/);
  assert.match(sounds.inspectSound(Buffer.alloc(sounds.MAX_SOUND_BYTES + 1, 0xff)).error, /1 MB/);
});

test('setup', opts, async () => {
  Object.assign(process.env, { DATABASE_URL: url, PAYMENTS_DEMO_ENABLED: 'true', FRONTEND_URL: 'https://app.example', BASE_URL: 'https://api.example' });
  ({ default: db } = await import('../db-postgres.js'));
  const { runMigrations } = await import('../migrations/index.js');
  await q(`INSERT INTO notification_sounds (id, label, file_path) VALUES ('default_ping','Default','/x.mp3') ON CONFLICT DO NOTHING`);
  await runMigrations({ log: { log() {} } });
  donations = await import('../services/donations.js');
  donations.setFulfilDeps({ enqueue: async () => {}, io: () => global.socketIO });
  sounds.setUploadSoundFile(async (_buf, { ext, owner }) => `https://storage.googleapis.com/test-bucket/sounds/${owner}/x${Math.random()}.${ext}`);
  global.socketIO = { to: (room) => ({ emit: (ev, payload) => emitted.push({ room, ev, payload }) }) };

  await q('DELETE FROM donations WHERE streamer_id = ANY($1)', [[STREAMER, OTHER]]);
  await q('DELETE FROM sounds WHERE streamer_id = ANY($1) OR streamer_id IS NULL', [[STREAMER, OTHER]]);
  await q('DELETE FROM streamer_settings WHERE streamer_id = ANY($1)', [[STREAMER, OTHER]]);
  await q('DELETE FROM users WHERE telegram_id = ANY($1)', [[STREAMER, OTHER]]);
  await q(`INSERT INTO users (telegram_id, username, full_name, role, link_uuid, api_key, live_status)
           VALUES ($1, 'featstreamer', 'Feat', 'streamer', $2, 'feat-key', TRUE),
                  ($3, 'otherstreamer', 'Other', 'streamer', $4, 'other-key', TRUE)`, [STREAMER, UUID, OTHER, OTHER_UUID]);
  await q(`INSERT INTO streamer_settings (streamer_id, public_slug) VALUES ($1, 'featstreamer'), ($2, 'otherstreamer')`, [STREAMER, OTHER]);
  await q(`INSERT INTO sounds (streamer_id, label, file_url, price, cooldown_s) VALUES (NULL, 'Airhorn', 'https://x/air.mp3', 20, 60)`);

  const { default: features } = await import('../routes/streamerFeatures.js');
  const { default: publicRoutes } = await import('../routes/public.js');
  const { demoPayRouter } = await import('../routes/payments.js');
  const app = express();
  app.use('/pay/demo', express.urlencoded({ extended: false }), demoPayRouter);
  app.use(express.json());
  app.use('/api/v1/streamer', features);
  app.use('/api/public', publicRoutes);
  server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

const call = (path, { method = 'GET', body, headers = auth, raw } = {}) => fetch(base + path, {
  method,
  headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(raw ? { 'Content-Type': 'audio/wav' } : {}) },
  body: raw || (body ? JSON.stringify(body) : undefined),
});

test('settings: owner only, validated, slug unique and not reserved', opts, async () => {
  assert.equal((await call(`/api/v1/streamer/${UUID}/settings`, { headers: {} })).status, 401);
  assert.equal((await call(`/api/v1/streamer/${UUID}/settings`, { headers: { Authorization: 'Bearer other-key' } })).status, 401);
  const got = await (await call(`/api/v1/streamer/${UUID}/settings`)).json();
  assert.equal(got.settings.slug, 'featstreamer');
  assert.equal(got.settings.publicUrl, 'https://app.example/@featstreamer');

  let r = await call(`/api/v1/streamer/${UUID}/settings`, { method: 'PUT', body: { slug: 'OtherStreamer' } });
  assert.equal(r.status, 409);
  r = await call(`/api/v1/streamer/${UUID}/settings`, { method: 'PUT', body: { slug: 'admin' } });
  assert.equal(r.status, 400);
  r = await call(`/api/v1/streamer/${UUID}/settings`, { method: 'PUT', body: { minTtsAmount: -5 } });
  assert.equal(r.status, 400);
  r = await call(`/api/v1/streamer/${UUID}/settings`, { method: 'PUT', body: { balance: 1000 } });
  assert.equal(r.status, 400, 'unknown fields rejected');
  r = await call(`/api/v1/streamer/${UUID}/settings`, { method: 'PUT', body: { overlay: { imageUrl: 'javascript:alert(1)' } } });
  assert.equal(r.status, 400);

  r = await call(`/api/v1/streamer/${UUID}/settings`, {
    method: 'PUT',
    body: { slug: 'Feat_Live', minTtsAmount: 30, blockedWords: [' Meh ', 'meh', 'ugh'], soundboardEnabled: true,
      overlay: { position: 'top', tiers: [{ minAmount: 500, effect: 'fireworks' }, { minAmount: 100, effect: 'confetti' }] } },
  });
  assert.equal(r.status, 200);
  const s = (await r.json()).settings;
  assert.equal(s.slug, 'feat_live');
  assert.deepEqual(s.blockedWords, ['meh', 'ugh']);
  assert.equal(s.overlay.position, 'top');
  assert.equal(s.overlay.theme, 'habesha', 'defaults kept');
  assert.deepEqual(s.overlay.tiers.map((t) => t.minAmount), [100, 500], 'tiers sorted');
  assert.ok(emitted.some((e) => e.room === UUID && e.ev === 'overlay_config_updated'));
});

test('soundboard: upload, override global price, list, delete', opts, async () => {
  let r = await call(`/api/v1/streamer/${UUID}/sounds?label=Too%20long`, { method: 'POST', raw: wav(12) });
  assert.equal(r.status, 400);
  r = await call(`/api/v1/streamer/${UUID}/sounds?label=%3Cb%3EBell&price=15&cooldown=0`, { method: 'POST', raw: wav(1) });
  assert.equal(r.status, 201);
  const bell = (await r.json()).sound;
  assert.equal(bell.label, 'bBell', 'tags stripped from label');
  assert.equal(bell.price, 15);

  const list = (await (await call(`/api/v1/streamer/${UUID}/sounds`)).json()).sounds;
  const air = list.find((x) => x.label === 'Airhorn');
  assert.ok(air.isGlobal && air.enabled);
  r = await call(`/api/v1/streamer/${UUID}/sounds/${air.id}`, { method: 'PUT', body: { price: 50 } });
  assert.equal((await r.json()).sound.price, 50);
  r = await call(`/api/v1/streamer/${UUID}/sounds/${air.id}`, { method: 'PUT', body: { label: 'Mine now' } });
  assert.equal((await r.json()).sound.label, 'Airhorn', 'cannot rename a global sound');

  // Another streamer can't touch this streamer's sound
  r = await call(`/api/v1/streamer/${OTHER_UUID}/sounds/${bell.id}`, { method: 'PUT', body: { price: 99 }, headers: { Authorization: 'Bearer other-key' } });
  assert.equal(r.status, 404);
  r = await call(`/api/v1/streamer/${OTHER_UUID}/sounds/${bell.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer other-key' } });
  assert.equal(r.status, 404);
  // ...and still sees the global price, not this streamer's override
  const otherList = (await (await call(`/api/v1/streamer/${OTHER_UUID}/sounds`, { headers: { Authorization: 'Bearer other-key' } })).json()).sounds;
  assert.equal(otherList.find((x) => x.label === 'Airhorn').price, 20);
  assert.ok(!otherList.some((x) => x.id === bell.id));
});

test('sound purchase: profile lists sounds, price is the streamer’s, cooldown enforced', opts, async () => {
  const prof = (await (await fetch(`${base}/api/public/streamers/feat_live`)).json()).streamer;
  assert.equal(prof.soundboard.enabled, true);
  const air = prof.soundboard.sounds.find((x) => x.label === 'Airhorn');
  assert.equal(air.price, 50);
  assert.equal(air.availableIn, 0);

  const buy = () => fetch(`${base}/api/public/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'feat_live', kind: 'sound', donorName: 'Fan', provider: 'demo', soundId: air.id }),
  });
  let r = await buy();
  assert.equal(r.status, 200);
  const { redirectUrl, price } = await r.json();
  assert.equal(price, 50);
  const tx = redirectUrl.split('/').pop();
  r = await fetch(`${base}/pay/demo/${tx}`, { method: 'POST', redirect: 'manual' });
  assert.equal(r.status, 303);
  const [d] = await q('SELECT kind, status, is_demo, sound_id, net_amount FROM donations WHERE sound_id = $1', [air.id]);
  assert.deepEqual([d.kind, d.status, d.is_demo, Number(d.net_amount)], ['sound', 'paid', true, 0]);

  r = await buy();
  assert.equal(r.status, 409, 'cooldown');
  assert.match((await r.json()).error, /Try again in \d+ s/);

  await q('UPDATE streamer_settings SET soundboard_enabled = FALSE WHERE streamer_id = $1', [STREAMER]);
  r = await buy();
  assert.equal(r.status, 400);
  await q('UPDATE streamer_settings SET soundboard_enabled = TRUE WHERE streamer_id = $1', [STREAMER]);
});


const realFetch = globalThis.fetch;
function mockYouTube(status = 200, title = 'Teddy Afro - Tikur Sew') {
  globalThis.fetch = async (u, init) => (String(u).startsWith('https://www.youtube.com/oembed')
    ? new Response(JSON.stringify({ title }), { status, headers: { 'Content-Type': 'application/json' } })
    : realFetch(u, init));
}

test('media share: checkout, approve plays, reject refunds, overlay sees approved media', opts, async () => {
  await q('UPDATE streamer_settings SET media_enabled = TRUE, media_min_amount = 100, media_max_seconds = 45 WHERE streamer_id = $1', [STREAMER]);
  const buy = (extra = {}) => fetch(`${base}/api/public/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'feat_live', kind: 'media', donorName: 'Viewer', provider: 'demo', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ?t=10', ...extra }),
  });
  try {
    mockYouTube(401);
    let r = await buy();
    assert.equal(r.status, 400, 'embedding disabled');
    mockYouTube(200);
    r = await buy({ mediaUrl: 'https://vimeo.com/123' });
    assert.equal(r.status, 400);
    r = await buy({ amount: 150, message: 'play this meh' });
    assert.equal(r.status, 200);
    const out = await r.json();
    assert.equal(out.price, 150);
    const tx1 = out.redirectUrl.split('/').pop();
    await fetch(`${base}/pay/demo/${tx1}`, { method: 'POST', redirect: 'manual' });
    r = await buy();
    const tx2 = (await r.json()).redirectUrl.split('/').pop();
    await fetch(`${base}/pay/demo/${tx2}`, { method: 'POST', redirect: 'manual' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(emitted.some((e) => e.room === UUID && e.ev === 'media_request'));

  const pending = (await (await call(`/api/v1/streamer/${UUID}/media?status=pending`)).json()).media;
  assert.equal(pending.length, 2);
  const [first, second] = pending;
  assert.equal(first.videoId, 'dQw4w9WgXcQ');
  assert.equal(first.start, 10);
  assert.equal(first.title, 'Teddy Afro - Tikur Sew');
  assert.equal(first.message, 'play this ***');

  let r = await call(`/api/v1/streamer/${OTHER_UUID}/media/${first.id}/approve`, { method: 'POST', headers: { Authorization: 'Bearer other-key' } });
  assert.equal(r.status, 409, 'other streamers cannot act on it');

  r = await call(`/api/v1/streamer/${UUID}/media/${first.id}/approve`, { method: 'POST' });
  assert.equal(r.status, 200);
  const play = emitted.find((e) => e.ev === 'media_play');
  assert.equal(play.payload.maxSeconds, 45);
  assert.equal(play.payload.videoId, 'dQw4w9WgXcQ');
  r = await call(`/api/v1/streamer/${UUID}/media/${first.id}/approve`, { method: 'POST' });
  assert.equal(r.status, 409, 'only once');

  r = await call(`/api/v1/streamer/${UUID}/media/${second.id}/reject`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).refundedAs, 'none', 'demo money is not refunded');
  const [d2] = await q('SELECT status, media_status FROM donations WHERE id = $1', [second.id]);
  assert.deepEqual([d2.status, d2.media_status], ['refunded', 'rejected']);

  const { makeOverlayToken } = await import('../utils/overlayToken.js');
  const [{ id: userId }] = await q('SELECT id FROM users WHERE telegram_id = $1', [STREAMER]);
  const { default: overlayRoutes } = await import('../routes/overlay.js');
  const app = express(); app.use('/api/overlay', overlayRoutes);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  try {
    const port = srv.address().port;
    const ov = await (await fetch(`http://127.0.0.1:${port}/api/overlay/${makeOverlayToken(userId)}`)).json();
    const item = ov.pending.find((p) => p.id === first.id);
    assert.equal(item.kind, 'media');
    assert.equal(item.video_id, 'dQw4w9WgXcQ');
    assert.equal(ov.config.mediaMaxSeconds, 45);
    assert.equal(ov.config.position, 'top');
    const played = await fetch(`http://127.0.0.1:${port}/api/overlay/${makeOverlayToken(userId)}/donations/${first.id}/played`, { method: 'POST' });
    assert.equal(played.status, 200);
    const [d1] = await q('SELECT media_status, played FROM donations WHERE id = $1', [first.id]);
    assert.deepEqual([d1.media_status, d1.played], ['played', true]);
  } finally {
    srv.close();
  }
});

test('stale media requests are refunded by the sweep', opts, async () => {
  const { expireStaleMediaRequests } = await import('../services/payments.js');
  const [{ id }] = await q(`
    INSERT INTO donations (streamer_id, donor_id, amount, status, kind, media_url, media_status, created_at)
    VALUES ($1, NULL, 100, 'awaiting_approval', 'media', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'pending', NOW() - INTERVAL '13 hours')
    RETURNING id`, [STREAMER]);
  assert.ok(await expireStaleMediaRequests() >= 1);
  const [d] = await q('SELECT status FROM donations WHERE id = $1', [id]);
  assert.equal(d.status, 'refunded');
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM wallet_credits WHERE source_donation_id = $1', [id]))[0].n, 1, 'claim code issued');
});

test('analytics: real money only, by kind, day, hour, donors, sessions', opts, async () => {
  const { recordStreamSession } = await import('../utils/liveStatus.js');
  await q('DELETE FROM stream_sessions WHERE streamer_id = $1', [STREAMER]);
  await recordStreamSession(STREAMER, true);
  await recordStreamSession(STREAMER, true);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM stream_sessions WHERE streamer_id = $1', [STREAMER]))[0].n, 1, 'no duplicate open session');
  await q(`INSERT INTO donations (streamer_id, donor_name, amount, platform_fee, net_amount, status, kind, source, is_demo)
           VALUES ($1, 'Abebe', 100, 10, 90, 'paid', 'tts', 'web', FALSE), ($1, 'Abebe', 50, 5, 45, 'paid', 'sound', 'web', FALSE),
                  ($1, 'Demo', 999, 0, 0, 'paid', 'tts', 'web', TRUE)`, [STREAMER]);
  await recordStreamSession(STREAMER, false);

  const a = await (await call(`/api/v1/streamer/${UUID}/analytics?days=7`)).json();
  // only the two real donations; every demo-gateway donation above is excluded
  assert.equal(a.totals.gross, 150);
  assert.equal(a.totals.fee, 15);
  assert.equal(a.totals.net, 135);
  assert.equal(a.byKind.sound.net, 45);
  assert.equal(a.byKind.media.net, 0);
  assert.equal(a.hourly.length, 24);
  assert.equal(a.weekday.length, 7);
  assert.equal(a.topDonors[0].name, 'Abebe');
  assert.ok(!a.topDonors.some((d) => d.name === 'Demo'));
  assert.equal(a.sessions.length, 1);
  assert.ok(a.sessions[0].endedAt);
  assert.equal((await call(`/api/v1/streamer/${UUID}/analytics`, { headers: {} })).status, 401);
});

test('teardown', opts, async () => {
  server?.close();
  delete global.socketIO;
  await db.end();
});
