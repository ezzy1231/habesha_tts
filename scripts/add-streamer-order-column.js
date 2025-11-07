
import db from '../backend/db-postgres.js';

const addColumn = async () => {
  console.log('Applying database migration: Add streamer_order column...');
  try {
    // Add the streamer_order column to the users table if it doesn't exist.
    // SERIAL will automatically create an integer column and populate existing rows with a unique sequence.
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS streamer_order SERIAL;
    `);
    
    console.log('✅ Migration successful: "streamer_order" column added to "users" table or already exists.');
  } catch (err) {
    console.error('❌ Error applying migration:', err);
  } finally {
    await db.end(); // Ensure the pool is closed
  }
};

addColumn();
