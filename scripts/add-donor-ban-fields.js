import db from '../backend/db-postgres.js';

async function addDonorBanFields() {
  const queries = [
    `ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS ban_reason TEXT,
      ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS banned_by TEXT;`,
    `CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);`,
    `CREATE INDEX IF NOT EXISTS idx_users_ban_expires_at ON users(ban_expires_at) WHERE is_banned = TRUE;`
  ];

  try {
    for (const query of queries) {
      await db.query(query);
    }
    console.log('✅ Donor ban fields added/verified.');
  } catch (error) {
    console.error('❌ Failed adding donor ban fields:', error);
  } finally {
    await db.end();
  }
}

addDonorBanFields();
