import db from "../backend/db-postgres.js";

async function addPhoneNumberColumn() {
  try {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN phone_number TEXT;
    `);
    console.log("✅ Added 'phone_number' column to 'users' table.");
  } catch (error) {
    if (error.code === '42P07' || error.message.includes('already exists')) {
      console.warn("⚠️ 'phone_number' column already exists. Skipping migration.");
    } else {
      console.error("❌ Error adding 'phone_number' column:", error);
      process.exit(1);
    }
  } finally {
    await db.end();
  }
}

addPhoneNumberColumn();