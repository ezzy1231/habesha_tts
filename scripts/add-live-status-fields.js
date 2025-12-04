import db from '../backend/db-postgres.js';

async function addLiveStatusFields() {
  console.log('🔄 Adding live status columns to users table...');
  const alterQuery = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS live_status BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS live_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_live_ping TIMESTAMPTZ;
  `;

  try {
    await db.query(alterQuery);
    await db.query(`
      UPDATE users
         SET live_status = COALESCE(live_status, FALSE),
             live_since = NULL,
             last_live_ping = NULL
       WHERE role = 'streamer';
    `);
    console.log('✅ Live status columns ensured on users table.');
  } catch (error) {
    console.error('❌ Failed to add live status columns:', error.message || error);
  } finally {
    await db.end();
  }
}

addLiveStatusFields();
