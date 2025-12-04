import db from '../db-postgres.js';
import { sendTelegramAlert } from './telegramAlert.js';

const DEFAULT_ADMIN_RECIPIENTS = [
  { telegramId: '1863182826', username: 'Lie_ed' },
];

const ADMIN_ALERT_RECIPIENTS = buildAdminRecipients();

const ALERT_BUILDERS = {
  streamer_live_status: async (payload = {}) => {
    const {
      streamerId,
      liveStatus,
      reason,
      triggeredBy,
      liveSince,
      lastLivePing,
    } = payload;
    const streamer = await fetchUserSummary(streamerId);
    const statusLabel = liveStatus ? '🟢 LIVE' : '⚫️ OFFLINE';
    return formatAlertMessage([
      '🎬 Streamer Live Status',
      streamerId ? `Streamer: ${describeUser(streamer, streamerId)}` : null,
      `Status: ${statusLabel}`,
      reason ? `Reason: ${reason}` : null,
      triggeredBy ? `Triggered by: ${triggeredBy}` : null,
      liveSince ? `Live since: ${formatTimestamp(liveSince)}` : null,
      lastLivePing ? `Last heartbeat: ${formatTimestamp(lastLivePing)}` : null,
    ]);
  },
  streamer_request_created: async (payload = {}) => {
    const {
      fullName,
      username,
      telegramId,
      phoneNumber,
    } = payload;

    return formatAlertMessage([
      '🚨 New Streamer Request',
      fullName ? `Name: ${fullName}` : null,
      username ? `Username: @${username}` : null,
      telegramId ? `Telegram ID: ${telegramId}` : null,
      phoneNumber ? `Phone: ${phoneNumber}` : null,
      'Review: Admin → Streamer Requests',
    ]);
  },
  streamer_request_updated: async (payload = {}) => {
    const { status, telegramId } = payload;
    return formatAlertMessage([
      'ℹ️ Streamer Request Updated',
      status ? `Status: ${status}` : null,
      telegramId ? `Telegram ID: ${telegramId}` : null,
    ]);
  },
  withdrawal_created: async (payload = {}) => {
    const { withdrawalId, streamerId, amount } = payload;
    const streamer = await fetchUserSummary(streamerId);
    return formatAlertMessage([
      '📥 New Withdrawal Request',
      amount !== undefined ? `Amount: ${formatBirr(amount)}` : null,
      `Streamer: ${describeUser(streamer, streamerId)}`,
      withdrawalId ? `Request ID: ${withdrawalId}` : null,
      'Review: Admin → Withdrawals',
    ]);
  },
  withdrawal_updated: async (payload = {}) => {
    const { withdrawalId, streamerId, status, amount } = payload;
    const streamer = await fetchUserSummary(streamerId);
    return formatAlertMessage([
      '🔁 Withdrawal Updated',
      status ? `Status: ${status}` : null,
      amount !== undefined ? `Amount: ${formatBirr(amount)}` : null,
      `Streamer: ${describeUser(streamer, streamerId)}`,
      withdrawalId ? `Request ID: ${withdrawalId}` : null,
    ]);
  },
  recharge_created: async (payload = {}) => {
    const { rechargeId, donorId, nameOnPayment, requestedAmount } = payload;
    const donor = await fetchUserSummary(donorId);
    return formatAlertMessage([
      '⚡ New Recharge Request',
      requestedAmount !== undefined && requestedAmount !== null
        ? `Requested: ${formatBirr(requestedAmount)}`
        : null,
      nameOnPayment ? `Payment Name: ${nameOnPayment}` : null,
      `Donor: ${describeUser(donor, donorId)}`,
      rechargeId ? `Request ID: ${rechargeId}` : null,
      'Review: Admin → Recharges',
    ]);
  },
  recharge_updated: async (payload = {}) => {
    const { rechargeId, status, amount, donorId } = payload;
    const donor = await fetchUserSummary(donorId);
    return formatAlertMessage([
      '🔁 Recharge Updated',
      status ? `Status: ${status}` : null,
      amount !== undefined && amount !== null ? `Amount: ${formatBirr(amount)}` : null,
      `Donor: ${describeUser(donor, donorId)}`,
      rechargeId ? `Request ID: ${rechargeId}` : null,
    ]);
  },
  donor_flag_created: async (payload = {}) => {
    const { donationId, streamerId, donorId, actionLabel, reason } = payload;
    const streamer = await fetchUserSummary(streamerId);
    const donor = await fetchUserSummary(donorId);
    return formatAlertMessage([
      '🚩 New Donation Flag',
      actionLabel ? `Action: ${actionLabel}` : null,
      reason ? `Reason: ${reason}` : null,
      `Streamer: ${describeUser(streamer, streamerId)}`,
      donorId ? `Donor: ${describeUser(donor, donorId)}` : null,
      donationId ? `Donation ID: ${donationId}` : null,
      'Review: Admin → Donor Flags',
    ]);
  },
  donor_flag_updated: async (payload = {}) => {
    const { id, status, action, streamerId, donorId } = payload;
    const streamer = await fetchUserSummary(streamerId);
    const donor = await fetchUserSummary(donorId);
    return formatAlertMessage([
      'ℹ️ Donation Flag Updated',
      id ? `Flag ID: ${id}` : null,
      action ? `Action: ${action}` : null,
      status ? `Status: ${status}` : null,
      `Streamer: ${describeUser(streamer, streamerId)}`,
      donorId ? `Donor: ${describeUser(donor, donorId)}` : null,
    ]);
  },
};

function buildAdminRecipients() {
  const configured = (process.env.ADMIN_ALERT_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ({ telegramId: id }));

  const merged = [...DEFAULT_ADMIN_RECIPIENTS, ...configured];
  const seen = new Set();
  const deduped = [];
  for (const recipient of merged) {
    if (!recipient.telegramId || seen.has(recipient.telegramId)) continue;
    seen.add(recipient.telegramId);
    deduped.push(recipient);
  }
  return deduped;
}

function formatAlertMessage(lines) {
  const message = lines.filter(Boolean).join('\n');
  return message || null;
}

function formatBirr(amount) {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return String(amount ?? 'N/A');
  }
  return `Br ${numeric.toFixed(2)}`;
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB', { hour12: false });
}

async function fetchUserSummary(telegramId) {
  if (!telegramId) return null;
  try {
    const res = await db.query(
      'SELECT telegram_id, username, display_name, full_name FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return res.rows[0] || null;
  } catch (error) {
    console.error(`[AdminNotify] Failed to fetch user ${telegramId}:`, error.message || error);
    return null;
  }
}

function describeUser(user, fallbackId) {
  if (!user) {
    return fallbackId ? `ID ${fallbackId}` : 'Unknown user';
  }

  const parts = [];
  if (user.display_name) parts.push(user.display_name);
  if (user.username) parts.push(`@${user.username}`);
  parts.push(`ID ${user.telegram_id}`);
  return parts.join(' · ');
}

function forwardAdminAlerts(event) {
  const builder = ALERT_BUILDERS[event.type];
  if (!builder || ADMIN_ALERT_RECIPIENTS.length === 0) {
    return;
  }

  (async () => {
    try {
      const message = await builder(event.payload || {});
      if (!message) return;

      await Promise.all(
        ADMIN_ALERT_RECIPIENTS.map((recipient) =>
          sendTelegramAlert(recipient.telegramId, message)
        )
      );
    } catch (error) {
      console.error('[AdminNotify] Failed to forward admin alert:', error);
    }
  })();
}

export function emitAdminEvent(type, payload = {}) {
  if (!type) {
    console.warn('[AdminNotify] Missing event type, skipping emit.');
    return;
  }

  const event = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (!global.socketIO) {
    console.warn(`[AdminNotify] socketIO not initialized. Event "${type}" was not emitted.`);
  } else {
    try {
      global.socketIO.to('admin').emit('admin_update', event);
    } catch (error) {
      console.error('[AdminNotify] Failed to emit admin event:', error);
    }
  }

  forwardAdminAlerts(event);
}
