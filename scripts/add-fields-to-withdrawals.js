import db from '../backend/db-postgres.js';

async function addFieldsToWithdrawals() {
  console.log('Adding telebirr_username and phone_number to withdrawals table...');
  try {
    await db.query(`
      ALTER TABLE withdrawals
      ADD COLUMN telebirr_username VARCHAR(255),
      ADD COLUMN phone_number VARCHAR(255);
    `);
    console.log('✅ Columns added successfully.');
  } catch (error) {
    if (error.message.includes('column "telebirr_username" of relation "withdrawals" already exists')) {
      console.log('⚠️ Columns already exist, skipping.');
    } else {
      console.error('Error adding columns to withdrawals table:', error);
      throw error;
    }
  }
}

async function migrate() {
  try {
    await addFieldsToWithdrawals();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
    console.log('Database connection closed.');
  }
}

migrate();
