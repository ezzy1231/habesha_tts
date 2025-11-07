import db from '../backend/db-postgres.js';

const createTables = async () => {
  console.log('Initializing database schema...');
  console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
  try {
    // Drop tables with CASCADE to handle dependencies automatically
    // await db.query(`DROP TABLE IF EXISTS withdrawals CASCADE;`);
    // await db.query(`DROP TABLE IF EXISTS donations CASCADE;`);
    // await db.query(`DROP TABLE IF EXISTS recharges CASCADE;`);
    // await db.query(`DROP TABLE IF EXISTS settings CASCADE;`);
    // await db.query(`DROP TABLE IF EXISTS users CASCADE;`);
    // console.log('Existing tables dropped.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        display_name VARCHAR(255),
        role TEXT NOT NULL CHECK (role IN ('admin', 'streamer', 'donor')),
        balance NUMERIC(10, 2) DEFAULT 0.00,
        link_uuid TEXT UNIQUE,
        api_key TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" created or already exists.');

    // Add new columns for streamer registration to users table if they don't exist
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS social_link TEXT;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_file_id TEXT;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'approved';`);
    console.log('Columns for streamer registration added to "users" table.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        streamer_id BIGINT NOT NULL,
        donor_id BIGINT,
        donor_name VARCHAR(255),
        amount INTEGER NOT NULL,
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending_payment',
        played BOOLEAN DEFAULT FALSE,
        audio_file VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (streamer_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
        FOREIGN KEY (donor_id) REFERENCES users(telegram_id) ON DELETE CASCADE
      );
    `);
    console.log('Table "donations" created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount INTEGER NOT NULL,
        telebirr_username TEXT,
        phone_number TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
      );
    `);
    console.log('Table "withdrawals" created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS recharges (
        id SERIAL PRIMARY KEY,
        donor_id BIGINT NOT NULL,
        name_on_payment TEXT,
        screenshot_file_id TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        amount NUMERIC(10, 2),
        FOREIGN KEY (donor_id) REFERENCES users(telegram_id) ON DELETE CASCADE
      );
    `);
    console.log('Table "recharges" created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log('Table "settings" created or already exists.');

    // Insert default settings
    await db.query("INSERT INTO settings (key, value) VALUES ('maxChars', '600'), ('stepChars', '30'), ('basePrice', '20'), ('incrementPrice', '10') ON CONFLICT (key) DO NOTHING;");
    console.log('Default settings inserted.');

    console.log('Database schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing database schema:', err);
  } finally {
    await db.end(); // Ensure the pool is closed
  }
};

createTables();