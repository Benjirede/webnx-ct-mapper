import { NextResponse } from "next/server";
import db from "@/app/lib/db";

/**
 * Reads the current state of all pallet slots from the database and returns them as a JSON response.
 * @returns 
 */
export async function GET() {
  try {
    const slots = db.prepare('SELECT * FROM pallet_slots').all();
    const formattedSlots = slots.map((slot: any) => ({
      id: slot.id,
      isOccupied: slot.is_occupied === 1,
      projectId: slot.project_id || "",
      notes: slot.notes || "",
      xPos: slot.x_pos,
      yPos: slot.y_pos
    }));
    return NextResponse.json(formattedSlots);
  } catch (error) {
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
    
    // Check if we are creating a brand new slot or updating an existing one
    if (body.action === "create") {
      const insert = db.prepare(`
        INSERT INTO pallet_slots (id, is_occupied, project_id, notes, x_pos, y_pos)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(body.id, body.isOccupied ? 1 : 0, body.projectId, body.notes, body.xPos, body.yPos);
    } else {
      // Regular update for contents or movement positions
      const update = db.prepare(`
        UPDATE pallet_slots 
        SET is_occupied = ?, project_id = ?, notes = ?, x_pos = ?, y_pos = ?
        WHERE id = ?
      `);
      update.run(body.isOccupied ? 1 : 0, body.projectId, body.notes, body.xPos, body.yPos, body.id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Database transaction failed" }, { status: 500 });
  }
}
