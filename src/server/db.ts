import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: DatabaseSync;
try {
  const dbPath = path.join(dataDir, 'bot_database.sqlite');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
} catch (error) {
  console.error("CRITICAL: Failed to initialize SQLite database:", error);
  // Fallback to in-memory to prevent crash
  db = new DatabaseSync(':memory:');
}

export const initDb = () => {
  // Initialize schema
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

  console.log('Local SQLite Database initialized successfully using node:sqlite');
};

// Helper for Key-Value store (Async wrapper)
export const kv = {
  get: async (key: string): Promise<string | null> => {
    if (!db) return null;
    const stmt = db.prepare('SELECT value FROM kv_store WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },
  getAll: async (): Promise<Record<string, string>> => {
    if (!db) return {};
    const stmt = db.prepare('SELECT key, value FROM kv_store');
    const rows = stmt.all() as { key: string, value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },
  set: async (key: string, value: string): Promise<void> => {
    if (!db) return;
    const stmt = db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
    stmt.run(key, value, value);
  },
  delete: async (key: string): Promise<void> => {
    if (!db) return;
    const stmt = db.prepare('DELETE FROM kv_store WHERE key = ?');
    stmt.run(key);
  },
  clear: async (): Promise<void> => {
    if (!db) return;
    const stmt = db.prepare('DELETE FROM kv_store');
    stmt.run();
  }
};

export default db;
