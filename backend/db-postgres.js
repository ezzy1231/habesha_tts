
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', client => {
  console.log('[DB Pool] Client connected');
});

pool.on('error', (err, client) => {
  console.error('[DB Pool] Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('remove', client => {
  console.log('[DB Pool] Client removed');
});

export default {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
};
