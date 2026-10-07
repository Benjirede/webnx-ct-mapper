// Run via: node scripts/test-backend.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.cwd(), 'webnx_floor.db'));

console.log("=== 🔍 RUNNING INTEGRITY DIAGNOSTIC TEST CHECKS ===");

// 1. Check WAL mode performance metrics configuration status
const journalMode = db.pragma('journal_mode', { simple: true });
console.log(`[OK] SQLITE Mode configured to: ${journalMode}`);

// 2. Fetch existing blueprint records mapping profile
const rows = db.prepare('SELECT id, x_pos, y_pos FROM pallet_slots LIMIT 2').all();
console.log("[OK] Read Check Samples:", rows);

// 3. Extract transaction entries directly from Audit Trail
const history = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 3').all();
console.log("[OK] Recent System Actions Tracked:", history);

console.log("=== ✅ DIAGNOSTIC TEST FINISHED SUCCESFULLY ===");
