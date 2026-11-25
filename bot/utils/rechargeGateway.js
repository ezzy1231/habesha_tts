// Wallet top-up through Chapa / Arifpay from the bot. The manual Telebirr screenshot flow stays
// as a fallback, and is the only option when no live gateway is configured.
import { enabledProviders } from '../../backend/payments/index.js';
import { startCheckout, CheckoutError } from '../../backend/services/payments.js';

export const MIN_TOPUP = 10;
export const MAX_TOPUP = 20000;

/** Real-money gateways only: test keys and the demo gateway can't top up a wallet. */
export const liveGateways = () => enabledProviders().filter((p) => !p.test && p.name !== 'demo');

/**
 * Ask how to pay for a top-up of `amount`. Returns false when no gateway is configured,
 * so the caller continues with the manual flow.
 */
export async function offerRechargeMethods(bot, chatId, amount) {
  const gateways = liveGateways();
  if (!gateways.length) return false;
  const rows = gateways.map((g) => [{ text: `💳 በ ${g.label} ይክፈሉ`, callback_data: `rpay_${g.name}_${amount}` }]);
  rows.push([{ text: '📸 ቴሌብር (ስክሪንሾት)', callback_data: `rpay_manual_${amount}` }]);
  await bot.sendMessage(chatId, `✅ ${amount} ብር ተመርጧል።\n\nየመክፈያ ዘዴ ይምረጡ:`, { reply_markup: { inline_keyboard: rows } });
  return true;
}

/** Create the checkout and send the pay link. */
export async function sendGatewayLink(bot, chatId, { provider, amount, tgId, donorName }) {
  try {
    const { redirectUrl } = await startCheckout({
      providerName: provider,
      purpose: { kind: 'wallet_topup', price: amount },
      donorTelegramId: tgId,
      donorName: donorName || null,
      description: 'Wallet top-up',
    });
    await bot.sendMessage(chatId, `💳 ${amount} ብር ለመሙላት ከታች ያለውን ይጫኑ። ክፍያው እንደተረጋገጠ Wallet ይሞላል።`, {
      reply_markup: { inline_keyboard: [[{ text: '➡️ ክፈል', url: redirectUrl }]] },
    });
  } catch (error) {
    const msg = error instanceof CheckoutError ? error.message : 'unexpected error';
    console.error(`[Bot] gateway top-up failed for ${tgId}:`, msg);
    await bot.sendMessage(chatId, '❌ ክፍያው ሊጀመር አልቻለም። እባክዎ እንደገና ይሞክሩ ወይም በቴሌብር ስክሪንሾት ይሙሉ።');
  }
}
