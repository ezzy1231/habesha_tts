import db from '../backend/db-postgres.js';

async function createComplaintsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      complaint TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await db.query(query);
    console.log('Successfully created "complaints" table.');
  } catch (err) {
    console.error('Error creating "complaints" table:', err);
  } finally {
    // Ensure the connection pool is closed
    await db.end();
  }
}

createComplaintsTable();
