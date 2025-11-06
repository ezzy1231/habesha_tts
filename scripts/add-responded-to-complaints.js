import db from '../backend/db-postgres.js';

async function addRespondedToComplaints() {
  const query = `
    ALTER TABLE complaints
    ADD COLUMN responded BOOLEAN DEFAULT FALSE;
  `;

  try {
    await db.query(query);
    console.log('Successfully added "responded" column to "complaints" table.');
  } catch (err) {
    // Ignore errors if the column already exists
    if (err.code === '42701') {
      console.log('Column "responded" already exists in "complaints" table.');
    } else {
      console.error('Error adding "responded" column to "complaints" table:', err);
    }
  } finally {
    await db.end();
  }
}

addRespondedToComplaints();
