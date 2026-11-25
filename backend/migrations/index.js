import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db-postgres.js';

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK_KEY = 7419001; // pg_advisory_lock key: one runner at a time across instances

/**
 * Apply every `NNN_name.sql` in this folder that has not been applied yet, in order.
 * Each file runs in its own transaction. Safe to call on every startup.
 */
export async function runMigrations({ log = console } = {}) {
  const client = await db.getClient();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

    const ran = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran.push(file);
        log.log(`[migrations] applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`[migrations] ${file} failed: ${error.message}`);
      }
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}
