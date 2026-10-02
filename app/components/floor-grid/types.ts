export const BAY_IDS = ["bay1", "bay2", "bay3", "bay4", "bay5"] as const;

export type BayId = (typeof BAY_IDS)[number];

export function isBayId(value: unknown): value is BayId {
  return typeof value === "string" && (BAY_IDS as readonly string[]).includes(value);
}

export interface PhysicalPallet {
  id: string;
  bayId: BayId;
  isOccupied: boolean;
  projectId: string;
  notes: string;
  xPos: number;
  yPos: number;
}