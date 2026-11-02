import { useEffect, useRef, useState } from "react";
import { CELL_HEIGHT, CELL_WIDTH } from "./layoutPositions";
import { FLOOR_ITEM_LABELS, getLevelCount, matchesSearchQuery, type PhysicalPallet } from "./types";
import slotStyles from "./PalletSlot.module.css";

const PANEL_MIN_WIDTH = 248;
const PANEL_PADDING = 12;
const CHROME_HEIGHT = 176;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface Props {
  shelf: PhysicalPallet;
  contents: PhysicalPallet[];
  selectedId: string | null;
  query: string;
  isAdminMode: boolean;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onSelect: (slot: PhysicalPallet) => void;
  onDropPallet: (sourceId: string, level: number, column: number, row: number) => void;
}

export default function ShelfView({
  shelf, contents, selectedId, query, scale, canvasWidth, canvasHeight,
  onClose, onSelect, onDropPallet,
}: Props) {
  const levelCount = Math.max(1, getLevelCount(shelf));
  const [level, setLevel] = useState(1);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeLevel = Math.min(level, levelCount);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Reset custom drag position whenever a different shelf is opened
  useEffect(() => {
    setPosition(null);
  }, [shelf.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, []);

  const gridWidth = shelf.widthCells * CELL_WIDTH;
  const gridHeight = shelf.heightCells * CELL_HEIGHT;
  const panelWidth = Math.max(PANEL_MIN_WIDTH, gridWidth + PANEL_PADDING * 2);
  const panelHeight = gridHeight + CHROME_HEIGHT;

  // Default centered position calculation
  const centerX = (shelf.xPos / 100) * canvasWidth;
  const centerY = (shelf.yPos / 100) * canvasHeight;
  const defaultLeft = clamp(centerX - (panelWidth * scale) / 2, 0, Math.max(0, canvasWidth - panelWidth * scale));
  const defaultTop = clamp(centerY - (panelHeight * scale) / 2, 0, Math.max(0, canvasHeight - panelHeight * scale));

  const currentPos = position ?? { x: defaultLeft, y: defaultTop };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging if clicking buttons inside the header
    if ((e.target as HTMLElement).closest("button")) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentPos.x,
      initialY: currentPos.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Account for canvas scale so dragging speed matches the zoom level
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;

      const newX = clamp(
        dragRef.current.initialX + dx,
        0,
        Math.max(0, canvasWidth - panelWidth * scale)
      );
      const newY = clamp(
        dragRef.current.initialY + dy,
        0,
        Math.max(0, canvasHeight - panelHeight * scale)
      );

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, scale, canvasWidth, canvasHeight, panelWidth, panelHeight]);

  const capacity = shelf.widthCells * shelf.heightCells * levelCount;
  const levelContents = contents.filter((pallet) => pallet.level === activeLevel);
  const byCell = new Map(levelContents.map((pallet) => [`${pallet.cellColumn},${pallet.cellRow}`, pallet]));

  const hint =
    contents.length === 0
      ? "Drag an occupied pallet from the floor into an open slot."
      : "Drag pallets between slots, or drop them on open floor to take them out.";

  return (
    <div
      ref={panelRef}
      data-no-pan
      onDragOver={(e) => e.stopPropagation()}
      onDrop={(e) => e.stopPropagation()}
      role="region"
      aria-label={`${shelf.id} contents`}
      className="absolute z-50 cursor-default rounded-lg border border-emerald-500/60 bg-gray-900/95 p-3 shadow-2xl backdrop-blur-sm"
      style={{
        left: currentPos.x,
        top: currentPos.y,
        width: panelWidth,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {/* Drag Handle Header */}
      <div
        className="flex items-start justify-between gap-2 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="min-w-0 pointer-events-none">
          <p className="text-[11px] text-gray-400">{FLOOR_ITEM_LABELS[shelf.itemType]}</p>
          <p className="truncate text-sm font-bold text-emerald-300">{shelf.id}</p>
          <p className="text-[11px] text-gray-400">{contents.length} of {capacity} slots used</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${shelf.id}`}
          title="Close (Esc)"
          className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          Close
        </button>
      </div>

      {levelCount > 1 && (
        <div role="tablist" aria-label="Shelf levels" className="mt-2 flex gap-1">
          {Array.from({ length: levelCount }, (_, i) => i + 1).map((n) => {
            const count = contents.filter((pallet) => pallet.level === n).length;
            return (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={n === activeLevel}
                onClick={() => setLevel(n)}
                onDragEnter={() => setLevel(n)}
                className={`flex-1 rounded border px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                  n === activeLevel
                    ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
              >
                Level {n}
                {count > 0 && <span className="ml-1 text-[10px] text-amber-300">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="mx-auto mt-3 grid rounded border border-dashed border-gray-600 bg-gray-950/70"
        style={{
          width: gridWidth,
          height: gridHeight,
          gridTemplateColumns: `repeat(${shelf.widthCells}, ${CELL_WIDTH}px)`,
          gridTemplateRows: `repeat(${shelf.heightCells}, ${CELL_HEIGHT}px)`,
        }}
      >
        {Array.from({ length: shelf.heightCells }, (_, row) =>
          Array.from({ length: shelf.widthCells }, (_, column) => {
            const key = `${column},${row}`;
            const pallet = byCell.get(key);
            const isHover = hoverCell === key;

            return (
              <div
                key={key}
                onDragEnter={(e) => {
                  if (!pallet) e.preventDefault();
                }}
                onDragOver={(e) => {
                  e.stopPropagation();
                  if (pallet) return;
                  e.preventDefault();
                  setHoverCell(key);
                }}
                onDragLeave={() => setHoverCell((prev) => (prev === key ? null : prev))}
                onDrop={(e) => {
                  setHoverCell(null);
                  e.preventDefault();
                  e.stopPropagation();
                  if (pallet) return;
                  const sourceId = e.dataTransfer.getData("text/source-id");
                  if (!sourceId) return;
                  onDropPallet(sourceId, activeLevel, column, row);
                }}
                className={`flex items-center justify-center border border-gray-700/70 p-1 transition-colors ${
                  isHover ? "bg-emerald-400/20 ring-2 ring-inset ring-emerald-400" : ""
                }`}
              >
                {pallet ? (
                  <button
                    type="button"
                    draggable
                    onClick={() => onSelect(pallet)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/source-id", pallet.id);
                      e.dataTransfer.setData("text/drag-type", "move-payload");
                    }}
                    title={pallet.notes || pallet.projectId}
                    className={`flex h-full w-full flex-col justify-between rounded border border-amber-500 bg-amber-950/80 px-1.5 py-1 text-left text-amber-200 shadow-lg transition-all ${
                      "cursor-grab active:cursor-grabbing"
                    } ${selectedId === pallet.id ? "ring-2 ring-emerald-400" : ""} ${
                      matchesSearchQuery(pallet, query) ? slotStyles.searchMatch : ""
                    }`}
                  >
                    <span className="truncate text-[9px] font-mono font-bold text-gray-100">{pallet.id}</span>
                    <span className="truncate text-[9px] font-medium">ID: {pallet.projectId}</span>
                  </button>
                ) : (
                  <span className="select-none text-[9px] text-gray-600">Open</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-gray-400">
        {hint}
        {levelCount > 1 && " Hover a level tab while dragging to switch levels."}
      </p>
    </div>
  );
}