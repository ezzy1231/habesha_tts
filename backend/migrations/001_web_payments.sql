-- Web donations, payments, soundboard, media share, analytics, platform fee.
-- Idempotent: safe to run on databases that already have some of these objects.

-- Columns other scripts added historically; ensure they exist so later queries are safe.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS live_status BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_live_ping TIMESTAMPTZ;

-- Donations: kind, source, fee split, demo flag, payment link, sound/media details
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'tts',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_id UUID,
  ADD COLUMN IF NOT EXISTS sound_id INTEGER,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_start_s INTEGER,
  ADD COLUMN IF NOT EXISTS media_status TEXT;

DO $$ BEGIN
  ALTER TABLE donations ADD CONSTRAINT donations_kind_check CHECK (kind IN ('tts','sound','media'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE donations ADD CONSTRAINT donations_source_check CHECK (source IN ('telegram','web'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE donations ADD CONSTRAINT donations_media_status_check
    CHECK (media_status IS NULL OR media_status IN ('pending','approved','rejected','played'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payments through a gateway (or the demo gateway)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('chapa','arifpay','demo','credit')),
  tx_ref TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  amount_etb NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  purpose JSONB NOT NULL,
  donor_name TEXT,
  donor_telegram_id BIGINT,
  credit_code_id INTEGER,
  credit_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
  checkout_url TEXT,
  claim_code TEXT,           -- shown to the web donor when their payment becomes wallet credit
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (status, created_at);

-- Per-streamer settings
CREATE TABLE IF NOT EXISTS streamer_settings (
  streamer_id BIGINT PRIMARY KEY,
  public_slug TEXT UNIQUE,
  min_tts_amount INTEGER NOT NULL DEFAULT 0,
  blocked_words JSONB NOT NULL DEFAULT '[]'::jsonb,
  overlay JSONB NOT NULL DEFAULT '{}'::jsonb,
  soundboard_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  media_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  media_min_amount INTEGER NOT NULL DEFAULT 100,
  media_max_seconds INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Soundboard: streamer_id NULL = global library managed by admin
CREATE TABLE IF NOT EXISTS sounds (
  id SERIAL PRIMARY KEY,
  streamer_id BIGINT,
  label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 20 CHECK (price > 0),
  cooldown_s INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_s >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sounds_streamer_idx ON sounds (streamer_id);

-- A streamer's price/enable override for a global sound
CREATE TABLE IF NOT EXISTS streamer_sounds (
  streamer_id BIGINT NOT NULL,
  sound_id INTEGER NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  price INTEGER CHECK (price IS NULL OR price > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (streamer_id, sound_id)
);

-- Wallet credit for web viewers (e.g. rejected media share), redeemed with a claim code
CREATE TABLE IF NOT EXISTS wallet_credits (
  id SERIAL PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  remaining NUMERIC(12,2) NOT NULL CHECK (remaining >= 0),
  reason TEXT,
  source_donation_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Stream sessions for analytics
CREATE TABLE IF NOT EXISTS stream_sessions (
  id SERIAL PRIMARY KEY,
  streamer_id BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS stream_sessions_streamer_idx ON stream_sessions (streamer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS donations_streamer_kind_created_idx ON donations (streamer_id, kind, created_at DESC);

-- Platform fee setting (10%)
INSERT INTO settings (key, value) VALUES ('platformFeePercent', '10')
ON CONFLICT (key) DO NOTHING;

-- One settings row per streamer, with a URL slug from username/full name
-- Collisions get the users.id appended, so the unique constraint can never fail.
WITH base AS (
  SELECT u.id, u.telegram_id,
         regexp_replace(lower(COALESCE(u.username, '')), '[^a-z0-9_]+', '', 'g') AS slug
    FROM users u
   WHERE u.role = 'streamer'
     AND NOT EXISTS (SELECT 1 FROM streamer_settings s WHERE s.streamer_id = u.telegram_id)
), ranked AS (
  SELECT id, telegram_id, slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
    FROM base
)
INSERT INTO streamer_settings (streamer_id, public_slug)
SELECT r.telegram_id,
       CASE
         WHEN length(r.slug) < 3 OR r.rn > 1
              OR EXISTS (SELECT 1 FROM streamer_settings s WHERE s.public_slug = r.slug)
           THEN 'streamer-' || r.id::text  -- '-' never appears in a Telegram username
         ELSE r.slug
       END
  FROM ranked r
ON CONFLICT (streamer_id) DO NOTHING;
