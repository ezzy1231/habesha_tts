import db from '../backend/db-postgres.js';

const ADMIN_USER = {
  telegramId: '1863182826',
  username: 'Lie_ed',
  displayName: 'Lie_ed',
  fullName: 'Lie_ed',
};

async function ensureAdminUser() {
  console.log('🔐 Ensuring notification admin user exists...');
  const upsertSql = `
    INSERT INTO users (telegram_id, username, display_name, full_name, role, registration_status)
    VALUES ($1, $2, $3, $4, 'admin', 'approved')
    ON CONFLICT (telegram_id) DO UPDATE
      SET role = 'admin',
          username = EXCLUDED.username,
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          full_name = COALESCE(EXCLUDED.full_name, users.full_name),
          registration_status = 'approved'
    RETURNING id, telegram_id, username, role;
  `;

  const values = [
    ADMIN_USER.telegramId,
    ADMIN_USER.username,
    ADMIN_USER.displayName,
    ADMIN_USER.fullName,
  ];

  try {
    const res = await db.query(upsertSql, values);
    const [row] = res.rows;
    console.log('✅ Admin user ensured:', row);
  } catch (error) {
    console.error('❌ Failed to ensure admin user:', error);
    throw error;
  }
}

ensureAdminUser()
  .catch(() => process.exit(1))
  .finally(() => db.end());
