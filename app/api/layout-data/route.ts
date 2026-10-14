export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getBayGridSize } from "@/app/components/floor-grid/layoutPositions";
import { isBayId, isFloorItemType } from "@/app/components/floor-grid/types";

const SECRET_ADMIN_PIN = "1234";

function verifyAdminPermission(req: Request): boolean {
  return req.headers.get("X-Admin-PIN") === SECRET_ADMIN_PIN;
}

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
      updatedAt: slot.updated_at
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
          db.prepare('INSERT INTO pallet_slots (id, bay_id, item_type, is_occupied, project_id, notes, x_pos, y_pos, version, width_cells, height_cells, occupied_since, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(targetId, originalRecord.bay_id, originalRecord.item_type || "pallet", originalRecord.is_occupied, originalRecord.project_id || "", originalRecord.notes || "", x, y, (originalRecord.version || 1) + 1, originalRecord.width_cells || 1, originalRecord.height_cells || 1, originalRecord.occupied_since, systemTime);

          db.prepare("INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, 'RENAMED', ?, ?, ?)")
            .run(targetId, JSON.stringify({ id: oldZoneId }), JSON.stringify({ id: targetId }), systemTime);

          return { status: 200 };
        })();

        if (renameResult.status !== 200) return NextResponse.json({ error: renameResult.error }, { status: renameResult.status });
        return NextResponse.json({ success: true });
      }

      try {
        db.transaction(() => {
          db.prepare('INSERT INTO pallet_slots (id, bay_id, item_type, is_occupied, project_id, notes, x_pos, y_pos, version, width_cells, height_cells, updated_at) VALUES (?, ?, ?, 0, "", "", ?, ?, 1, ?, ?, ?)')
            .run(targetId, assignedBay, itemType, x, y, widthCells, heightCells, systemTime);
          db.prepare("INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, 'CREATED', NULL, ?, ?)")
            .run(targetId, JSON.stringify({ id: targetId, bayId: assignedBay, itemType, x, y, widthCells, heightCells }), systemTime);
        })();
        return NextResponse.json({ success: true });
      } catch (e) {
        return NextResponse.json({ error: "Zone identifier active" }, { status: 409 });
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

    db.transaction(() => {
      db.prepare('UPDATE pallet_slots SET is_occupied = ?, project_id = ?, notes = ?, occupied_since = ?, version = version + 1, updated_at = ? WHERE id = ?')
        .run(updatedOccupied, updatedProjectId, updatedNotes, occupiedSinceTimestamp, systemTime, targetId);

      let computedAction = "UPDATED_DETAILS";
      if (oldRow.is_occupied === 0 && updatedOccupied === 1) computedAction = "PLACED_PALLET";
      else if (oldRow.is_occupied === 1 && updatedOccupied === 0) computedAction = "CLEARED_PALLET";

      db.prepare('INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(targetId, computedAction, JSON.stringify({ project: oldRow.project_id, occupied: oldRow.is_occupied === 1 }), JSON.stringify({ project: updatedProjectId, occupied: updatedOccupied === 1 }), systemTime);
    })();

    return NextResponse.json({ success: true });
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
      if (activeRecord.is_occupied === 1) return { status: 400, error: "Zone occupied" };

      db.prepare('DELETE FROM pallet_slots WHERE id = ?').run(targetId);
      db.prepare('INSERT INTO audit_log (pallet_id, action_type, old_value, new_value, timestamp) VALUES (?, "DELETED", ?, NULL, ?)')
        .run(targetId, JSON.stringify(activeRecord), systemTime);

      return { status: 200 };
    })();

    if (executionResult.status !== 200) return NextResponse.json({ error: executionResult.error }, { status: executionResult.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Operational deletion fault" }, { status: 500 });
  }
}
