import * as chapa from './chapa.js';
import * as arifpay from './arifpay.js';
import * as demo from './demo.js';

const ALL = { chapa, arifpay, demo };

/** Sandbox/test keys must never move real balances: such payments are treated as demo. */
export function isTestMode(provider) {
  if (provider.name === 'demo') return true;
  if (provider.name === 'chapa') return /^CHASECK_TEST/i.test(process.env.CHAPA_SECRET_KEY || '');
  if (provider.name === 'arifpay') return String(process.env.ARIFPAY_SANDBOX).toLowerCase() === 'true';
  return false;
}

export function getProvider(name) {
  const p = ALL[name];
  return p && p.isConfigured() ? p : null;
}

/** Providers donors can choose right now, for the donate page. */
export function enabledProviders() {
  return Object.values(ALL)
    .filter((p) => p.isConfigured())
    .map((p) => ({ name: p.name, label: p.label, currencies: p.currencies, test: isTestMode(p) }));
}

export { ALL as providers };
