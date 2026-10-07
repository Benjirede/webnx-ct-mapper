import Database from 'better-sqlite3';
import path from 'path';

// Force path resolution globally within a universally visible directory
const dbPath = path.resolve(process.cwd(), 'webnx_floor.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
