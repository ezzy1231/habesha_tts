-- Website accounts: sign in through the Telegram bot, and pay donations from the Telegram wallet.

-- One row per website sign-in attempt. The website gets the nonce; the bot binds it to the
-- Telegram user who opened t.me/<bot>?start=login_<nonce> and sends them a 6-digit code.
-- Only hashes are stored.
CREATE TABLE IF NOT EXISTS web_login_requests (
  id SERIAL PRIMARY KEY,
  nonce_hash TEXT NOT NULL UNIQUE,
  telegram_id BIGINT,
  code_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS web_login_requests_expires_idx ON web_login_requests (expires_at);

-- Donations paid from the donor's wallet balance on the website.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('chapa','arifpay','demo','credit','wallet'));

-- Where a complaint came from (Telegram bot or website).
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'telegram';
