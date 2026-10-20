export const BAY_IDS = ["bay1", "bay2", "bay3", "bay4", "bay5"] as const;

export type BayId = (typeof BAY_IDS)[number];

export function isBayId(value: unknown): value is BayId {
  return typeof value === "string" && (BAY_IDS as readonly string[]).includes(value);
}

export interface GridFootprint {
  column: number;
  row: number;
  widthCells: number;
  heightCells: number;
}

export const FLOOR_ITEM_TYPES = [
  "pallet",
  "walking-lane",
  "desk",
  "shelf",
  "rack",
  "island",
  "workbench",
  "other"
] as const;

export type FloorItemType = (typeof FLOOR_ITEM_TYPES)[number];

export const FLOOR_ITEM_LABELS: Record<FloorItemType, string> = {
  pallet: "Pallet",
  "walking-lane": "Walking lane",
  desk: "Desk",
  shelf: "Shelf",
  rack: "Rack",
  island: "Island",
  workbench: "Workbench",
  other: "Other"
};

export function isFloorItemType(value: unknown): value is FloorItemType {
  return typeof value === "string" && (FLOOR_ITEM_TYPES as readonly string[]).includes(value);
}

export interface PhysicalPallet {
  id: string;
  bayId: BayId;
  itemType: FloorItemType;
  widthCells: number;
  heightCells: number;
  isOccupied: boolean;
  projectId: string;
  notes: string;
  xPos: number;
  yPos: number;
  version?: number;
}