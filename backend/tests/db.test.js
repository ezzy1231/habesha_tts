// Database tests. Run against a throwaway Postgres only:
//   TEST_DATABASE_URL=postgres://... node --test backend/tests/db.test.js
// Skipped when TEST_DATABASE_URL is not set. Tests run in order and share state.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: !url && 'TEST_DATABASE_URL not set', concurrency: false };

let db, runMigrations, settleDonation, balance, donations;
const STREAMER = 9000000001;
const DONOR = 9000000002;
const STREAMER_GONE = 9000000003;

const q = async (sql, params) => (await db.query(sql, params)).rows;
const userBalance = async (tg) => Number((await q('SELECT balance FROM users WHERE telegram_id=$1', [tg]))[0].balance);

async function withTx(fn) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function newDonation({ amount, isDemo = false, donor = DONOR, status = 'pending_payment' }) {
  const [row] = await q(
    `INSERT INTO donations (streamer_id, donor_id, amount, message, status, is_demo)
     VALUES ($1, $2, $3, 'test', $4, $5) RETURNING id`, [STREAMER, donor, amount, status, isDemo]);
  return row.id;
}

async function newPayment({ provider = 'chapa', amount, purpose, donorTelegramId = null }) {
  const id = crypto.randomUUID();
  await q(`INSERT INTO payments (id, provider, tx_ref, amount, purpose, donor_telegram_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
  [id, provider, `tx-${id}`, amount, JSON.stringify(purpose), donorTelegramId]);
  return id;
}

test('setup: migrations and seed', opts, async () => {
  process.env.DATABASE_URL = url;
  ({ default: db } = await import('../db-postgres.js'));
  ({ runMigrations } = await import('../migrations/index.js'));
  ({ settleDonation } = await import('../services/settlement.js'));
  balance = await import('../utils/balance.js');
  donations = await import('../services/donations.js');

  // users.notification_sound defaults to 'default_ping', which must exist for the FK
  await q(`INSERT INTO notification_sounds (id, label, file_path)
           VALUES ('default_ping', 'Default', '/public/sounds/notification.mp3') ON CONFLICT DO NOTHING`);
  await runMigrations({ log: { log() {} } });
  assert.deepEqual(await runMigrations({ log: { log() {} } }), [], 'second run applies nothing');

  await q('DELETE FROM donations WHERE streamer_id = ANY($1)', [[STREAMER, STREAMER_GONE]]);
  await q('DELETE FROM withdrawals WHERE user_id = $1', [STREAMER]);
  await q('DELETE FROM users WHERE telegram_id = ANY($1)', [[STREAMER, DONOR]]);
  await q(`INSERT INTO users (telegram_id, username, role, balance, link_uuid)
           VALUES ($1, 'teststreamer', 'streamer', 0, 'room-test'), ($2, 'testdonor', 'donor', 1000, NULL)`,
  [STREAMER, DONOR]);
  const [{ value }] = await q("SELECT value FROM settings WHERE key = 'platformFeePercent'");
  assert.equal(value, '10');
});

test('wallet donation: donor pays gross, streamer gets 90%, once', opts, async () => {
  const id = await newDonation({ amount: 50 });
  const r = await withTx((c) => settleDonation(c, {
    donationId: id, price: 50, audioFile: 'a.mp3', fundedBy: 'wallet', donorTelegramId: DONOR, streamerTelegramId: STREAMER,
  }));
  assert.equal(r.already, false);
  assert.equal(r.fee, 5);
  assert.equal(r.net, 45);
  assert.equal(r.newDonorBalance, 950);
  assert.equal(await userBalance(STREAMER), 45);
  const [d] = await q('SELECT status, platform_fee, net_amount, audio_file FROM donations WHERE id=$1', [id]);
  assert.deepEqual([d.status, Number(d.platform_fee), Number(d.net_amount), d.audio_file], ['paid', 5, 45, 'a.mp3']);

  const again = await withTx((c) => settleDonation(c, {
    donationId: id, price: 50, fundedBy: 'wallet', donorTelegramId: DONOR, streamerTelegramId: STREAMER,
  }));
  assert.equal(again.already, true);
  assert.equal(await userBalance(DONOR), 950, 'not debited twice');
});

test('payment-funded donation does not touch the donor wallet', opts, async () => {
  const id = await newDonation({ amount: 100 });
  await withTx((c) => settleDonation(c, {
    donationId: id, price: 100, fundedBy: 'payment', donorTelegramId: DONOR, streamerTelegramId: STREAMER,
  }));
  assert.equal(await userBalance(DONOR), 950);
  assert.equal(await userBalance(STREAMER), 135);
});

test('demo donation credits nothing and is excluded from balance', opts, async () => {
  const before = await balance.getStreamerBalance(STREAMER);
  const id = await newDonation({ amount: 500, isDemo: true });
  const r = await withTx((c) => settleDonation(c, {
    donationId: id, price: 500, fundedBy: 'payment', streamerTelegramId: STREAMER,
  }));
  assert.equal(r.isDemo, true);
  assert.equal(r.net, 0);
  assert.equal(await userBalance(STREAMER), 135);
  assert.equal(await balance.getStreamerBalance(STREAMER), before);
});

test('balance = net earnings (old donations in full) minus approved withdrawals', opts, async () => {
  // 45 + 90 from above; add a pre-fee donation of 20 with no net_amount
  await q(`INSERT INTO donations (streamer_id, donor_id, amount, status) VALUES ($1, $2, 20, 'paid')`, [STREAMER, DONOR]);
  assert.equal(await balance.getStreamerBalance(STREAMER), 155);

  await q(`INSERT INTO withdrawals (user_id, amount, status) VALUES ($1, 50, 'approved'), ($1, 30, 'pending'), ($1, 999, 'rejected')`, [STREAMER]);
  assert.equal(await balance.getStreamerBalance(STREAMER), 105, 'approved only');
  assert.equal(await balance.getAvailableBalance(STREAMER), 75, 'pending withdrawals reserved');
});

test('fulfilPayment (tts): one donation, queued with fundedBy=payment, idempotent', opts, async () => {
  const jobs = [];
  const pid = await newPayment({
    amount: 30,
    purpose: { kind: 'tts', streamerId: STREAMER, donorName: 'Selam', message: 'ሰላም <b>', engine: 'cloud', voice: 'am-ET-Wavenet-A', price: 30 },
  });
  const r = await donations.fulfilPayment(pid, { amountEtb: 30, raw: { ok: true } }, {
    enqueue: async (name, data, o) => { jobs.push({ name, data, o }); },
    io: () => null,
  });
  assert.equal(r.kind, 'tts');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].data.fundedBy, 'payment');
  assert.equal(jobs[0].data.tgId, null);
  assert.equal(jobs[0].o.jobId, `donation_${r.donation.id}`);
  assert.ok(jobs[0].data.spokenText.includes('&lt;b&gt;'));
  const [d] = await q('SELECT status, kind, source, payment_id, is_demo FROM donations WHERE id=$1', [r.donation.id]);
  assert.deepEqual([d.status, d.kind, d.source, d.payment_id, d.is_demo], ['queued', 'tts', 'web', pid, false]);

  const again = await donations.fulfilPayment(pid, {}, { enqueue: async () => jobs.push('dup'), io: () => null });
  assert.equal(again.already, true);
  assert.equal(jobs.length, 1);
  const [p] = await q('SELECT status, amount_etb FROM payments WHERE id=$1', [pid]);
  assert.deepEqual([p.status, Number(p.amount_etb)], ['paid', 30]);
});

test('fulfilPayment (sound): paid at once, net credited, overlay notified', opts, async () => {
  const events = [];
  const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
  const before = await userBalance(STREAMER);
  const pid = await newPayment({
    amount: 20,
    purpose: { kind: 'sound', streamerId: STREAMER, donorName: 'Abel', soundId: 1, soundLabel: 'Airhorn', soundUrl: 'https://x/airhorn.mp3', price: 20 },
  });
  const r = await donations.fulfilPayment(pid, {}, { enqueue: async () => assert.fail('no TTS for sounds'), io: () => io });
  const [d] = await q('SELECT status, net_amount, audio_file FROM donations WHERE id=$1', [r.donation.id]);
  assert.deepEqual([d.status, Number(d.net_amount), d.audio_file], ['paid', 18, 'https://x/airhorn.mp3']);
  assert.equal(await userBalance(STREAMER), before + 18);
  assert.deepEqual(events.map((e) => `${e.room}:${e.ev}`).sort(), ['admin:new_donation', 'room-test:new_donation']);
  assert.equal(events[0].payload.kind, 'sound');
});

test('fulfilPayment (media) waits for approval; rejection becomes a claim code', opts, async () => {
  const events = [];
  const io = { to: (room) => ({ emit: (ev) => events.push(`${room}:${ev}`) }) };
  const before = await balance.getStreamerBalance(STREAMER);
  const pid = await newPayment({
    amount: 100,
    purpose: { kind: 'media', streamerId: STREAMER, donorName: 'Hana', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ', mediaStart: 5, price: 100 },
  });
  const r = await donations.fulfilPayment(pid, {}, { enqueue: async () => {}, io: () => io });
  assert.ok(events.includes('room-test:media_request'));
  const [d] = await q('SELECT status, media_status FROM donations WHERE id=$1', [r.donation.id]);
  assert.deepEqual([d.status, d.media_status], ['awaiting_approval', 'pending']);
  assert.equal(await balance.getStreamerBalance(STREAMER), before, 'nothing earned before approval');

  const refund = await withTx((c) => donations.refundDonationAsCredit(c, r.donation.id, 'media_rejected'));
  assert.equal(refund.type, 'code');
  assert.equal(refund.amount, 100);
  const [p] = await q('SELECT claim_code FROM payments WHERE id=$1', [pid]);
  assert.equal(p.claim_code, refund.code);
  const [d2] = await q('SELECT status, media_status FROM donations WHERE id=$1', [r.donation.id]);
  assert.deepEqual([d2.status, d2.media_status], ['refunded', 'rejected']);
  const twice = await withTx((c) => donations.refundDonationAsCredit(c, r.donation.id, 'media_rejected'));
  assert.equal(twice.already, true);

  // Spend part of it, give some back, look it up with sloppy typing
  assert.equal(await donations.getCreditBalance(refund.code.toLowerCase()), 100);
  const used = await withTx((c) => donations.redeemCredit(c, refund.code, 30));
  assert.equal(used.applied, 30);
  const capped = await withTx((c) => donations.redeemCredit(c, refund.code, 500));
  assert.equal(capped.applied, 70);
  await withTx((c) => donations.releaseCredit(c, capped.creditId, 70));
  assert.equal(await donations.getCreditBalance(refund.code), 70);
  assert.equal(await donations.getCreditBalance('HT-AAAAA-AAAAA'), null);
});

test('refund for a Telegram donor goes back to their wallet', opts, async () => {
  const id = await newDonation({ amount: 40, status: 'awaiting_approval' });
  const before = await userBalance(DONOR);
  const notified = [];
  const r = await donations.failPaidDonation(id, 'media_rejected', { notify: async (...a) => notified.push(a) });
  assert.equal(r.type, 'wallet');
  assert.equal(await userBalance(DONOR), before + 40);
  assert.equal(notified.length, 1);
  assert.equal(Number(notified[0][0]), DONOR);
  assert.equal(notified[0][1], 40);
});

test('demo payments: shown but never real money', opts, async () => {
  const before = await userBalance(DONOR);
  const topup = await newPayment({ provider: 'demo', amount: 500, donorTelegramId: DONOR, purpose: { kind: 'wallet_topup' } });
  await donations.fulfilPayment(topup, {}, { io: () => null, notifyTopup: async () => assert.fail('no notice for demo') });
  assert.equal(await userBalance(DONOR), before, 'demo top-up adds nothing');

  const pid = await newPayment({
    provider: 'demo', amount: 100,
    purpose: { kind: 'media', streamerId: STREAMER, donorName: 'Demo', mediaUrl: 'https://youtu.be/x', price: 100 },
  });
  const r = await donations.fulfilPayment(pid, {}, { io: () => null });
  assert.equal(r.donation.is_demo, true);
  const refund = await withTx((c) => donations.refundDonationAsCredit(c, r.donation.id, 'media_rejected'));
  assert.equal(refund.type, 'none', 'no credit for demo money');
});

test('real top-up credits the wallet and records a recharge', opts, async () => {
  const before = await userBalance(DONOR);
  const pid = await newPayment({ amount: 200, donorTelegramId: DONOR, purpose: { kind: 'wallet_topup' } });
  const told = [];
  await donations.fulfilPayment(pid, { amountEtb: 200 }, { io: () => null, notifyTopup: async (x) => told.push(x) });
  assert.equal(told.length, 1);
  assert.equal(await userBalance(DONOR), before + 200);
  const rows = await q(`SELECT status, amount FROM recharges WHERE donor_id=$1 AND name_on_payment=$2`, [DONOR, `chapa:tx-${pid}`]);
  assert.deepEqual(rows.map((r) => [r.status, Number(r.amount)]), [['approved', 200]]);
});

test('payment for a streamer who no longer exists is refunded as credit', opts, async () => {
  const pid = await newPayment({
    amount: 30,
    purpose: { kind: 'tts', streamerId: STREAMER_GONE, donorName: 'X', message: 'hi', engine: 'cloud', voice: 'am-ET-Wavenet-A', price: 30 },
  });
  const r = await donations.fulfilPayment(pid, {}, { enqueue: async () => assert.fail('must not enqueue'), io: () => null });
  assert.equal(r.refund.type, 'code');
});

test('streamer settings row is created on first use', opts, async () => {
  const { getStreamerSettings } = await import('../utils/streamerSettings.js');
  await q('DELETE FROM streamer_settings WHERE streamer_id=$1', [STREAMER]);
  const s = await getStreamerSettings(STREAMER);
  assert.match(s.public_slug, /^streamer-\d+$/);
  assert.equal(s.overlay.theme, 'habesha');
  assert.equal((await getStreamerSettings(STREAMER)).public_slug, s.public_slug);
  assert.equal(await getStreamerSettings(DONOR), null, 'donors get no row');
});

test('teardown', opts, async () => {
  await db.end();
});
