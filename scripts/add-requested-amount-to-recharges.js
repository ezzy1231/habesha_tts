import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function addRequestedAmountColumn() {
  const client = await pool.connect();
  try {
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'recharges' AND column_name = 'requested_amount'
    `);

    if (checkResult.rows.length === 0) {
      await client.query(`
        ALTER TABLE recharges 
        ADD COLUMN requested_amount INTEGER DEFAULT NULL
      `);
      console.log('✅ Column "requested_amount" added to recharges table.');
    } else {
      console.log('ℹ️ Column "requested_amount" already exists.');
    }
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addRequestedAmountColumn();
