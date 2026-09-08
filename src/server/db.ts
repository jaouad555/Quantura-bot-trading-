import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bot_database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
export const initDb = () => {
  // Table for Key-Value store (settings, API keys, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Table for Trade History
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id TEXT PRIMARY KEY,
      symbol TEXT,
      type TEXT,
      side TEXT,
      price REAL,
      amount REAL,
      timestamp INTEGER,
      pnl REAL,
      status TEXT
    )
  `);
  
  // Table for Active Positions
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_positions (
      id TEXT PRIMARY KEY,
      symbol TEXT,
      entryPrice REAL,
      size REAL,
      side TEXT,
      leverage INTEGER,
      margin REAL,
      unrealizedPnl REAL,
      timestamp INTEGER
    )
  `);
  console.log('Local SQLite Database initialized at:', dbPath);
};

// Helper for Key-Value store (Async wrapper to match the previous API)
export const kv = {
  get: async (key: string): Promise<string | null> => {
    const stmt = db.prepare('SELECT value FROM kv_store WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },
  getAll: async (): Promise<Record<string, string>> => {
    const stmt = db.prepare('SELECT key, value FROM kv_store');
    const rows = stmt.all() as { key: string, value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },
  set: async (key: string, value: string): Promise<void> => {
    const stmt = db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
    stmt.run(key, value, value);
  },
  delete: async (key: string): Promise<void> => {
    const stmt = db.prepare('DELETE FROM kv_store WHERE key = ?');
    stmt.run(key);
  },
  clear: async (): Promise<void> => {
    const stmt = db.prepare('DELETE FROM kv_store');
    stmt.run();
  }
};

export default db;
