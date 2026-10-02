import type { PhysicalPallet } from "./types";

const CELL_WIDTH = 90;
const CELL_HEIGHT = 80;

export interface CanvasSize {
  width: number;
  height: number;
}

export function getGridMetrics({ width, height }: CanvasSize) {
  if (width <= 0 || height <= 0) return null;

  const columns = Math.max(1, Math.floor(width / CELL_WIDTH));
  const rows = Math.max(1, Math.floor(height / CELL_HEIGHT));

  return {
    columns,
    rows,
    cellWidth: width / columns,
    cellHeight: height / rows,
  };
}

export function findNearestOpenPosition(
  slots: PhysicalPallet[],
  canvasSize: CanvasSize,
  requestedX: number,
  requestedY: number,
  excludedSlotId?: string
) {
  const grid = getGridMetrics(canvasSize);
  if (!grid) return null;

  const requestedXPx = (requestedX / 100) * canvasSize.width;
  const requestedYPx = (requestedY / 100) * canvasSize.height;
  let nearestPosition: { xPos: number; yPos: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const x = (column + 0.5) * grid.cellWidth;
      const y = (row + 0.5) * grid.cellHeight;
      const overlapsSlot = slots.some((slot) => {
        if (slot.id === excludedSlotId) return false;

        const slotX = (slot.xPos / 100) * canvasSize.width;
        const slotY = (slot.yPos / 100) * canvasSize.height;
        return Math.abs(x - slotX) < CELL_WIDTH && Math.abs(y - slotY) < CELL_HEIGHT;
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