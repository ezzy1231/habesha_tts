import Database from "better-sqlite3";

const db = new Database("tts_donation.db");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,
  username TEXT,
  role TEXT CHECK(role IN ('streamer','donor'))
);

CREATE TABLE IF NOT EXISTS streamers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  link_uuid TEXT UNIQUE,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER,
  donor_id INTEGER,
  text TEXT,
  amount REAL,
  status TEXT,
  audio_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(streamer_id) REFERENCES streamers(id),
  FOREIGN KEY(donor_id) REFERENCES donors(id)
);
`);

export default db;