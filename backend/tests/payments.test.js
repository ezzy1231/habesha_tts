// Payment layer tests. Provider HTTP is mocked; the database is a throwaway Postgres:
//   TEST_DATABASE_URL=postgres://... node --test backend/tests/payments.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: !url && 'TEST_DATABASE_URL not set', concurrency: false };

const STREAMER = 9100000001;
const DONOR = 9100000002;
let db; let svc; let donations; let chapa; let arifpay;
const q = async (sql, params) => (await db.query(sql, params)).rows;

// --- fetch mock --------------------------------------------------------------
const realFetch = globalThis.fetch;
let fetchHandler = null;
const calls = [];
function mockFetch(handler) {
  fetchHandler = handler;
  globalThis.fetch = async (u, init = {}) => {
    const href = String(u);
    if (href.startsWith('http://127.0.0.1')) return realFetch(u, init); // our own test server
    calls.push({ url: href, init });
    const { status = 200, json } = await fetchHandler(href, init);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

const ENV = {
  CHAPA_SECRET_KEY: 'CHASECK-live-not-real',
  CHAPA_WEBHOOK_SECRET: 'whsec-test',
  ARIFPAY_API_KEY: 'arif-test',
  ARIFPAY_BENEFICIARY_ACCOUNT: '0100000000',
  ARIFPAY_BENEFICIARY_BANK: 'AWINETAA',
  PAYMENTS_DEMO_ENABLED: 'true',
  FRONTEND_URL: 'https://app.example',
  BASE_URL: 'https://api.example',
};

test('setup', opts, async () => {
  Object.assign(process.env, ENV, { DATABASE_URL: url });
  ({ default: db } = await import('../db-postgres.js'));
  const { runMigrations } = await import('../migrations/index.js');
  await q(`INSERT INTO notification_sounds (id, label, file_path) VALUES ('default_ping','Default','/x.mp3') ON CONFLICT DO NOTHING`);
  await runMigrations({ log: { log() {} } });
  svc = await import('../services/payments.js');
  donations = await import('../services/donations.js');
  chapa = await import('../payments/chapa.js');
  arifpay = await import('../payments/arifpay.js');
  await q('DELETE FROM donations WHERE streamer_id = $1', [STREAMER]);
  await q('DELETE FROM streamer_settings WHERE streamer_id = $1', [STREAMER]);
  await q('DELETE FROM users WHERE telegram_id = ANY($1)', [[STREAMER, DONOR]]);
  await q(`INSERT INTO users (telegram_id, username, full_name, role, balance, link_uuid, live_status)
           VALUES ($1, 'paystreamer', 'Pay Streamer', 'streamer', 0, 'room-pay', TRUE),
                  ($2, 'paydonor', NULL, 'donor', 0, NULL, FALSE)`, [STREAMER, DONOR]);
  await q(`INSERT INTO streamer_settings (streamer_id, public_slug, min_tts_amount, blocked_words)
           VALUES ($1, 'paystreamer', 0, '["meh"]')`, [STREAMER]);
  await q(`INSERT INTO settings (key, value) VALUES ('filteredWords', '["badword"]')
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
});

// --- provider adapters ---------------------------------------------------------
test('chapa: initialize request and checkout url', opts, async () => {
  mockFetch(async () => ({ json: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/x' } } }));
  const r = await chapa.createCheckout({ txRef: 'ht-abc', amount: 30, currency: 'ETB', donorName: 'Selam <Abebe>', returnUrl: 'https://r', callbackUrl: 'https://c', description: 'Pay Streamer tts!' });
  assert.equal(r.checkoutUrl, 'https://checkout.chapa.co/x');
  const sent = JSON.parse(calls.at(-1).init.body);
  assert.equal(calls.at(-1).url, 'https://api.chapa.co/v1/transaction/initialize');
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer CHASECK-live-not-real');
  assert.equal(sent.amount, '30.00');
  assert.equal(sent.tx_ref, 'ht-abc');
  assert.equal(sent.first_name, 'Selam');
  assert.match(sent.customization.description, /^[\p{L}\p{N} ._-]+$/u);
  mockFetch(async () => ({ status: 400, json: { status: 'failed', message: 'bad' } }));
  await assert.rejects(chapa.createCheckout({ txRef: 'ht-x', amount: 1, currency: 'ETB' }), /Chapa initialize failed/);
});

test('chapa: verify checks status, tx_ref, currency and amount', opts, async () => {
  const pay = { tx_ref: 'ht-1', amount: '50.00', currency: 'ETB' };
  const reply = (data) => mockFetch(async () => ({ json: { status: 'success', data } }));
  reply({ status: 'success', tx_ref: 'ht-1', amount: '50', currency: 'ETB' });
  assert.equal((await chapa.verify(pay)).status, 'paid');
  reply({ status: 'success', tx_ref: 'ht-1', amount: '5', currency: 'ETB' });
  assert.equal((await chapa.verify(pay)).status, 'failed', 'underpaid');
  reply({ status: 'success', tx_ref: 'ht-1', amount: '50', currency: 'USD' });
  assert.equal((await chapa.verify(pay)).status, 'failed', 'wrong currency');
  reply({ status: 'success', tx_ref: 'ht-OTHER', amount: '50', currency: 'ETB' });
  assert.equal((await chapa.verify(pay)).status, 'failed', 'other transaction');
  reply({ status: 'pending', tx_ref: 'ht-1' });
  assert.equal((await chapa.verify(pay)).status, 'pending');
  mockFetch(async () => ({ status: 404, json: { status: 'failed', message: 'Invalid transaction' } }));
  assert.equal((await chapa.verify(pay)).status, 'pending');
});

test('chapa: webhook signature', opts, async () => {
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', tx_ref: 'ht-1', status: 'success' }));
  const sig = crypto.createHmac('sha256', 'whsec-test').update(body).digest('hex');
  assert.equal(chapa.verifyWebhook({ rawBody: body, headers: { 'x-chapa-signature': sig } }), true);
  assert.equal(chapa.verifyWebhook({ rawBody: body, headers: { 'x-chapa-signature': 'f'.repeat(64) } }), false);
  assert.equal(chapa.verifyWebhook({ rawBody: body, headers: {} }), false);
});

test('arifpay: session create and verify', opts, async () => {
  mockFetch(async () => ({ json: { data: { sessionId: 'S1', paymentUrl: 'https://checkout.arifpay.net/S1' } } }));
  const r = await arifpay.createCheckout({ txRef: 'ht-a', amount: 40, returnUrl: 'https://r', callbackUrl: 'https://c' });
  assert.deepEqual(r, { checkoutUrl: 'https://checkout.arifpay.net/S1', providerRef: 'S1' });
  assert.equal(calls.at(-1).url, 'https://gateway.arifpay.net/v0/checkout/session');
  assert.equal(calls.at(-1).init.headers['x-arifpay-key'], 'arif-test');
  const sent = JSON.parse(calls.at(-1).init.body);
  assert.equal(sent.nonce, 'ht-a');
  assert.equal(sent.beneficiaries[0].amount, 40);
  assert.match(sent.expireDate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/);

  const pay = { provider_ref: 'S1', amount: '40.00' };
  mockFetch(async () => ({ json: { data: { totalAmount: 40, transaction: { transactionStatus: 'SUCCESS' } } } }));
  assert.equal((await arifpay.verify(pay)).status, 'paid');
  assert.equal(calls.at(-1).url, 'https://gateway.arifpay.net/v0/checkout/session/S1');
  mockFetch(async () => ({ json: { data: { totalAmount: 4, transaction: { transactionStatus: 'SUCCESS' } } } }));
  assert.equal((await arifpay.verify(pay)).status, 'failed');
  mockFetch(async () => ({ json: { data: { totalAmount: 40 } } }));
  assert.equal((await arifpay.verify(pay)).status, 'pending');
});

// --- checkout service -------------------------------------------------------------
const purpose = (price = 30) => ({ kind: 'tts', streamerId: STREAMER, donorName: 'Web', message: 'hi', engine: 'cloud', voice: 'am-ET-Wavenet-A', price });
const noQueue = { enqueue: async () => {}, io: () => null };

test('chapa checkout, then webhook-style confirmation fulfils once', opts, async () => {
  mockFetch(async (u) => (u.includes('/initialize')
    ? { json: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/y' } } }
    : { json: { status: 'success', data: { status: 'success', tx_ref: lastTx, amount: '30', currency: 'ETB' } } }));
  let lastTx;
  const r = await svc.startCheckout({ providerName: 'chapa', purpose: purpose(30), donorName: 'Web' });
  lastTx = r.txRef;
  assert.equal(r.redirectUrl, 'https://checkout.chapa.co/y');
  const sentInit = JSON.parse(calls.find((c) => c.url.includes('/initialize') && c.init.body.includes(r.txRef)).init.body);
  assert.equal(sentInit.return_url, `https://app.example/donate/return?tx=${r.txRef}`);
  assert.equal(sentInit.callback_url, 'https://api.example/api/payments/webhook/chapa');

  const jobs = [];
  const p = await svc.findPaymentByTxRef(r.txRef);
  assert.equal(await svc.confirmPayment(p, { enqueue: async (...a) => jobs.push(a), io: () => null }), 'paid');
  assert.equal(await svc.confirmPayment(await svc.findPaymentByTxRef(r.txRef)), 'paid', 'second time is a no-op');
  assert.equal(jobs.length, 1);
  const [d] = await q('SELECT is_demo, source FROM donations WHERE payment_id = $1', [p.id]);
  assert.deepEqual([d.is_demo, d.source], [false, 'web']);
});

test('provider down: payment marked failed and claim-code credit returned', opts, async () => {
  const code = donations.generateClaimCode();
  await q(`INSERT INTO wallet_credits (code_hash, amount, remaining) VALUES ($1, 20, 20)`, [donations.hashClaimCode(code)]);
  mockFetch(async () => ({ status: 503, json: { message: 'down' } }));
  await assert.rejects(svc.startCheckout({ providerName: 'chapa', purpose: purpose(50), claimCode: code }), (e) => e.status === 502);
  assert.equal(await donations.getCreditBalance(code), 20, 'credit restored');
  const [p] = await q(`SELECT status, credit_applied FROM payments WHERE credit_code_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`);
  assert.deepEqual([p.status, Number(p.credit_applied)], ['failed', 20]);
});

test('claim code covering the whole price skips the gateway', opts, async () => {
  const code = donations.generateClaimCode();
  await q(`INSERT INTO wallet_credits (code_hash, amount, remaining) VALUES ($1, 100, 100)`, [donations.hashClaimCode(code)]);
  mockFetch(async () => assert.fail('no provider call'));
  const r = await svc.startCheckout({ providerName: 'chapa', purpose: purpose(30), claimCode: code, deps: noQueue });
  assert.equal(r.status, 'paid');
  const p = await svc.findPaymentByTxRef(r.txRef);
  assert.equal(p.provider, 'credit');
  assert.equal(await donations.getCreditBalance(code), 70);
  await assert.rejects(svc.startCheckout({ providerName: 'chapa', purpose: purpose(30), claimCode: 'HT-22222-22222' }), /not found/);
});

test('test-mode keys become demo donations and cannot top up wallets', opts, async () => {
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-123';
  try {
    mockFetch(async (u) => (u.includes('/initialize')
      ? { json: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/t' } } }
      : { json: { status: 'success', data: { status: 'success', tx_ref: tx, amount: '30', currency: 'ETB' } } }));
    let tx;
    const r = await svc.startCheckout({ providerName: 'chapa', purpose: purpose(30) });
    tx = r.txRef;
    await svc.confirmPayment(await svc.findPaymentByTxRef(tx), noQueue);
    const [d] = await q('SELECT d.is_demo FROM donations d JOIN payments p ON p.id = d.payment_id WHERE p.tx_ref = $1', [tx]);
    assert.equal(d.is_demo, true);
    await assert.rejects(svc.startCheckout({ providerName: 'chapa', purpose: { kind: 'wallet_topup', price: 100 }, donorTelegramId: DONOR }), /cannot top up/);
  } finally {
    process.env.CHAPA_SECRET_KEY = ENV.CHAPA_SECRET_KEY;
  }
});

test('expired checkout paid late still fulfils; sweep expires stale ones', opts, async () => {
  let tx;
  mockFetch(async (u) => (u.includes('/initialize')
    ? { json: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/z' } } }
    : { json: { status: 'success', data: { status: 'pending', tx_ref: tx } } }));
  const r = await svc.startCheckout({ providerName: 'chapa', purpose: purpose(30) });
  tx = r.txRef;
  await q(`UPDATE payments SET created_at = NOW() - INTERVAL '3 hours' WHERE tx_ref = $1`, [tx]);
  const sweep = await svc.sweepPendingPayments();
  assert.ok(sweep.expired >= 1);
  assert.equal((await svc.findPaymentByTxRef(tx)).status, 'expired');

  mockFetch(async () => ({ json: { status: 'success', data: { status: 'success', tx_ref: tx, amount: '30', currency: 'ETB' } } }));
  assert.equal(await svc.confirmPayment(await svc.findPaymentByTxRef(tx), noQueue), 'paid');
});

// --- HTTP: public checkout + demo gateway, end to end --------------------------------------
test('HTTP: donate page → demo pay page → return status', opts, async () => {
  const { default: publicRoutes } = await import('../routes/public.js');
  const { demoPayRouter, webhookRouter } = await import('../routes/payments.js');
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/payments/webhook', webhookRouter);
  app.use('/pay/demo', express.urlencoded({ extended: false }), demoPayRouter);
  app.use(express.json());
  app.use('/api/public', publicRoutes);
  const queued = [];
  donations.setFulfilDeps({ enqueue: async (n, data) => { queued.push(data); }, io: () => null });
  const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const opt = await (await realFetch(`${base}/api/public/payment-options`)).json();
    assert.deepEqual(opt.providers.map((p) => p.name).sort(), ['arifpay', 'chapa', 'demo']);
    assert.equal(opt.platformFeePercent, 10);

    const dir = await (await realFetch(`${base}/api/public/streamers`)).json();
    const listed = dir.streamers.find((s) => s.slug === 'paystreamer');
    assert.ok(listed && listed.live === true && listed.name === 'Pay Streamer');
    assert.ok(!/telegram_id|link_uuid|balance|room-pay|api_key|phone/.test(JSON.stringify(dir)), 'directory leaks nothing private');
    const prof = await (await realFetch(`${base}/api/public/streamers/PayStreamer`)).json();
    assert.equal(prof.streamer.tts.basePrice, 20);
    assert.ok(prof.streamer.tts.voices.some((v) => v.voice === 'am-ET-Wavenet-A'));
    assert.ok(!/telegram_id|link_uuid|balance|room-pay|blocked/.test(JSON.stringify(prof)));
    assert.equal((await realFetch(`${base}/api/public/streamers/no_such_one`)).status, 404);
    assert.equal((await realFetch(`${base}/api/public/streamers/..%2F..`)).status, 404);

    const base1 = { slug: 'paystreamer', kind: 'tts', donorName: 'Abel', provider: 'demo', message: 'selam meh friend' };
    // global word rejects
    let res = await post('/api/public/checkout', { ...base1, message: 'you badword' });
    assert.equal(res.status, 400);
    // unknown voice rejects
    res = await post('/api/public/checkout', { ...base1, voice: 'xx' });
    assert.equal(res.status, 400);
    // extra fields rejected (strict)
    res = await post('/api/public/checkout', { ...base1, price: 1 });
    assert.equal(res.status, 400);
    // unknown streamer
    res = await post('/api/public/checkout', { ...base1, slug: 'nobody_here' });
    assert.equal(res.status, 404);

    res = await post('/api/public/checkout', base1);
    assert.equal(res.status, 200);
    const out = await res.json();
    assert.equal(out.price, 20);
    assert.match(out.redirectUrl, /^https:\/\/api\.example\/pay\/demo\/ht-[0-9a-f]{24}$/);
    const tx = out.redirectUrl.split('/').pop();

    const [stored] = await q('SELECT purpose FROM payments WHERE tx_ref = $1', [tx]);
    assert.equal(stored.purpose.message, 'selam *** friend', 'streamer word masked');

    const page = await realFetch(`${base}/pay/demo/${tx}`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.ok(html.includes('DEMO') && html.includes('20.00 ETB'));

    let status = await (await realFetch(`${base}/api/public/payments/${tx}`)).json();
    assert.equal(status.status, 'pending');
    assert.equal(status.isDemo, true);

    const done = await realFetch(`${base}/pay/demo/${tx}`, { method: 'POST', redirect: 'manual' });
    assert.equal(done.status, 303);
    assert.equal(done.headers.get('location'), `https://app.example/donate/return?tx=${tx}`);

    status = await (await realFetch(`${base}/api/public/payments/${tx}`)).json();
    assert.equal(status.status, 'paid');
    assert.equal(status.streamer.slug, 'paystreamer');
    assert.equal(status.donation.status, 'queued');
    assert.equal(queued.length, 1);
    assert.equal(queued[0].fundedBy, 'payment');
    assert.ok(!queued[0].spokenText.includes('meh'), 'masked word not spoken');
    assert.ok(!('balance' in status) && !JSON.stringify(status).includes('room-pay'), 'no private fields');

    assert.equal((await realFetch(`${base}/api/public/payments/not-a-ref`)).status, 404);

    // streamer offline
    await q('UPDATE users SET live_status = FALSE WHERE telegram_id = $1', [STREAMER]);
    res = await post('/api/public/checkout', base1);
    assert.equal(res.status, 409);
    await q('UPDATE users SET live_status = TRUE WHERE telegram_id = $1', [STREAMER]);

    // unsigned chapa webhook is ignored but answered 200
    res = await realFetch(`${base}/api/payments/webhook/chapa`, { method: 'POST', body: '{"tx_ref":"ht-000000000000000000000000"}' });
    assert.equal(res.status, 200);
    res = await realFetch(`${base}/api/payments/webhook/demo`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('streamer identity: API key or session token, only for their own room', opts, async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const { authorizeStreamer } = await import('../utils/streamerIdentity.js');
  const { default: jwt } = await import('jsonwebtoken');
  await q("UPDATE users SET api_key = 'key-123', link_uuid = '11111111-2222-3333-4444-555555555555' WHERE telegram_id = $1", [STREAMER]);
  const uuid = '11111111-2222-3333-4444-555555555555';
  assert.equal(await authorizeStreamer({ uuid, apiKey: 'key-123' }), String(STREAMER));
  assert.equal(await authorizeStreamer({ uuid, apiKey: 'nope' }), null);
  const good = jwt.sign({ telegram_id: STREAMER, role: 'streamer' }, process.env.JWT_SECRET);
  const other = jwt.sign({ telegram_id: DONOR, role: 'streamer' }, process.env.JWT_SECRET);
  assert.equal(await authorizeStreamer({ uuid, token: good }), String(STREAMER));
  assert.equal(await authorizeStreamer({ uuid, cookieHeader: `x=1; authToken=${good}` }), String(STREAMER));
  assert.equal(await authorizeStreamer({ uuid, token: other }), null);
  assert.equal(await authorizeStreamer({ uuid: 'not a uuid', apiKey: 'key-123' }), null);
  await q("UPDATE users SET link_uuid = 'room-pay' WHERE telegram_id = $1", [STREAMER]);
});

test('signed Telegram file URLs', opts, async () => {
  const { signedTelegramFileUrl, verifySignedFile } = await import('../utils/telegramFiles.js');
  const u = new URL(signedTelegramFileUrl('AgACAgQAAxkBAAIB'));
  assert.ok(!u.href.includes('api.telegram.org'));
  const id = decodeURIComponent(u.pathname.split('/').pop());
  assert.equal(verifySignedFile(id, u.searchParams.get('exp'), u.searchParams.get('sig')), true);
  assert.equal(verifySignedFile('AgACAgQAAxkBAAIC', u.searchParams.get('exp'), u.searchParams.get('sig')), false);
  assert.equal(verifySignedFile(id, '1000000000', u.searchParams.get('sig')), false, 'expired');
  assert.equal(signedTelegramFileUrl('../etc/passwd'), null);
});

test('teardown', opts, async () => {
  globalThis.fetch = realFetch;
  await db.end();
});
