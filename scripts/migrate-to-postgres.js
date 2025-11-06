
import db from '../src/db-postgres.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oldDbPath = path.join(__dirname, '..', 'tts_donation_db.json');

const migrateData = async () => {
  try {
    const rawData = fs.readFileSync(oldDbPath, 'utf8');
    const oldData = JSON.parse(rawData);

    const userIdToTelegramIdMap = {};
    for (const user of oldData.users) {
      userIdToTelegramIdMap[user.id] = user.telegram_id;
      const streamer = oldData.streamers.find(s => s.user_id === user.id);
      await db.query(
        'INSERT INTO users (telegram_id, username, role, balance, created_at, link_uuid) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (telegram_id) DO NOTHING',
        [user.telegram_id, user.username, user.role, user.balance, user.created_at, streamer ? streamer.link_uuid : null]
      );
    }
    console.log('Users migrated.');

    console.log('userIdToTelegramIdMap:', userIdToTelegramIdMap);

    // Migrate donations
    for (const donation of oldData.donations) {
      const streamerTelegramId = userIdToTelegramIdMap[donation.streamer_id];
      const donorTelegramId = donation.donor_id ? userIdToTelegramIdMap[donation.donor_id] : null;

      await db.query(
        'INSERT INTO donations (id, streamer_id, donor_id, donor_name, amount, message, played, audio_file, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
        [donation.id, streamerTelegramId, donorTelegramId, donation.donor_name, donation.amount, donation.message, donation.played, donation.audio_file, donation.created_at]
      );
    }
    console.log('Donations migrated.');

    // Migrate withdrawals
    for (const withdrawal of oldData.withdrawals) {
      const userTelegramId = userIdToTelegramIdMap[withdrawal.streamer_id];
      if (!userTelegramId) {
        console.warn(`Skipping withdrawal ID ${withdrawal.id}: User with ID ${withdrawal.user_id} not found.`);
        continue; // Skip this withdrawal if user_id is not found
      }
      await db.query(
        'INSERT INTO withdrawals (id, user_id, amount, status, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [withdrawal.id, userTelegramId, withdrawal.amount, withdrawal.status, withdrawal.created_at]
      );
    }
    console.log('Withdrawals migrated.');

    // After migrating data, reset the sequences for SERIAL columns to the max existing ID
    await db.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));");
    await db.query("SELECT setval(pg_get_serial_sequence('donations', 'id'), COALESCE((SELECT MAX(id) FROM donations), 1));");
    await db.query("SELECT setval(pg_get_serial_sequence('withdrawals', 'id'), COALESCE((SELECT MAX(id) FROM withdrawals), 1));");
    console.log('Database sequences updated.');

    console.log('Data migration complete.');
  } catch (err) {
    console.error('Error migrating data:', err);
  }
};

migrateData();
