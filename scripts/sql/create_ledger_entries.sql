-- Ledger table for auditable balances
-- NOTE: Run this outside of a transaction if you also run indexes CONCURRENTLY below.

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id                   bigserial PRIMARY KEY,
    user_telegram_id     bigint      NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    ref_type             text        NOT NULL CHECK (ref_type IN ('donation','withdrawal','adjustment','recharge')),
    ref_id               bigint      NOT NULL,
    entry_type           text        NOT NULL CHECK (entry_type IN ('credit','debit')),
    amount               numeric(10,2) NOT NULL CHECK (amount > 0),
    currency             char(3)     NOT NULL DEFAULT 'ETB',
    description          text,
    idempotency_key      text, -- optional: provide for external idempotency guarantees
    created_at           timestamptz NOT NULL DEFAULT now(),

    -- Ensure single logical ledger row per business record and type (e.g., one credit per donation)
    CONSTRAINT ledger_entries_uniq_ref UNIQUE (ref_type, ref_id, entry_type)
);

-- Optional uniqueness if you supply idempotency keys from the app layer
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_idempotency_key
ON public.ledger_entries (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Core lookup/summarization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_user_created
ON public.ledger_entries (user_telegram_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_user_entry_type_created
ON public.ledger_entries (user_telegram_id, entry_type, created_at DESC);

-- Helpful partials when summing credits vs debits
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_user_credit_created
ON public.ledger_entries (user_telegram_id, created_at DESC)
WHERE entry_type = 'credit';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_user_debit_created
ON public.ledger_entries (user_telegram_id, created_at DESC)
WHERE entry_type = 'debit';

-- Example: materialized balance view (optional, commented out)
-- CREATE MATERIALIZED VIEW public.mv_user_balances AS
-- SELECT user_telegram_id,
--        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0::numeric) AS balance
-- FROM public.ledger_entries
-- GROUP BY user_telegram_id;
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS mv_user_balances_user_key ON public.mv_user_balances(user_telegram_id);
-- -- To refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_balances;
