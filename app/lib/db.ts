import Database from 'better-sqlite3';
import path from 'path';

// This creates a physical 'webnx_floor.db' file in your project folder
const dbPath = path.join(process.cwd(), 'webnx_floor.db');
const db = new Database(dbPath);

// Initialize the Pallet Slots table if it doesn't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS pallet_slots (
    id TEXT PRIMARY KEY,
    is_occupied INTEGER DEFAULT 0,
    project_id TEXT,
    notes TEXT,
    x_pos INTEGER NOT NULL,  -- Percentage from left edge (0-100)
    y_pos INTEGER NOT NULL   -- Percentage from top edge (0-100)
  );
`);

// Seed initial irregular layout data if the table is brand new and empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM pallet_slots').get() as { count: number };
if (rowCount.count === 0) {
  const insert = db.prepare(`
    INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // Dense Staging Area - Left Zone
  insert.run('BAY-L1', 1, '9842', 'Supermicro 1U chassis', 10, 15);
  insert.run('BAY-L2', 0, '', '', 10, 40);
  insert.run('BAY-L3', 0, '', '', 15, 65);

  // Center Island Pallets (Irregular island)
  insert.run('ISLAND-1', 1, '5512', 'GorillaServers AMD EPYC', 45, 30);
  insert.run('ISLAND-2', 0, '', '', 45, 55);

  // Staggered Heavy Pallets - Right Zone (Spaced out diagonally for forklift clearance)
  insert.run('RACK-R1', 0, '', '', 75, 20);
  insert.run('RACK-R2', 1, '1104', 'RAM/SSD Storage carts', 80, 50);
  insert.run('RACK-R3', 0, '', '', 85, 80);
}

export default db;
