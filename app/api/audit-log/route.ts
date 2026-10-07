import { NextResponse } from "next/server";
import db from "@/app/lib/db";

export async function GET() {
  try {
    const historicalLogs = db.prepare(`
      SELECT id, pallet_id as palletId, action_type as action, old_value as preContext, new_value as postContext, timestamp 
      FROM audit_log 
      ORDER BY id DESC 
      LIMIT 250
    `).all() as any[];

    const normalizedLogs = historicalLogs.map(log => ({
      ...log,
      preContext: log.preContext ? JSON.parse(log.preContext) : null,
      postContext: log.postContext ? JSON.parse(log.postContext) : null
    }));

    return NextResponse.json(normalizedLogs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to pull transaction logs history metrics" }, { status: 500 });
  }
}
