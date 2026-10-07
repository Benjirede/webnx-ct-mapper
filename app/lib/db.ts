import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'webnx_floor.db');
const db = new Database(dbPath);

// Enable performance optimizations and strict integrity constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 1. Initialize Schema & Schema Versioning Control
db.exec(`
  CREATE TABLE IF NOT EXISTS pallet_slots (
    id TEXT PRIMARY KEY,
    is_occupied INTEGER DEFAULT 0,
    project_id TEXT,
    notes TEXT,
    x_pos REAL NOT NULL,        -- Changed to REAL to safely support precise floating coordinates
    y_pos REAL NOT NULL,        -- Changed to REAL to safely support precise floating coordinates
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pallet_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'CREATED', 'DELETED', 'RENAMED', 'MOVED_PALLET', 'REPOSITIONED_ZONE', 'UPDATED_DETAILS'
    old_value TEXT,            -- Structured JSON capture
    new_value TEXT,            -- Structured JSON capture
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Pragmatic Schema Migrations Strategy (Enforcing user_version tracking)
const currentVersion = (db.pragma('user_version', { simple: true }) as number) || 0;
if (currentVersion < 1) {
  db.transaction(() => {
    // Perform migrations safely within single transactional context
    db.pragma('user_version = 1');
  })();
}

// 3. Seed Initial Base Blueprint Data Safely If Completely New
const rowCount = db.prepare('SELECT COUNT(*) as count FROM pallet_slots').get() as { count: number };
if (rowCount.count === 0) {
  const insert = db.prepare(`
    INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  db.transaction(() => {
    insert.run('BAY-L1', 1, '9842', 'Supermicro 1U chassis', 10.0, 15.0);
    insert.run('BAY-L2', 0, '', '', 10.0, 40.0);
    insert.run('BAY-L3', 0, '', '', 15.0, 65.0);
    insert.run('ISLAND-1', 1, '5512', 'GorillaServers AMD EPYC', 45.0, 30.0);
    insert.run('ISLAND-2', 0, '', '', 45.0, 55.0);
    insert.run('RACK-R1', 0, '', '', 75.0, 20.0);
    insert.run('RACK-R2', 1, '1104', 'RAM/SSD Storage carts', 80.0, 50.0);
    insert.run('RACK-R3', 0, '', '', 85.0, 80.0);
  })();
}

export default db;
