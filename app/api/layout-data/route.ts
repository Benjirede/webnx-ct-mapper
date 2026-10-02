import { NextResponse } from "next/server";
import db from "@/app/lib/db";
import { isBayId } from "@/app/components/floor-grid/types";

interface PalletSlotRow {
  id: string;
  bay_id: string;
  is_occupied: number;
  project_id: string | null;
  notes: string | null;
  x_pos: number;
  y_pos: number;
}

/**
 * Reads the current state of all pallet slots from the database and returns them as a JSON response.
 * @returns 
 */
export async function GET() {
  try {
    const slots = db.prepare("SELECT * FROM pallet_slots").all() as PalletSlotRow[];
    const formattedSlots = slots.map((slot) => ({
      id: slot.id,
      bayId: slot.bay_id,
      isOccupied: slot.is_occupied === 1,
      projectId: slot.project_id || "",
      notes: slot.notes || "",
      xPos: slot.x_pos,
      yPos: slot.y_pos
    }));
    return NextResponse.json(formattedSlots);
  } catch {
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

/**
 * Handles POST requests to create or update pallet slot data in the database.
 * @param request 
 * @returns 
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isBayId(body.bayId)) {
      return NextResponse.json({ error: "A valid bayId is required" }, { status: 400 });
    }
    
    if (body.action === "rename" && typeof body.oldId === "string") {
      const rename = db.prepare(`
        UPDATE pallet_slots
        SET id = ?, is_occupied = ?, project_id = ?, notes = ?, x_pos = ?, y_pos = ?, bay_id = ?
        WHERE id = ?
      `);
      rename.run(body.id, body.isOccupied ? 1 : 0, body.projectId, body.notes, body.xPos, body.yPos, body.bayId, body.oldId);
    } else if (body.action === "create") {
      const insert = db.prepare(`
        INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos, bay_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(body.id, body.isOccupied ? 1 : 0, body.projectId, body.notes, body.xPos, body.yPos, body.bayId);
    } else {
      const update = db.prepare(`
        UPDATE pallet_slots 
        SET is_occupied = ?, project_id = ?, notes = ?, x_pos = ?, y_pos = ?, bay_id = ?
        WHERE id = ?
      `);
      update.run(body.isOccupied ? 1 : 0, body.projectId, body.notes, body.xPos, body.yPos, body.bayId, body.id);
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Database transaction failed" }, { status: 500 });
  }
}
