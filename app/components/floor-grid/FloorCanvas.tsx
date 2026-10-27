import { useEffect, useEffectEvent, useRef, useState } from "react";
import { PhysicalPallet, type GridFootprint } from "./types";
import PalletSlot from "./PalletSlot";
import FloorNav from "./FloorNav";
import ShelfView from "./ShelfView";
import { CELL_HEIGHT, CELL_WIDTH, getBayGridSize, type CanvasSize } from "./layoutPositions";
import type { BayId } from "./types";
import styles from "./FloorCanvas.module.css";

interface Props {
  slots: PhysicalPallet[];
  selectedSlot: PhysicalPallet | null;
  isAdminMode: boolean;
  searchQuery: string;
  activeBay: BayId;
  onBayChange: (bay: BayId) => void;
  onSelect: (slot: PhysicalPallet) => void;
  onPalletDrop: (sourceId: string, target: PhysicalPallet) => void;
  onZoneMove: (sourceId: string, xPct: number, yPct: number) => void;
  onCanvasSizeChange: (size: CanvasSize) => void;
  isPlacingItem: boolean;
  pendingFootprint: GridFootprint | null;
  placementAvailable: boolean;
  onFootprintChange: (footprint: GridFootprint | null) => void;
  onFinishPlacement: () => void;
  shelfContents: PhysicalPallet[];
  expandedShelfId: string | null;
  onCloseShelf: () => void;
  onShelfPalletDrop: (sourceId: string, xPct: number, yPct: number) => void;
  onShelfDrop: (sourceId: string, shelfId: string, level: number, column: number, row: number) => void;
}

export default function FloorCanvas({
  slots, selectedSlot, isAdminMode, searchQuery, activeBay, onBayChange, onSelect, onPalletDrop, onZoneMove, onCanvasSizeChange,
  isPlacingItem, pendingFootprint, placementAvailable, onFootprintChange, onFinishPlacement,
  shelfContents, expandedShelfId, onCloseShelf, onShelfDrop, onShelfPalletDrop,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const placementStartRef = useRef<{ pointerId: number; column: number; row: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const gridSize = getBayGridSize(activeBay);
  const canvasScale = isFullscreen && viewportWidth > 0
    ? Math.min(1, viewportWidth / (gridSize.columns * CELL_WIDTH))
    : 1;
  const cellWidth = CELL_WIDTH * canvasScale;
  const cellHeight = CELL_HEIGHT * canvasScale;

  const centerViewportOnSlots = useEffectEvent(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const centerX = slots.length
      ? slots.reduce((total, slot) => total + slot.xPos, 0) / slots.length / 100 * canvas.clientWidth
      : canvas.clientWidth / 2;
    const centerY = slots.length
      ? slots.reduce((total, slot) => total + slot.yPos, 0) / slots.length / 100 * canvas.clientHeight
      : canvas.clientHeight / 2;

    viewport.scrollTo({
      left: Math.max(0, centerX - viewport.clientWidth / 2),
      top: Math.max(0, centerY - viewport.clientHeight / 2),
    });
  });

  useEffect(() => {
    centerViewportOnSlots();
  }, [activeBay, slots.length]);

  useEffect(() => {
    const section = sectionRef.current;
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === section);
      if (viewportRef.current) setViewportWidth(viewportRef.current.clientWidth);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => setViewportWidth(viewport.clientWidth));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      onCanvasSizeChange(size);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onCanvasSizeChange]);

  const toggleFullscreen = async () => {
    const section = sectionRef.current;
    if (!section) return;

    try {
      if (document.fullscreenElement === section) {
        await document.exitFullscreen();
      } else {
        await section.requestFullscreen();
      }
      setIsFullscreen(document.fullscreenElement === section);
      if (viewportRef.current) setViewportWidth(viewportRef.current.clientWidth);
      setFullscreenError("");
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (!sourceId) return;
    const isZoneMove = dragType === "move-zone" && isAdminMode;
    if (!isZoneMove && dragType !== "move-payload") return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left - canvasRef.current.clientLeft) / canvasRef.current.clientWidth) * 100;
    const yPct = ((e.clientY - rect.top - canvasRef.current.clientTop) / canvasRef.current.clientHeight) * 100;
    // Zones are repositioned in blueprint mode; a shelved pallet dropped on open floor is taken off its shelf.
    if (isZoneMove) onZoneMove(sourceId, xPct, yPct);
    else onShelfPalletDrop(sourceId, xPct, yPct);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, [data-no-pan]")) return;

    const viewport = e.currentTarget;
    if (isAdminMode && isPlacingItem) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const column = Math.max(0, Math.min(gridSize.columns - 1, Math.floor((e.clientX - rect.left) / rect.width * gridSize.columns)));
      const row = Math.max(0, Math.min(gridSize.rows - 1, Math.floor((e.clientY - rect.top) / rect.height * gridSize.rows)));
      placementStartRef.current = { pointerId: e.pointerId, column, row };
      onFootprintChange({ column, row, widthCells: 1, heightCells: 1 });
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    panStartRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add(styles.panning);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const placementStart = placementStartRef.current;
    const canvas = canvasRef.current;
    if (placementStart?.pointerId === e.pointerId && canvas) {
      const rect = canvas.getBoundingClientRect();
      const column = Math.max(0, Math.min(gridSize.columns - 1, Math.floor((e.clientX - rect.left) / rect.width * gridSize.columns)));
      const row = Math.max(0, Math.min(gridSize.rows - 1, Math.floor((e.clientY - rect.top) / rect.height * gridSize.rows)));
      const left = Math.min(placementStart.column, column);
      const top = Math.min(placementStart.row, row);
      onFootprintChange({
        column: left,
        row: top,
        widthCells: Math.abs(column - placementStart.column) + 1,
        heightCells: Math.abs(row - placementStart.row) + 1,
      });
      return;
    }

    const panStart = panStartRef.current;
    if (!panStart || panStart.pointerId !== e.pointerId) return;

    e.currentTarget.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
    e.currentTarget.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
  };

  const finishPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId !== e.pointerId) return;
    panStartRef.current = null;
    e.currentTarget.classList.remove(styles.panning);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (placementStartRef.current?.pointerId === e.pointerId) {
      handlePointerMove(e);
      placementStartRef.current = null;
      onFinishPlacement();
      return;
    }
    finishPan(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (placementStartRef.current?.pointerId === e.pointerId) {
      placementStartRef.current = null;
      onFootprintChange(null);
      onFinishPlacement();
      return;
    }
    finishPan(e);
  };

  const query = searchQuery.trim().toLowerCase();
  const expandedShelf = expandedShelfId ? slots.find((slot) => slot.id === expandedShelfId) : undefined;
  const storedByShelf = new Map<string, PhysicalPallet[]>();
  for (const pallet of shelfContents) {
    if (!pallet.parentId) continue;
    const list = storedByShelf.get(pallet.parentId);
    if (list) list.push(pallet);
    else storedByShelf.set(pallet.parentId, [pallet]);
  }
  const matchesQuery = (pallet: PhysicalPallet) => pallet.projectId.toLowerCase().includes(query);

  return (
    <section ref={sectionRef} className={`${styles.fullscreenSection} lg:col-span-3 min-w-0`}>
      <FloorNav activeBay={activeBay} onBayChange={onBayChange} />
      <div className="mb-2 flex justify-end">
        <span className="font-mono text-xs text-gray-500">{gridSize.columns} columns x {gridSize.rows} rows</span>
      </div>
      <div
        ref={viewportRef}
        role="region"
        aria-label={`Bay ${activeBay.slice(-1)} floor map`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        className={`${styles.viewport} ${isPlacingItem ? styles.placementMode : ""} w-full overflow-auto overscroll-contain rounded-xl border shadow-inner ${
          isAdminMode
          ? "bg-gray-950 border-amber-500/50"
            : "bg-gray-950 border-gray-800"
        }`}
      >
        <div className={styles.viewportToolbar}>
          {fullscreenError && <span className="text-xs text-rose-300" role="status">{fullscreenError}</span>}
          <button
            type="button"
            className={`${styles.fullscreenButton} rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400`}
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen floor plan" : "View fullscreen floor plan"}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`${styles.mapCanvas} ${isAdminMode ? `${styles.blueprint} bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)]` : "bg-gray-950"}`}
          style={{
            width: gridSize.columns * cellWidth,
            height: gridSize.rows * cellHeight,
            ...(isAdminMode ? { backgroundSize: `${cellWidth}px ${cellHeight}px` } : {}),
          }}
        >
          {pendingFootprint && (
            <div
              aria-hidden="true"
              className={`${styles.placementPreview} ${placementAvailable ? styles.placementAvailable : styles.placementBlocked}`}
              style={{
                left: `${pendingFootprint.column / gridSize.columns * 100}%`,
                top: `${pendingFootprint.row / gridSize.rows * 100}%`,
                width: `${pendingFootprint.widthCells / gridSize.columns * 100}%`,
                height: `${pendingFootprint.heightCells / gridSize.rows * 100}%`,
              }}
            />
          )}

          {slots.map((slot) => (
            <PalletSlot
              key={slot.id}
              slot={slot}
              isAdminMode={isAdminMode}
              isSelected={selectedSlot?.id === slot.id}
              matchesSearch={query !== "" && (matchesQuery(slot) || (storedByShelf.get(slot.id) ?? []).some(matchesQuery))}
              scale={canvasScale}
              storedCount={storedByShelf.get(slot.id)?.length ?? 0}
              isExpanded={slot.id === expandedShelfId}
              onSelect={onSelect}
              onPalletDrop={onPalletDrop}
            />
          ))}

          {expandedShelf && (
            <ShelfView
              key={expandedShelf.id}
              shelf={expandedShelf}
              contents={storedByShelf.get(expandedShelf.id) ?? []}
              selectedId={selectedSlot?.id ?? null}
              query={query}
              isAdminMode={isAdminMode}
              scale={canvasScale}
              canvasWidth={gridSize.columns * cellWidth}
              canvasHeight={gridSize.rows * cellHeight}
              onClose={onCloseShelf}
              onSelect={onSelect}
              onDropPallet={(sourceId, level, column, row) => onShelfDrop(sourceId, expandedShelf.id, level, column, row)}
            />
          )}
        </div>
      </div>
    </section>
  );
}