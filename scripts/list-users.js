import db from '../src/db-postgres.js';
import dotenv from 'dotenv';

dotenv.config();

async function listUsers() {
  console.log('Listing users from database...');
  console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
  try {
    const res = await db.query("SELECT telegram_id, username, display_name, role, balance FROM users");
    if (res.rows.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log('Users in database:');
      console.table(res.rows);
    }
  } catch (error) {
    console.error('Error listing users:', error.message, error.stack);
  } finally {
    await db.end(); // Ensure the pool is closed
  }
}

listUsers();