export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getBayGridSize } from "@/app/components/floor-grid/layoutPositions";
import {
  DEFAULT_LEVEL,
  LEVEL_OPTIONS,
  hasLevels,
  isBayId,
  isFloorItemType,
} from "@/app/components/floor-grid/types";

const SECRET_ADMIN_PIN = "1234";

function verifyAdminPermission(req: Request): boolean {
  return req.headers.get("X-Admin-PIN") === SECRET_ADMIN_PIN;
}

/**
 * Shelf support: adds the columns below to existing databases the first time this route loads.
 *   levels                       -> shelves/racks: how many levels they have
 *   parent_id/level/cell_column/cell_row -> stored pallets: which shelf, level and cell they sit in
 */
function ensureShelfColumns() {
  try {
    const existing = new Set(
      (db.prepare("PRAGMA table_info(pallet_slots)").all() as { name: string }[]).map((column) => column.name)
    );
    const wanted: [string, string][] = [
      ["levels", "INTEGER"],
      ["parent_id", "TEXT"],
      ["level", "INTEGER"],
      ["cell_column", "INTEGER"],
      ["cell_row", "INTEGER"],
    ];
    for (const [name, type] of wanted) {
      if (!existing.has(name)) db.exec(`ALTER TABLE pallet_slots ADD COLUMN ${name} ${type}`);
    }
  } catch (error) {
    console.error("Unable to add shelf columns", error);
  }
}
ensureShelfColumns();

const isPercent = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

/**
 * FETCH STATE CONTRACT ENGINE
 */
export async function GET() {
  try {
    const slots = db.prepare('SELECT * FROM pallet_slots ORDER BY id ASC').all() as any[];
    const formattedSlots = slots.map((slot) => ({
      id: slot.id,
      bayId: slot.bay_id || "bay1",
      itemType: slot.item_type || "pallet",
      isOccupied: slot.is_occupied === 1,
      projectId: slot.project_id || "",
      notes: slot.notes || "",
      xPos: slot.x_pos,
      yPos: slot.y_pos,
      widthCells: slot.width_cells ?? 1,
      heightCells: slot.height_cells ?? 1,
      version: slot.version,
      occupiedSince: slot.occupied_since,
      updatedAt: slot.updated_at,
      ...(slot.levels != null ? { levels: slot.levels } : {}),
      ...(slot.parent_id
        ? {
            parentId: slot.parent_id,
            level: slot.level ?? 1,
            cellColumn: slot.cell_column ?? 0,
            cellRow: slot.cell_row ?? 0,
          }
        : {}),
    }));
    return NextResponse.json(formattedSlots);
  } catch (error) {
    return NextResponse.json({ error: "Read operations fault" }, { status: 500 });
  }
}

/**
 * MASTER MUTATION ENTRY POINT
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const systemTime = new Date().toISOString();

    // ------------------------------------------------------------------------
    // SUB-ROUTING INTENT A: ATOMIC SINGLE-TRANSACTION PALLET MOVEMENT
    // ------------------------------------------------------------------------
    if (body.action === "move_pallet") {
      const sourceId = body.sourceId?.trim().toUpperCase();
      const targetId = body.targetId?.trim().toUpperCase();

      if (!sourceId || !targetId) {
        return NextResponse.json({ error: "Source and Target fields are required" }, { status: 400 });
      }

      // Step 1: Record lookup validation checks synchronously OUTSIDE the transaction wrapper
      const source = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(sourceId) as any;
      const target = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(targetId) as any;

      if (!source || !target) {
        return NextResponse.json({ error: "One or both layout location target bounds missing" }, { status: 404 });
      }
      if (source.is_occupied === 0 || source.is_occupied === false) {
        return NextResponse.json({ error: "Origin empty" }, { status: 400 });
      }
      if (target.is_occupied === 1 || target.is_occupied === true) {
        return NextResponse.json({ error: "Destination blocked" }, { status: 400 });
      }

      // Safeguard fallback layer for unseeded item types
      const sourceItem = source.itemType || source.item_type || "pallet";
      const targetItem = target.itemType || target.item_type || "pallet";

      if (sourceItem !== "pallet" || targetItem !== "pallet") {
        return NextResponse.json({ error: "Inventory can only move between pallet items" }, { status: 400 });
      }

      // Step 2: Execute database mutations against the exact snake_case database table structures
      try {
        db.transaction(() => {
          // Clear source slot parameters using exact database snake_case columns
          db.prepare("UPDATE pallet_slots SET is_occupied = 0, project_id = '', notes = '', occupied_since = NULL, version = version + 1, updated_at = ? WHERE id = ?")
            .run(systemTime, sourceId);
            
          // Populate target slot parameters with source history data using exact database snake_case columns
          db.prepare('UPDATE pallet_slots SET is_occupied = 1, project_id = ?, notes = ?, occupied_since = ?, version = version + 1, updated_at = ? WHERE id = ?')
            .run(source.project_id, source.notes, source.occupied_since || systemTime, systemTime, targetId);
            
          // FIXED: Wrapped the SQL query in double-quotes so internal text values use standard single-quotes
          db.prepare("INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, 'MOVED_PALLET', ?, ?, ?)")
            .run(
              sourceId, 
              JSON.stringify({ projectId: source.project_id, notes: source.notes }), 
              JSON.stringify({ movedTo: targetId }), 
              systemTime
            );

        })();

        return NextResponse.json({ success: true });
      } catch (txError: any) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }
    }

    // ------------------------------------------------------------------------
    // CONCURRENCY & AUTH SECURITY PRE-FLIGHT VERIFICATIONS
    // ------------------------------------------------------------------------
    const targetId = body.id?.trim().toUpperCase();
    if (!targetId) return NextResponse.json({ error: "Missing identity context code: 'id'" }, { status: 400 });

    const oldRow = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(targetId) as any;

    if (body.action === "create" && oldRow) {
      return NextResponse.json({ error: "Zone identifier active" }, { status: 409 });
    }

    if (body.action !== "create" && oldRow && typeof body.version === "number") {
      if (oldRow.version !== body.version) {
        return NextResponse.json({ error: "Conflict: Outdated layout cache tracker state", currentVersion: oldRow.version }, { status: 409 });
      }
    }

    // ------------------------------------------------------------------------
    // SUB-ROUTING INTENT B: BLUEPRINT CREATION / RENAME (GUARDED)
    // ------------------------------------------------------------------------
    if (body.action === "create" || body.action === "rename") {
      const x = body.xPos ?? 50.0;
      const y = body.yPos ?? 50.0;
      const assignedBay = body.bayId || "bay1";
      const itemType = body.itemType || "pallet";
      const widthCells = body.widthCells ?? 1;
      const heightCells = body.heightCells ?? 1;
      if (!isBayId(assignedBay)) return NextResponse.json({ error: "Invalid bay" }, { status: 400 });
      if (!isFloorItemType(itemType)) return NextResponse.json({ error: "Invalid floor item type" }, { status: 400 });
      const bayGridSize = getBayGridSize(assignedBay);
      if (
        !Number.isInteger(widthCells) || !Number.isInteger(heightCells) ||
        widthCells < 1 || widthCells > bayGridSize.columns ||
        heightCells < 1 || heightCells > bayGridSize.rows
      ) {
        return NextResponse.json({ error: "Invalid pallet footprint" }, { status: 400 });
      }

      if (body.oldId) {
        const oldZoneId = body.oldId.trim().toUpperCase();
        const renameResult = db.transaction(() => {
          const originalRecord = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(oldZoneId) as any;
          if (!originalRecord) return { status: 404, error: "Original slot layout definition missing" };

          if (oldZoneId !== targetId) {
            const blockCheck = db.prepare('SELECT 1 FROM pallet_slots WHERE id = ?').get(targetId);
            if (blockCheck) return { status: 409, error: "Identifier tag collision encountered" };
          }

          db.prepare('DELETE FROM pallet_slots WHERE id = ?').run(oldZoneId);
          db.prepare('INSERT INTO pallet_slots (id, bay_id, item_type, is_occupied, project_id, notes, x_pos, y_pos, version, width_cells, height_cells, occupied_since, updated_at, levels, parent_id, level, cell_column, cell_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(
              targetId, originalRecord.bay_id, originalRecord.item_type || "pallet", originalRecord.is_occupied,
              originalRecord.project_id || "", originalRecord.notes || "", x, y, (originalRecord.version || 1) + 1,
              originalRecord.width_cells || 1, originalRecord.height_cells || 1, originalRecord.occupied_since, systemTime,
              originalRecord.levels ?? null, originalRecord.parent_id ?? null, originalRecord.level ?? null,
              originalRecord.cell_column ?? null, originalRecord.cell_row ?? null
            );

          // A renamed shelf keeps its stored pallets.
          if (oldZoneId !== targetId) {
            db.prepare('UPDATE pallet_slots SET parent_id = ? WHERE parent_id = ?').run(targetId, oldZoneId);
          }

          db.prepare("INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, 'RENAMED', ?, ?, ?)")
            .run(targetId, JSON.stringify({ id: oldZoneId }), JSON.stringify({ id: targetId }), systemTime);

          return { status: 200 };
        })();

        if (renameResult.status !== 200) return NextResponse.json({ error: renameResult.error }, { status: renameResult.status });
        return NextResponse.json({ success: true });
      }

      let levels: number | null = null;
      if (hasLevels(itemType)) {
        const requestedLevels = body.levels ?? DEFAULT_LEVEL;
        if (!(LEVEL_OPTIONS as readonly number[]).includes(requestedLevels)) {
          return NextResponse.json({ error: "Invalid number of shelf levels" }, { status: 400 });
        }
        levels = requestedLevels;
      }

      try {
        db.transaction(() => {
          db.prepare(`
            INSERT INTO pallet_slots (
              id, bay_id, item_type, is_occupied, project_id, notes,
              x_pos, y_pos, version, width_cells, height_cells, updated_at, levels
            ) VALUES (?, ?, ?, 0, '', '', ?, ?, 1, ?, ?, ?, ?)
          `).run(targetId, assignedBay, itemType, x, y, widthCells, heightCells, systemTime, levels);
          db.prepare('INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, ?, NULL, ?, ?)')
            .run(targetId, "CREATED", JSON.stringify({ id: targetId, bayId: assignedBay, itemType, x, y, widthCells, heightCells, levels }), systemTime);
        })();
        return NextResponse.json({ success: true });
      } catch (e) {
        console.error("Failed to create floor item", e);
        return NextResponse.json({ error: "Unable to persist floor item" }, { status: 500 });
      }
    }

    // ------------------------------------------------------------------------
    // SUB-ROUTING INTENT C: STANDARD INLINE DATA VALUE MUTATIONS
    // ------------------------------------------------------------------------
    if (!oldRow) return NextResponse.json({ error: "Node unmapped" }, { status: 404 });

    const updatedOccupied = typeof body.isOccupied === "boolean" ? (body.isOccupied ? 1 : 0) : oldRow.is_occupied;
    const updatedProjectId = typeof body.projectId === "string" ? body.projectId : oldRow.project_id;
    const updatedNotes = typeof body.notes === "string" ? body.notes : oldRow.notes;

    let occupiedSinceTimestamp = oldRow.occupied_since;
    if (oldRow.is_occupied === 0 && updatedOccupied === 1) occupiedSinceTimestamp = systemTime;
    else if (updatedOccupied === 0) occupiedSinceTimestamp = null;

    const updateResult = db.transaction(() => {
      let parentId: string | null = oldRow.parent_id ?? null;
      let shelfLevel: number | null = oldRow.level ?? null;
      let cellColumn: number | null = oldRow.cell_column ?? null;
      let cellRow: number | null = oldRow.cell_row ?? null;
      let xPos: number = oldRow.x_pos;
      let yPos: number = oldRow.y_pos;

      // Shelf placement changes only when the client sends "parentId" (null = back on the floor).
      if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
        if (body.parentId === null) {
          if (!isPercent(body.xPos) || !isPercent(body.yPos)) {
            return { status: 400, error: "A floor position is required to take a pallet off a shelf" };
          }
          parentId = shelfLevel = cellColumn = cellRow = null;
          xPos = body.xPos;
          yPos = body.yPos;
        } else if (typeof body.parentId === "string") {
          const shelfId = body.parentId.trim().toUpperCase();
          const shelf = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(shelfId) as any;
          if (oldRow.item_type !== "pallet" || updatedOccupied !== 1) {
            return { status: 400, error: "Only occupied pallets can be stored on a shelf" };
          }
          if (!shelf || !hasLevels(shelf.item_type) || shelf.parent_id) {
            return { status: 404, error: "Shelf not found" };
          }
          if (shelf.bay_id !== oldRow.bay_id) return { status: 400, error: "Pallet and shelf must be in the same bay" };

          const { level, cellColumn: column, cellRow: row } = body;
          if (
            !Number.isInteger(level) || !Number.isInteger(column) || !Number.isInteger(row) ||
            level < 1 || level > (shelf.levels ?? DEFAULT_LEVEL) ||
            column < 0 || column >= (shelf.width_cells ?? 1) ||
            row < 0 || row >= (shelf.height_cells ?? 1)
          ) {
            return { status: 400, error: "That position is outside the shelf" };
          }

          const taken = db.prepare(
            'SELECT 1 FROM pallet_slots WHERE parent_id = ? AND level = ? AND cell_column = ? AND cell_row = ? AND id != ?'
          ).get(shelfId, level, column, row, targetId);
          if (taken) return { status: 409, error: "That shelf slot already holds a pallet" };

          parentId = shelfId;
          shelfLevel = level;
          cellColumn = column;
          cellRow = row;
        } else {
          return { status: 400, error: "Invalid shelf reference" };
        }
      } else if (!parentId && isPercent(body.xPos) && isPercent(body.yPos)) {
        // Floor items keep the position the client last placed them at.
        xPos = body.xPos;
        yPos = body.yPos;
      }

      db.prepare('UPDATE pallet_slots SET is_occupied = ?, project_id = ?, notes = ?, occupied_since = ?, x_pos = ?, y_pos = ?, parent_id = ?, level = ?, cell_column = ?, cell_row = ?, version = version + 1, updated_at = ? WHERE id = ?')
        .run(updatedOccupied, updatedProjectId, updatedNotes, occupiedSinceTimestamp, xPos, yPos, parentId, shelfLevel, cellColumn, cellRow, systemTime, targetId);

      let computedAction = "UPDATED_DETAILS";
      if (!oldRow.parent_id && parentId) computedAction = "STORED_ON_SHELF";
      else if (oldRow.parent_id && !parentId) computedAction = "REMOVED_FROM_SHELF";
      else if (oldRow.parent_id && parentId && (oldRow.parent_id !== parentId || oldRow.level !== shelfLevel || oldRow.cell_column !== cellColumn || oldRow.cell_row !== cellRow)) computedAction = "MOVED_ON_SHELF";
      else if (oldRow.is_occupied === 0 && updatedOccupied === 1) computedAction = "PLACED_PALLET";
      else if (oldRow.is_occupied === 1 && updatedOccupied === 0) computedAction = "CLEARED_PALLET";

      db.prepare('INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(
          targetId,
          computedAction,
          JSON.stringify({ project: oldRow.project_id, occupied: oldRow.is_occupied === 1, shelf: oldRow.parent_id ?? null }),
          JSON.stringify({ project: updatedProjectId, occupied: updatedOccupied === 1, shelf: parentId }),
          systemTime
        );

      return { status: 200 };
    })();

    if (updateResult.status !== 200) {
      return NextResponse.json({ error: updateResult.error }, { status: updateResult.status });
    }
    return NextResponse.json({ success: true, version: oldRow.version + 1 });
  } catch (error) {
    return NextResponse.json({ error: "Transactional critical interface error" }, { status: 500 });
  }
}

/**
 * INFRASTRUCTURE ZONE REMOVAL ENGINE
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("id")?.trim().toUpperCase();
    const systemTime = new Date().toISOString();

    if (!targetId) return NextResponse.json({ error: "Missing locator: 'id'" }, { status: 400 });
    if (!verifyAdminPermission(request)) return NextResponse.json({ error: "Access Denied: Invalid credentials" }, { status: 401 });

    const executionResult = db.transaction(() => {
      const activeRecord = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(targetId) as any;
      if (!activeRecord) return { status: 404, error: "Zone not found" };

      const stored = db.prepare('SELECT COUNT(*) AS count FROM pallet_slots WHERE parent_id = ?').get(targetId) as { count: number };
      if (stored.count > 0) {
        return { status: 400, error: `Zone still holds ${stored.count} pallet${stored.count === 1 ? "" : "s"}. Move them off before deleting.` };
      }

      if (activeRecord.is_occupied === 1) return { status: 400, error: "Zone occupied, please ensure Item is Empty." };

      db.prepare('DELETE FROM pallet_slots WHERE id = ?').run(targetId);
      db.prepare('INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, ?, ?, NULL, ?)')
        .run(targetId, "DELETED", JSON.stringify(activeRecord), systemTime);

      return { status: 200 };
    })();

    if (executionResult.status !== 200) return NextResponse.json({ error: executionResult.error }, { status: executionResult.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Operational deletion fault" }, { status: 500 });
  }
}