# Ledger Migration (Dual-Write + Safe Read Switch)

This plan introduces an auditable `ledger_entries` table to derive streamer balances from immutable credits/debits. It avoids breaking existing behavior by rolling out in stages with feature flags, backfill, parity checks, and a reversible switch.

## Overview

- Write path (dual-write):
  - On donation payment → insert one credit ledger entry for the streamer.
  - On withdrawal approval → insert one debit ledger entry for the streamer.
- Read path: Initially unchanged (legacy sum of donations-paid minus withdrawals-approved). Later, switch reads to ledger under a flag.
- Backfill: Create ledger entries for historic records.
- Parity: Compare ledger-derived balances to legacy-derived balances per user and investigate deltas.

## Prereqs (run once)

1) Create performance indexes (optional but recommended before read switch):
   - `scripts/sql/add_performance_indexes.sql`
2) Create ledger table and indexes:
   - `scripts/sql/create_ledger_entries.sql`

> Important: Statements with `CREATE INDEX CONCURRENTLY` must run outside a transaction block.

## Feature flags (backend env)

- `LEDGER_DUAL_WRITE=true|false` (default: false)
  - When true, app writes ledger entries in addition to current writes.
- `LEDGER_READ_ENABLED=true|false` (default: false)
  - When true, app computes balances using the ledger instead of legacy queries.
- `LEDGER_READ_FALLBACK=true|false` (default: true)
  - When true and a ledger read fails, fall back to legacy computation (and log).

## Backfill SQL (one-time)

Run after creating the table, before enabling `LEDGER_READ_ENABLED`.

```sql
-- Backfill credits from PAID donations
INSERT INTO public.ledger_entries (
  user_telegram_id, ref_type, ref_id, entry_type, amount, description, created_at
)
SELECT
  d.streamer_id,
  'donation'::text,
  d.id::bigint,
  'credit'::text,
  d.amount::numeric(10,2),
  'Backfill from donations',
  d.created_at
FROM public.donations d
WHERE d.status = 'paid'
ON CONFLICT (ref_type, ref_id, entry_type) DO NOTHING;

-- Backfill debits from APPROVED withdrawals
INSERT INTO public.ledger_entries (
  user_telegram_id, ref_type, ref_id, entry_type, amount, description, created_at
)
SELECT
  w.user_id,
  'withdrawal'::text,
  w.id::bigint,
  'debit'::text,
  w.amount::numeric(10,2),
  'Backfill from withdrawals',
  w.created_at
FROM public.withdrawals w
WHERE w.status = 'approved'
ON CONFLICT (ref_type, ref_id, entry_type) DO NOTHING;
```

## Parity checks (spot differences)

- Compute ledger balance per user:

```sql
-- Per-user (single)
SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS ledger_balance
FROM public.ledger_entries
WHERE user_telegram_id = $1;
```

- Compare ledger vs legacy across streamers and show only mismatches beyond 0.01 ETB:

```sql
WITH ledger AS (
  SELECT user_telegram_id,
         COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0::numeric) AS ledger_balance
  FROM public.ledger_entries
  GROUP BY user_telegram_id
), legacy AS (
  SELECT u.telegram_id AS user_telegram_id,
         (
           COALESCE((SELECT SUM(d.amount)::numeric(10,2)
                     FROM public.donations d
                     WHERE d.streamer_id = u.telegram_id AND d.status='paid'), 0::numeric)
           -
           COALESCE((SELECT SUM(w.amount)::numeric(10,2)
                     FROM public.withdrawals w
                     WHERE w.user_id = u.telegram_id AND w.status='approved'), 0::numeric)
         ) AS legacy_balance
  FROM public.users u
  WHERE u.role = 'streamer'
)
SELECT u.telegram_id, u.username,
       COALESCE(l.ledger_balance, 0) AS ledger_balance,
       COALESCE(g.legacy_balance, 0) AS legacy_balance,
       COALESCE(l.ledger_balance, 0) - COALESCE(g.legacy_balance, 0) AS delta
FROM public.users u
LEFT JOIN ledger l ON l.user_telegram_id = u.telegram_id
LEFT JOIN legacy g ON g.user_telegram_id = u.telegram_id
WHERE u.role = 'streamer'
  AND ABS(COALESCE(l.ledger_balance, 0) - COALESCE(g.legacy_balance, 0)) > 0.01
ORDER BY ABS(COALESCE(l.ledger_balance, 0) - COALESCE(g.legacy_balance, 0)) DESC;
```

## App changes (dual-write points)

1) Donation payment confirmation (e.g., `backend/routes/payment.js`):
   - After marking the donation `status='paid'`, and only if `LEDGER_DUAL_WRITE=true`, insert credit:

```sql
INSERT INTO public.ledger_entries (user_telegram_id, ref_type, ref_id, entry_type, amount, description, created_at)
VALUES ($streamerId, 'donation', $donationId, 'credit', $amount::numeric(10,2), 'Donation paid', $createdAt)
ON CONFLICT (ref_type, ref_id, entry_type) DO NOTHING;
```

2) Withdrawal approval (e.g., `backend/routes/admin.js`):
   - When changing `status` to `approved`, and only if `LEDGER_DUAL_WRITE=true`, insert debit:

```sql
INSERT INTO public.ledger_entries (user_telegram_id, ref_type, ref_id, entry_type, amount, description, created_at)
VALUES ($userId, 'withdrawal', $withdrawalId, 'debit', $amount::numeric(10,2), 'Withdrawal approved', $createdAt)
ON CONFLICT (ref_type, ref_id, entry_type) DO NOTHING;
```

> Tip: For idempotency in code, also pass an `idempotency_key` (e.g., `${refType}:${refId}:${entryType}`) and handle conflicts gracefully.

## Read switch (non-breaking)

- Keep legacy balance calculations as-is initially.
- Add a helper method (e.g., `backend/utils/balance.js`) that:
  - If `LEDGER_READ_ENABLED=true`: query ledger sum `SUM(CASE WHEN credit THEN +amount ELSE -amount END)`.
  - Else: use legacy sum of donations-paid minus withdrawals-approved.
  - If ledger query fails and `LEDGER_READ_FALLBACK=true`, log the error and fall back to legacy.

Example ledger query:

```sql
SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS balance
FROM public.ledger_entries
WHERE user_telegram_id = $1;
```

## Rollout steps

1) Deploy schema changes (indexes + table).
2) Run backfill SQL.
3) Enable `LEDGER_DUAL_WRITE=true` in production.
4) Monitor: run parity checks daily; investigate any deltas.
5) When stable (no deltas), enable `LEDGER_READ_ENABLED=true`.
6) Keep `LEDGER_READ_FALLBACK=true` for a while to be safe; then consider disabling.
7) Optional clean-up: stop relying on legacy balance code and remove redundant recalculations; keep indexes for historical queries as needed.

## Rollback strategy

- If issues occur after enabling read switch: set `LEDGER_READ_ENABLED=false` (keeps dual-write on).
- If issues occur with writes: set `LEDGER_DUAL_WRITE=false` (legacy behavior remains intact). Ledger table remains for forensics.

## Notes

- Money types: `donations.amount` and `withdrawals.amount` are integer in your DB; ledger uses `numeric(10,2)`. We cast on insert to avoid precision loss if you adopt cents later.
- Indexes: the ledger indexes support both paginated history and fast balance aggregation.
- Extensions: none required.
