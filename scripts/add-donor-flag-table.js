import db from '../backend/db-postgres.js';

async function addDonorFlagTable() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS donor_flag_requests (
      id SERIAL PRIMARY KEY,
      donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      streamer_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      donor_id BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL,
      action VARCHAR(32) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      resolution_notes TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_donor_flag_requests_donation ON donor_flag_requests(donation_id);`,
    `CREATE INDEX IF NOT EXISTS idx_donor_flag_requests_streamer ON donor_flag_requests(streamer_id);`,
    `CREATE INDEX IF NOT EXISTS idx_donor_flag_requests_status ON donor_flag_requests(status);`
  ];

  try {
    for (const query of queries) {
      await db.query(query);
    }
    console.log('✅ donor_flag_requests table ready.');
  } catch (error) {
    console.error('❌ Failed to ensure donor_flag_requests table:', error);
  } finally {
    await db.end();
  }
}

addDonorFlagTable();
