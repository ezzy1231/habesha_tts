import { getPricingSettings, splitFee } from '../utils/pricing.js';

/**
 * Mark a donation paid and move the money, inside the caller's transaction.
 *
 * fundedBy 'wallet'  - Telegram donor: their wallet balance is debited by the gross price.
 * fundedBy 'payment' - already paid through a gateway: no wallet debit.
 * The streamer is credited the net (gross minus platform fee). Demo donations credit nothing.
 *
 * Idempotent: a donation that is already 'paid' is left alone.
 * @returns {Promise<{already: true} | {already: false, isDemo: boolean, fee: number, net: number, newDonorBalance: number|null}>}
 */
export async function settleDonation(client, {
  donationId, price, audioFile = null, fundedBy = 'wallet', donorTelegramId = null, streamerTelegramId,
}) {
  if (!['wallet', 'payment'].includes(fundedBy)) throw new Error(`Unknown fundedBy: ${fundedBy}`);
  const { platformFeePercent } = await getPricingSettings({ client });
  const { fee, net } = splitFee(price, platformFeePercent);

  const updated = await client.query(`
    UPDATE donations
       SET status = 'paid',
           amount = $1,
           audio_file = COALESCE($2, audio_file),
           platform_fee = CASE WHEN is_demo THEN 0 ELSE $4::numeric END,
           net_amount   = CASE WHEN is_demo THEN 0 ELSE $5::numeric END
     WHERE id = $3 AND status IS DISTINCT FROM 'paid'
     RETURNING is_demo`,
    [price, audioFile, donationId, fee, net]);

  if (updated.rowCount === 0) return { already: true };
  const isDemo = Boolean(updated.rows[0].is_demo);

  let newDonorBalance = null;
  if (fundedBy === 'wallet' && donorTelegramId) {
    const donor = await client.query(
      'UPDATE users SET balance = balance - $1 WHERE telegram_id = $2 RETURNING balance',
      [price, donorTelegramId]);
    newDonorBalance = Number(donor.rows[0]?.balance ?? 0);
  }
  if (!isDemo && net > 0) {
    await client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2', [net, streamerTelegramId]);
  }
  return { already: false, isDemo, fee: isDemo ? 0 : fee, net: isDemo ? 0 : net, newDonorBalance };
}
