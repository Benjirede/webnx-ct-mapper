import type { GridFootprint, PhysicalPallet } from "./types";
import type { BayId } from "./types";

//adjust gird size for each bay based on real-world dimensions and layout
export const CELL_WIDTH = 70;
export const CELL_HEIGHT = 60;
const OVERLAP_EPSILON = 1e-9;

export interface GridDimensions {
  columns: number;
  rows: number;
}

//adjust bay sizes based on real-world dimensions and layout
export const BAY_GRID_SIZES: Record<BayId, GridDimensions> = {
  bay1: { columns: 12, rows: 30 },
  bay2: { columns: 12, rows: 30 },
  bay3: { columns: 12, rows: 30 },
  bay4: { columns: 12, rows: 30 },
  bay5: { columns: 12, rows: 30 },
};

export function getBayGridSize(bayId: BayId) {
  return BAY_GRID_SIZES[bayId];
}

export interface CanvasSize {
  width: number;
  height: number;
}

export function getGridMetrics({ width, height }: CanvasSize, bayId: BayId) {
  if (width <= 0 || height <= 0) return null;

  const { columns, rows } = getBayGridSize(bayId);

  return {
    columns,
    rows,
    cellWidth: width / columns,
    cellHeight: height / rows,
  };
}

export function getPositionForFootprint(
  slots: PhysicalPallet[],
  bayId: BayId,
  footprint: GridFootprint
): { xPos: number; yPos: number } | null {
  const { columns, rows } = getBayGridSize(bayId);
  const { column, row, widthCells, heightCells } = footprint;
  if (
    !Number.isInteger(column) || !Number.isInteger(row) ||
    !Number.isInteger(widthCells) || !Number.isInteger(heightCells) ||
    widthCells < 1 || heightCells < 1 || column < 0 || row < 0 ||
    column + widthCells > columns || row + heightCells > rows
  ) return null;

  const centerColumn = column + widthCells / 2;
  const centerRow = row + heightCells / 2;
  const overlapsSlot = slots.some((slot) => {
    const slotCenterColumn = (slot.xPos / 100) * columns;
    const slotCenterRow = (slot.yPos / 100) * rows;
    return Math.abs(centerColumn - slotCenterColumn) < (widthCells + slot.widthCells) / 2 - OVERLAP_EPSILON &&
      Math.abs(centerRow - slotCenterRow) < (heightCells + slot.heightCells) / 2 - OVERLAP_EPSILON;
  });
  if (overlapsSlot) return null;

  return {
    xPos: (centerColumn / columns) * 100,
    yPos: (centerRow / rows) * 100,
  };
}

export function findNearestOpenPosition(
  slots: PhysicalPallet[],
  canvasSize: CanvasSize,
  bayId: BayId,
  requestedX: number,
  requestedY: number,
  excludedSlotId?: string,
  footprint: Pick<PhysicalPallet, "widthCells" | "heightCells"> = { widthCells: 1, heightCells: 1 }
) {
  const grid = getGridMetrics(canvasSize, bayId);
  if (!grid) return null;

  const requestedXPx = (requestedX / 100) * canvasSize.width;
  const requestedYPx = (requestedY / 100) * canvasSize.height;
  let nearestPosition: { xPos: number; yPos: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row <= grid.rows - footprint.heightCells; row += 1) {
    for (let column = 0; column <= grid.columns - footprint.widthCells; column += 1) {
      const centerColumn = column + footprint.widthCells / 2;
      const centerRow = row + footprint.heightCells / 2;
      const x = centerColumn * grid.cellWidth;
      const y = centerRow * grid.cellHeight;
      const overlapsSlot = slots.some((slot) => {
        if (slot.id === excludedSlotId) return false;

        const slotX = (slot.xPos / 100) * grid.columns;
        const slotY = (slot.yPos / 100) * grid.rows;
        return Math.abs(centerColumn - slotX) < (footprint.widthCells + slot.widthCells) / 2 - OVERLAP_EPSILON &&
          Math.abs(centerRow - slotY) < (footprint.heightCells + slot.heightCells) / 2 - OVERLAP_EPSILON;
      });

      if (overlapsSlot) continue;

      const distance = (x - requestedXPx) ** 2 + (y - requestedYPx) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPosition = {
          xPos: (x / canvasSize.width) * 100,
          yPos: (y / canvasSize.height) * 100,
        };
      }
    }
  }

  return nearestPosition;
}