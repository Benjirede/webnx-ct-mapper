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

// shelf details, we can add more items here
export const LEVELED_ITEM_TYPES: readonly FloorItemType[] = ["shelf"];
export const LEVEL_OPTIONS = [1, 2,3,4] as const;
export const DEFAULT_LEVEL = 1;
export const MAX_ITEM_ID_LENGTH = 10;
export const MAX_PROJECT_NAME_LENGTH = 36;
export const MAX_NOTES_LENGTH = 4000;

export const hasLevels = (type: FloorItemType): boolean =>
  LEVELED_ITEM_TYPES.includes(type);

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
  /** Shelf/rack only: number of levels (defaults to DEFAULT_LEVEL). */
  levels?: number;
  /** Stored pallets only: id of the shelf/rack holding this pallet. Stored pallets are not drawn on the floor. */
  parentId?: string;
  /** Stored pallets only: 1-based shelf level. */
  level?: number;
  /** Stored pallets only: 0-based cell inside the shelf footprint. */
  cellColumn?: number;
  cellRow?: number;
}

export function matchesSearchQuery(item: PhysicalPallet, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  return [item.id, item.projectId, item.notes ?? ""]
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

/** Number of levels for a shelf/rack; 0 for anything that can't hold pallets. */
export const getLevelCount = (item: Pick<PhysicalPallet, "itemType" | "levels">): number =>
  hasLevels(item.itemType) ? Math.max(1, item.levels ?? DEFAULT_LEVEL) : 0;

/** Why an item can't be deleted right now, or undefined if it can. */
export function getDeleteBlockedReason(item: PhysicalPallet, storedCount: number): string | undefined {
  if (!hasLevels(item.itemType) || storedCount <= 0) return undefined;
  const noun = FLOOR_ITEM_LABELS[item.itemType].toLowerCase();
  return `This ${noun} still holds ${storedCount} pallet${storedCount === 1 ? "" : "s"}. Move ${storedCount === 1 ? "it" : "them"} off the ${noun} before deleting.`;
}