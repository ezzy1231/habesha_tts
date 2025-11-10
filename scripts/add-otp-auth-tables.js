import db from '../backend/db-postgres.js';

async function migrateOtpAuth() {
  // Using individual CREATEs for clarity and idempotency
  const queries = [
    `ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;`,
    `CREATE TABLE IF NOT EXISTS otp_tokens (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      otp VARCHAR(6) NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_otp_tokens_telegram ON otp_tokens(telegram_id);`,
    `CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);`,
    `CREATE TABLE IF NOT EXISTS login_sessions (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_login_sessions_telegram ON login_sessions(telegram_id);`,
    `CREATE INDEX IF NOT EXISTS idx_login_sessions_expires ON login_sessions(expires_at);`,
    `CREATE TABLE IF NOT EXISTS otp_audit_logs (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT,
      action VARCHAR(50),
      status VARCHAR(20),
      error_message TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_otp_audit_telegram ON otp_audit_logs(telegram_id);`,
    `CREATE INDEX IF NOT EXISTS idx_otp_audit_action ON otp_audit_logs(action);`,
    `CREATE INDEX IF NOT EXISTS idx_otp_audit_created ON otp_audit_logs(created_at);`
  ];

  try {
    for (const q of queries) {
      await db.query(q);
    }
    console.log('✅ OTP auth migration completed (tables & indexes).');
  } catch (err) {
    console.error('❌ OTP auth migration failed:', err);
  } finally {
    await db.end();
  }
}

migrateOtpAuth();
