// Demo gateway: a hosted "pay" page on our backend. Demo donations play on stream like real ones,
// are labelled DEMO and never count toward balances, withdrawals or wallet top-ups.
export const name = 'demo';
export const label = 'Demo (no real money)';
export const currencies = ['ETB', 'USD'];
export const isConfigured = () => String(process.env.PAYMENTS_DEMO_ENABLED).toLowerCase() === 'true';
export const isTestMode = () => true;

const backendBase = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');

export async function createCheckout({ txRef }) {
  return { checkoutUrl: `${backendBase()}/pay/demo/${encodeURIComponent(txRef)}`, providerRef: txRef };
}

// Demo payments are completed by the demo page itself, never by polling.
export async function verify() {
  return { status: 'pending', raw: { demo: true } };
}

export const verifyWebhook = () => false;
export const txRefFromWebhook = () => null;
