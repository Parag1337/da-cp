import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '../../data/chainscope.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  network TEXT NOT NULL,
  source TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 1,
  seed INTEGER,
  address_count INTEGER DEFAULT 0,
  transfer_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  manifest TEXT
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  UNIQUE(network,address)
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number INTEGER,
  timestamp INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  value_raw TEXT NOT NULL,
  asset TEXT NOT NULL,
  UNIQUE(network,tx_hash)
);
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER DEFAULT 0,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  value_raw TEXT NOT NULL,
  asset TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  UNIQUE(network,tx_hash,log_index)
);
CREATE TABLE IF NOT EXISTS investigations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS investigation_addresses (
  investigation_id INTEGER NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  PRIMARY KEY(investigation_id,address)
);
CREATE TABLE IF NOT EXISTS investigation_transactions (
  investigation_id INTEGER NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL,
  PRIMARY KEY(investigation_id,tx_hash)
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  addresses TEXT NOT NULL,
  tx_hashes TEXT NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigation_id INTEGER REFERENCES investigations(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(network,from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(network,to_address);
CREATE INDEX IF NOT EXISTS idx_tr_from ON transfers(network,from_address);
CREATE INDEX IF NOT EXISTS idx_tr_to ON transfers(network,to_address);
`);

try { db.exec('ALTER TABLE investigations ADD COLUMN status TEXT NOT NULL DEFAULT \'open\''); } catch {}
export const NETWORK = 'ethereum-demo';
export const DEMO_PROVIDER = 'demo-synthetic';