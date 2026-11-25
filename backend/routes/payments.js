import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db-postgres.js';
import { getProvider } from '../payments/index.js';
import {
  confirmPayment, findPaymentByTxRef, completeDemoPayment, markPaymentFailed,
} from '../services/payments.js';

// ---------------------------------------------------------------------------
// Provider webhooks / callbacks: /api/payments/webhook/:provider
// Mounted before express.json() so signatures can be checked on the raw body.
// A webhook is only a hint: the payment is always verified with the provider's API.
// ---------------------------------------------------------------------------
export const webhookRouter = express.Router();

const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

async function findPaymentForHint(provider, body) {
  const txRef = provider.txRefFromWebhook?.(body);
  if (txRef) return findPaymentByTxRef(txRef);
  const providerRef = provider.providerRefFromWebhook?.(body);
  if (providerRef) {
    const { rows } = await db.query('SELECT * FROM payments WHERE provider = $1 AND provider_ref = $2', [provider.name, String(providerRef)]);
    return rows[0] || null;
  }
  return null;
}

async function handleHint(req, res, body, rawBody) {
  const provider = getProvider(req.params.provider);
  if (!provider || provider.name === 'demo') return res.sendStatus(404);
  try {
    // Chapa: when a webhook secret is configured, unsigned POSTs are ignored.
    if (req.method === 'POST' && provider.name === 'chapa' && process.env.CHAPA_WEBHOOK_SECRET
        && !provider.verifyWebhook({ rawBody, headers: req.headers })) {
      console.warn('[payments] chapa webhook with bad signature ignored');
      return res.sendStatus(200);
    }
    const payment = await findPaymentForHint(provider, body);
    if (payment && payment.provider === provider.name) {
      const status = await confirmPayment(payment);
      console.log(`[payments] ${provider.name} hint for ${payment.tx_ref}: ${status}`);
    }
  } catch (error) {
    console.error(`[payments] ${provider.name} webhook error:`, error.message);
    return res.sendStatus(500); // let the provider retry
  }
  return res.sendStatus(200);
}

webhookRouter.post('/:provider', webhookLimiter, express.raw({ type: '*/*', limit: '64kb' }), (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  let body = {};
  const text = rawBody.toString('utf8');
  try { body = text ? JSON.parse(text) : {}; } catch { body = Object.fromEntries(new URLSearchParams(text)); }
  return handleHint(req, res, body, rawBody);
});

// Chapa calls callback_url with GET ?trx_ref=...&status=...
webhookRouter.get('/:provider', webhookLimiter, (req, res) => handleHint(req, res, req.query || {}, Buffer.from('')));

// ---------------------------------------------------------------------------
// Demo gateway page: /pay/demo/:txRef
// ---------------------------------------------------------------------------
export const demoPayRouter = express.Router();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KIND_LABEL = { tts: 'TTS message', sound: 'Soundboard', media: 'Media share', wallet_topup: 'Wallet top-up' };

demoPayRouter.get('/:txRef', async (req, res) => {
  const payment = await findPaymentByTxRef(req.params.txRef).catch(() => null);
  if (!payment || payment.provider !== 'demo') return res.status(404).send('Not found');
  const p = payment.purpose || {};
  const done = payment.status !== 'pending';
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  res.set('Cache-Control', 'no-store');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo payment · Habesha TTS</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f0d;color:#e9f0ec;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
  .card{width:min(420px,92vw);background:#141b17;border:1px solid #24302a;border-radius:16px;padding:28px}
  .flag{height:4px;border-radius:4px;background:linear-gradient(90deg,#078930 33%,#fcdd09 33% 66%,#da121a 66%);margin-bottom:20px}
  .badge{display:inline-block;background:#fcdd09;color:#111;font-weight:700;font-size:12px;letter-spacing:.08em;padding:3px 8px;border-radius:6px}
  h1{font-size:20px;margin:12px 0 4px} .muted{color:#9fb0a7;font-size:14px}
  .amount{font-size:36px;font-weight:800;margin:18px 0} dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 22px;font-size:14px}
  dt{color:#9fb0a7} dd{margin:0;word-break:break-word}
  button{width:100%;padding:14px;border-radius:10px;border:0;font-size:16px;font-weight:700;cursor:pointer}
  .pay{background:#078930;color:#fff} .cancel{background:transparent;color:#9fb0a7;margin-top:8px}
</style></head><body><main class="card">
<div class="flag"></div><span class="badge">DEMO</span>
<h1>Demo payment</h1><p class="muted">No real money moves. The donation plays on stream marked DEMO and never counts toward the streamer's balance.</p>
<div class="amount">${esc(Number(payment.amount).toFixed(2))} ${esc(payment.currency)}</div>
<dl><dt>For</dt><dd>${esc(KIND_LABEL[p.kind] || 'Donation')}</dd><dt>From</dt><dd>${esc(p.donorName || payment.donor_name || '—')}</dd>
${p.message ? `<dt>Message</dt><dd>${esc(p.message)}</dd>` : ''}${p.soundLabel ? `<dt>Sound</dt><dd>${esc(p.soundLabel)}</dd>` : ''}</dl>
${done ? `<p class="muted">This payment is already ${esc(payment.status)}.</p><a href="${esc(payment.return_url)}" style="color:#fcdd09">Continue</a>`
    : `<form method="post" action="/pay/demo/${esc(payment.tx_ref)}"><button class="pay" type="submit">Complete demo payment</button></form>
<form method="post" action="/pay/demo/${esc(payment.tx_ref)}/cancel"><button class="cancel" type="submit">Cancel</button></form>`}
</main></body></html>`);
});

const demoLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

demoPayRouter.post('/:txRef', demoLimiter, async (req, res) => {
  try {
    const payment = await completeDemoPayment(req.params.txRef);
    if (!payment) return res.status(404).send('Not found');
    return res.redirect(303, payment.return_url);
  } catch (error) {
    console.error('[payments] demo completion failed:', error.message);
    return res.status(500).send('Demo payment failed');
  }
});

demoPayRouter.post('/:txRef/cancel', demoLimiter, async (req, res) => {
  const payment = await findPaymentByTxRef(req.params.txRef).catch(() => null);
  if (!payment || payment.provider !== 'demo') return res.status(404).send('Not found');
  await markPaymentFailed(payment.id, 'failed', { demo: true, cancelled: true }).catch(() => {});
  return res.redirect(303, payment.return_url);
});
