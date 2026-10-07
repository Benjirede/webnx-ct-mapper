import { NextResponse } from "next/server";
import db from "@/app/lib/db";

/**
 * Fetch data state payload matching frontend contract expectations
 */
export async function GET() {
  try {
    const slots = db.prepare('SELECT * FROM pallet_slots ORDER BY id ASC').all() as any[];
    const formattedSlots = slots.map((slot) => ({
      id: slot.id,
      isOccupied: slot.is_occupied === 1,
      projectId: slot.project_id || "",
      notes: slot.notes || "",
      xPos: slot.x_pos,
      yPos: slot.y_pos,
      updatedAt: slot.updated_at
    }));
    return NextResponse.json(formattedSlots);
  } catch (error) {
    return NextResponse.json({ error: "Failed to read database records" }, { status: 500 });
  }
}

/**
 * Single Entry-Point Data Mutation Endpoint Engine
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Raw Body Sanitation & Primitive Boundary Guard Checks
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "Invalid layout request parameters: 'id' is required" }, { status: 400 });
    }

    const targetId = body.id.trim().toUpperCase();
    const xPos = typeof body.xPos === "number" ? body.xPos : null;
    const yPos = typeof body.yPos === "number" ? body.yPos : null;

    // Fetch existing snapshot row target context for internal change logs calculations
    const oldRow = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(targetId) as any;

    // ACTION INTENT 1: CREATE NEW SLOT BAY / ATOMIC STRUCTURAL RENAME
    if (body.action === "create") {
      const finalX = xPos ?? 50.0;
      const finalY = yPos ?? 50.0;

      // Handle the transaction renaming block seamlessly if oldId hook data is specified
      if (body.oldId && typeof body.oldId === "string") {
        const structuralRenameTx = db.transaction(() => {
          const oldZoneId = body.oldId.trim().toUpperCase();
          const movingRecord = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(oldZoneId) as any;
          
          if (!movingRecord) return { status: 404, msg: "Original location structural blueprint row not found" };
          
          // Verify unique constraints to prevent name collisions
          if (oldZoneId !== targetId) {
            const collisionCheck = db.prepare('SELECT 1 FROM pallet_slots WHERE id = ?').get(targetId);
            if (collisionCheck) return { status: 409, msg: "Collision: Target layout identifier already registered" };
          }

          // Execute atomic swapping sequence
          db.prepare('DELETE FROM pallet_slots WHERE id = ?').run(oldZoneId);
          db.prepare(`
            INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(targetId, movingRecord.is_occupied, movingRecord.project_id, movingRecord.notes, finalX, finalY);

          // Append transaction to audit log tracking rows
          db.prepare(`
            INSERT INTO audit_log (pallet_id, action_type, old_value, new_value)
            VALUES (?, 'RENAMED', ?, ?)
          `).run(targetId, JSON.stringify({ id: oldZoneId }), JSON.stringify({ id: targetId, x: finalX, y: finalY }));

          return { status: 200, success: true };
        });

        const txResult = structuralRenameTx();
        if ('status' in txResult && txResult.status !== 200) {
          return NextResponse.json({ error: txResult.msg }, { status: txResult.status });
        }
        return NextResponse.json({ success: true });
      }

      // Standalone new position zone instantiation transaction path
      try {
        db.transaction(() => {
          db.prepare(`
            INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(targetId, body.isOccupied ? 1 : 0, body.projectId || "", body.notes || "", finalX, finalY);

          db.prepare(`
            INSERT INTO audit_log (pallet_id, action_type, old_value, new_value)
            VALUES (?, 'CREATED', NULL, ?)
          `).run(targetId, JSON.stringify({ id: targetId, x: finalX, y: finalY }));
        })();
        return NextResponse.json({ success: true });
      } catch (err: any) {
        if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
          return NextResponse.json({ error: "Zone identifier unique label conflict encountered" }, { status: 409 });
        }
        throw err;
      }
    }

    // ACTION INTENT 2: LEGACY/FALLBACK STANDARD INLINE TRANSACTION UPDATES (No explicit body action value passed)
    if (!oldRow) {
      return NextResponse.json({ error: "Target infrastructure entity position node not found" }, { status: 404 });
    }

    db.transaction(() => {
      const updatedOccupied = typeof body.isOccupied === "boolean" ? (body.isOccupied ? 1 : 0) : oldRow.is_occupied;
      const updatedProjectId = typeof body.projectId === "string" ? body.projectId : oldRow.project_id;
      const updatedNotes = typeof body.notes === "string" ? body.notes : oldRow.notes;
      const updatedX = xPos ?? oldRow.x_pos;
      const updatedY = yPos ?? oldRow.y_pos;

      db.prepare(`
        UPDATE pallet_slots 
        SET is_occupied = ?, project_id = ?, notes = ?, x_pos = ?, y_pos = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(updatedOccupied, updatedProjectId, updatedNotes, updatedX, updatedY, targetId);

      // Determine mutation categories on the fly to feed logs database entries automatically
      let computedAction = "UPDATED_DETAILS";
      if (oldRow.x_pos !== updatedX || oldRow.y_pos !== updatedY) computedAction = "REPOSITIONED_ZONE";
      else if (oldRow.is_occupied === 1 && updatedOccupied === 0) computedAction = "CLEARED_PALLET";
      else if (oldRow.is_occupied === 0 && updatedOccupied === 1) computedAction = "PLACED_PALLET";

      db.prepare(`
        INSERT INTO audit_log (pallet_id, action_type, old_value, new_value)
        VALUES (?, ?, ?, ?)
      `).run(
        targetId,
        computedAction,
        JSON.stringify({ occupied: oldRow.is_occupied === 1, project: oldRow.project_id, notes: oldRow.notes, x: oldRow.x_pos, y: oldRow.y_pos }),
        JSON.stringify({ occupied: updatedOccupied === 1, project: updatedProjectId, notes: updatedNotes, x: updatedX, y: updatedY })
      );
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal operational database engine error occurred" }, { status: 500 });
  }
}

/**
 * Handle infrastructure zone deletions directly
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("id")?.trim().toUpperCase();

    if (!targetId) {
      return NextResponse.json({ error: "Missing required layout locator query string: 'id'" }, { status: 400 });
    }

    const executionResult = db.transaction(() => {
      const activeRecord = db.prepare('SELECT * FROM pallet_slots WHERE id = ?').get(targetId) as any;
      if (!activeRecord) return { status: 404, error: "Zone not found on blueprint grid" };
      if (activeRecord.is_occupied === 1) return { status: 400, error: "Cannot delete zone: clear active pallet payload first" };

      db.prepare('DELETE FROM pallet_slots WHERE id = ?').run(targetId);
      db.prepare(`
        INSERT INTO audit_log (pallet_id, action_type, old_value, new_value)
        VALUES (?, 'DELETED', ?, NULL)
      `).run(targetId, JSON.stringify(activeRecord));

      return { status: 200 };
    })();

    if (executionResult.status !== 200) {
      return NextResponse.json({ error: executionResult.error }, { status: executionResult.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal endpoint error executing deletion transaction" }, { status: 500 });
  }
}
