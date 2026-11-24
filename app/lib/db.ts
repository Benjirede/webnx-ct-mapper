import Database from 'better-sqlite3';
import path from 'path';

let dbPath = process.env.DATABASE_URL;
if (!dbPath) {
  dbPath = path.resolve(__dirname, '..', '..', '..', 'webnx_floor.db');
}

// Open the database with a built-in timeout pool so it gracefully waits out local locks
const db = new Database(dbPath, { timeout: 5000 });

try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err: any) {
  // If we are currently compiling inside a Docker sandbox and hit a locked asset, print warning and continue
  if (err.code === 'SQLITE_BUSY') {
    console.warn("⚠️ Database is busy/locked by host process. Proceeding with static compilation wrapper...");
  } else {
    throw err;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS pallet_slots (
    id TEXT PRIMARY KEY,
    bay_id TEXT NOT NULL DEFAULT 'bay1',  -- Aligns database layer with frontend layout selections
    is_occupied INTEGER DEFAULT 0,
    project_id TEXT,
    notes TEXT,
    x_pos REAL NOT NULL,
    y_pos REAL NOT NULL,
    version INTEGER DEFAULT 1,
    item_type TEXT NOT NULL DEFAULT 'pallet',
    width_cells INTEGER NOT NULL DEFAULT 1,
    height_cells INTEGER NOT NULL DEFAULT 1,
    occupied_since TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pallet_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

import crypto from 'crypto';

// 1. Password Hashing & Verification Helpers (Zero external packages needed)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  return crypto.timingSafeEqual(hashBuffer, keyBuffer);
}

// 2. Initialize Users Table & Update Audit Log
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'tech',
    must_change_password INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safely add 'must_change_password' if upgrading an existing DB
try {
  db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 1;`);
} catch {
  // Column already exists
}

// Safely add 'username' column to audit_log if it doesn't exist yet
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN username TEXT DEFAULT 'system';`);
} catch {
  // Column already exists
}

// 3. Seed ONLY your Admin Account (must_change_password = 0 so test-image.sh works cleanly)
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 0)'
  ).run('admin', hashPassword('WebNXAdmin2026!'), 'supervisor');

  db.prepare("UPDATE users SET role = 'supervisor', must_change_password = 0 WHERE username = 'admin'").run();
}

// Flush old tracking states to migrate configuration rows smoothly
const currentVersion = (db.pragma('user_version', { simple: true }) as number) || 0;
if (currentVersion < 3) {
  db.transaction(() => {
    try {
      db.exec(`ALTER TABLE pallet_slots ADD COLUMN bay_id TEXT NOT NULL DEFAULT 'bay1';`);
    } catch (e) {
      // Column exists, proceed cleanly
    }
    db.pragma('user_version = 3');
  })();
}

const palletSlotColumns = new Set(
  (db.prepare('PRAGMA table_info(pallet_slots)').all() as Array<{ name: string }>).map(({ name }) => name)
);
if (
  currentVersion < 4 ||
  !palletSlotColumns.has('width_cells') ||
  !palletSlotColumns.has('height_cells')
) {
  db.transaction(() => {
    if (!palletSlotColumns.has('width_cells')) {
      db.exec('ALTER TABLE pallet_slots ADD COLUMN width_cells INTEGER NOT NULL DEFAULT 1');
    }
    if (!palletSlotColumns.has('height_cells')) {
      db.exec('ALTER TABLE pallet_slots ADD COLUMN height_cells INTEGER NOT NULL DEFAULT 1');
    }
    db.pragma('user_version = 4');
  })();
}

if (currentVersion < 5 || !palletSlotColumns.has('item_type')) {
  db.transaction(() => {
    if (!palletSlotColumns.has('item_type')) {
      db.exec("ALTER TABLE pallet_slots ADD COLUMN item_type TEXT NOT NULL DEFAULT 'pallet'");
    }
    db.pragma('user_version = 5');
  })();
}

// Re-seed factory parameters directly matching multi-bay assignments
const rowCount = db.prepare('SELECT COUNT(*) as count FROM pallet_slots').get() as { count: number };
if (!rowCount || rowCount.count === 0) {
  const insert = db.prepare(`
    INSERT INTO pallet_slots (id, bay_id, is_occupied, project_id, notes, x_pos, y_pos, version) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  
  db.transaction(() => {
    insert.run('BAY-L1', 'bay1', 1, '9842', 'Supermicro 1U chassis', 10.0, 15.0);
    insert.run('BAY-L2', 'bay1', 0, '', '', 10.0, 40.0);
    insert.run('BAY-L3', 'bay1', 0, '', '', 15.0, 65.0);
    insert.run('ISLAND-1', 'bay1', 1, '5512', 'GorillaServers AMD EPYC', 45.0, 30.0);
    insert.run('ISLAND-2', 'bay2', 0, '', '', 75.0, 50.0);
    insert.run('RACK-R1', 'bay2', 0, '', '', 75.0, 20.0);
    insert.run('RACK-R2', 'bay3', 1, '1104', 'RAM/SSD Storage carts', 80.0, 50.0);
    insert.run('RACK-R3', 'bay4', 0, '', '', 85.0, 80.0);
  })();
}

export default db;
