import db from '../db-postgres.js';

const parseBoolean = (value) => {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

export const isLedgerDualWriteEnabled = () => parseBoolean(process.env.LEDGER_DUAL_WRITE);
export const isLedgerReadEnabled = () => parseBoolean(process.env.LEDGER_READ_ENABLED);
export const shouldLedgerReadFallback = () => {
  const raw = process.env.LEDGER_READ_FALLBACK;
  return raw === undefined ? true : parseBoolean(raw);
};

const runQuery = (client, text, params) => {
  if (client && typeof client.query === 'function') {
    return client.query(text, params);
  }
  return db.query(text, params);
};

const normalizeAmount = (value) => {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid ledger amount: ${value}`);
  }
  return Number(amount.toFixed(2));
};

const legacyBalanceSql = `
  SELECT
    COALESCE((SELECT SUM(amount)::numeric(10,2)
              FROM donations
              WHERE streamer_id = $1 AND status = 'paid'), 0) -
    COALESCE((SELECT SUM(amount)::numeric(10,2)
              FROM withdrawals
              WHERE user_id = $1 AND status = 'approved'), 0) AS balance
`;

const ledgerBalanceSql = `
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)::numeric(10,2) AS balance
  FROM ledger_entries
  WHERE user_telegram_id = $1
`;

const toNumber = (value) => Number.parseFloat(value ?? 0) || 0;

export async function getLegacyBalance(streamerId, { client } = {}) {
  const { rows } = await runQuery(client, legacyBalanceSql, [streamerId]);
  return toNumber(rows?.[0]?.balance);
}

export async function getLedgerBalance(streamerId, { client } = {}) {
  const { rows } = await runQuery(client, ledgerBalanceSql, [streamerId]);
  return toNumber(rows?.[0]?.balance);
}

export async function getStreamerBalance(streamerId, { client } = {}) {
  if (isLedgerReadEnabled()) {
    try {
      return await getLedgerBalance(streamerId, { client });
    } catch (error) {
      if (!shouldLedgerReadFallback()) {
        throw error;
      }
      console.error(`[Ledger] Read failed for streamer ${streamerId}, falling back to legacy calculation:`, error);
    }
  }
  return getLegacyBalance(streamerId, { client });
}

export async function insertLedgerEntry({
  client,
  userTelegramId,
  refType,
  refId,
  entryType,
  amount,
  description,
  createdAt,
  idempotencyKey,
}) {
  if (!isLedgerDualWriteEnabled()) {
    return;
  }

  const normalizedAmount = normalizeAmount(amount);
  const params = [
    userTelegramId,
    refType,
    refId,
    entryType,
    normalizedAmount,
    description ?? null,
    idempotencyKey ?? null,
    createdAt ?? new Date(),
  ];

  try {
    await runQuery(client, `
      INSERT INTO ledger_entries (user_telegram_id, ref_type, ref_id, entry_type, amount, description, idempotency_key, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (ref_type, ref_id, entry_type) DO NOTHING
    `, params);
  } catch (error) {
    if (error?.code === '23505') {
      console.warn(`[Ledger] Duplicate entry skipped for ${refType}:${refId}:${entryType}`);
      return;
    }
    throw error;
  }
}
