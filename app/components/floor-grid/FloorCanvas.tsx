import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { PhysicalPallet, type GridFootprint } from "./types";
import PalletSlot from "./PalletSlot";
import FloorNav from "./FloorNav";
import ShelfView from "./ShelfView";
import { CELL_HEIGHT, CELL_WIDTH, findNearestOpenPosition, getBayGridSize, type CanvasSize } from "./layoutPositions";
import type { BayId } from "./types";
import styles from "./FloorCanvas.module.css";
import { BsLayoutSidebarReverse } from "react-icons/bs";

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

interface DropPreview {
  xPct: number;
  yPct: number;
  widthCells: number;
  heightCells: number;
  isValid: boolean;
}

interface Props {
  fullscreenTargetRef: RefObject<HTMLDivElement | null>;
  slots: PhysicalPallet[];
  selectedSlot: PhysicalPallet | null;
  isAdminMode: boolean;
  onToggleAdmin: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  activeBay: BayId;
  onBayChange: (bay: BayId) => void;
  onSelect: (slot: PhysicalPallet) => void;
  onClearSelection: () => void;
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
  fullscreenTargetRef, slots, selectedSlot, isAdminMode, onToggleAdmin, searchQuery, onSearchChange,
  isInspectorOpen, onToggleInspector, activeBay, onBayChange, onSelect, onClearSelection, onPalletDrop, onZoneMove, onCanvasSizeChange,
  isPlacingItem, pendingFootprint, placementAvailable, onFootprintChange, onFinishPlacement,
  shelfContents, expandedShelfId, onCloseShelf, onShelfDrop, onShelfPalletDrop,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomControlsRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const suppressBackgroundClickRef = useRef(false);
  const placementStartRef = useRef<{ pointerId: number; column: number; row: number } | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [draggedSlot, setDraggedSlot] = useState<PhysicalPallet | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const gridSize = getBayGridSize(activeBay);
  const fitScale = isFullscreen && viewportWidth > 0
    ? Math.min(1, viewportWidth / (gridSize.columns * CELL_WIDTH))
    : 1;
  const canvasScale = fitScale * zoomLevel / 100;
  const cellWidth = CELL_WIDTH * canvasScale;
  const cellHeight = CELL_HEIGHT * canvasScale;

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!anchor || !viewport || !canvas) return;

    const viewportRect = viewport.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    viewport.scrollLeft += canvasRect.left + anchor.x * canvasRect.width - viewportRect.left - viewport.clientWidth / 2;
    viewport.scrollTop += canvasRect.top + anchor.y * canvasRect.height - viewportRect.top - viewport.clientHeight / 2;
    zoomAnchorRef.current = null;
  }, [zoomLevel]);

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
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenTargetRef.current);
      if (viewportRef.current) setViewportWidth(viewportRef.current.clientWidth);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, [fullscreenTargetRef]);

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
    const target = fullscreenTargetRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
      setIsFullscreen(document.fullscreenElement === target);
      if (viewportRef.current) setViewportWidth(viewportRef.current.clientWidth);
      setFullscreenError("");
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  };

  const changeZoom = (nextZoom: number) => {
    const nextLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    if (nextLevel === zoomLevel) return;

    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (viewport && canvas) {
      const viewportRect = viewport.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      zoomAnchorRef.current = {
        x: Math.max(0, Math.min(1, (viewportRect.left + viewport.clientWidth / 2 - canvasRect.left) / canvasRect.width)),
        y: Math.max(0, Math.min(1, (viewportRect.top + viewport.clientHeight / 2 - canvasRect.top) / canvasRect.height)),
      };
    }
    setZoomLevel(nextLevel);
  };

  const handleZoomWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY !== 0) changeZoom(zoomLevel + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  });

  useEffect(() => {
    const zoomControls = zoomControlsRef.current;
    if (!zoomControls) return;

    const handleWheel = (event: WheelEvent) => handleZoomWheel(event);
    zoomControls.addEventListener("wheel", handleWheel, { passive: false });
    return () => zoomControls.removeEventListener("wheel", handleWheel);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);
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

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !draggedSlot) return;

    const targetElement = (e.target as HTMLElement).closest<HTMLElement>("[data-floor-slot-id]");
    const targetSlot = targetElement
      ? slots.find((slot) => slot.id === targetElement.dataset.floorSlotId)
      : undefined;
    if (
      !isAdminMode && draggedSlot.itemType === "pallet" && draggedSlot.isOccupied &&
      targetSlot?.itemType === "pallet" && !targetSlot.isOccupied
    ) {
      setDropPreview({
        xPct: targetSlot.xPos,
        yPct: targetSlot.yPos,
        widthCells: targetSlot.widthCells,
        heightCells: targetSlot.heightCells,
        isValid: true,
      });
      return;
    }

    const isZoneMove = isAdminMode && !draggedSlot.parentId;
    const isShelfPallet = !isAdminMode && draggedSlot.itemType === "pallet" && Boolean(draggedSlot.parentId);
    if (!isZoneMove && !isShelfPallet) {
      setDropPreview(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPct = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    const yPct = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100));
    const nearest = findNearestOpenPosition(
      slots,
      { width: rect.width, height: rect.height },
      activeBay,
      xPct,
      yPct,
      draggedSlot.id,
      draggedSlot,
    );
    setDropPreview({
      xPct: nearest?.xPos ?? xPct,
      yPct: nearest?.yPos ?? yPct,
      widthCells: draggedSlot.widthCells,
      heightCells: draggedSlot.heightCells,
      isValid: nearest !== null,
    });
  };

  const handleCanvasDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropPreview(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressBackgroundClickRef.current = false;
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

    if (Math.abs(e.clientX - panStart.x) > 4 || Math.abs(e.clientY - panStart.y) > 4) {
      suppressBackgroundClickRef.current = true;
    }
    e.currentTarget.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
    e.currentTarget.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
  };

  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressBackgroundClickRef.current) {
      suppressBackgroundClickRef.current = false;
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest("[data-floor-slot-id], [data-no-pan], button, input, select, textarea, a")) return;
    if (!isPlacingItem) onClearSelection();
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
    <section className={`${styles.fullscreenSection} ${isFullscreen ? styles.fullscreenCanvas : ""} min-w-0`}>
      <FloorNav activeBay={activeBay} onBayChange={onBayChange} />
      <div className="mb-2 flex justify-end">
        <span className="font-mono text-xs text-gray-500">{gridSize.columns} columns x {gridSize.rows} rows</span>
      </div>
      <div className={styles.viewportToolbar} role="toolbar" aria-label="Floor map controls" data-no-pan>
        <label className={styles.toolbarSearchGroup}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m15.5 15.5 4 4" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search ID, project, name, notes..."
            aria-label="Search by item ID, project, name, or notes"
            className={styles.toolbarSearch}
          />
        </label>
        <div className={styles.toolbarActions}>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              onClick={onToggleAdmin}
              className={`${styles.toolbarButton} ${isAdminMode ? styles.activeToolbarButton : ""}`}
            >
              {isAdminMode ? "Exit edit" : "Edit layout"}
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            <div
              ref={zoomControlsRef}
              className={`${styles.zoomControls} pointer-events-auto flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 p-1`}
              role="group"
              aria-label="Map zoom controls"
              title="Use the buttons or scroll over these controls to change zoom"
            >
              <button
                type="button"
                className="min-h-10 min-w-10 rounded text-lg font-semibold leading-none text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                onClick={() => changeZoom(zoomLevel - ZOOM_STEP)}
                disabled={zoomLevel <= MIN_ZOOM}
                aria-label="Zoom out"
                title="Zoom out"
              >
                -
              </button>
              <span
                className={styles.zoomReadout}
                aria-label={`Zoom ${zoomLevel} percent. Scroll here to adjust zoom.`}
                aria-live="polite"
              >
                {zoomLevel}%
              </span>
              <button
                type="button"
                className="min-h-10 min-w-10 rounded text-lg font-semibold leading-none text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                onClick={() => changeZoom(zoomLevel + ZOOM_STEP)}
                disabled={zoomLevel >= MAX_ZOOM}
                aria-label="Zoom in"
                title="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="min-h-10 rounded px-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                onClick={() => changeZoom(100)}
                aria-label="Reset zoom to 100%"
                title="Reset zoom"
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Exit fullscreen floor plan" : "View fullscreen floor plan"}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Exit fullscreen floor plan" : "View fullscreen floor plan"}
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            <button
  type="button"
  className={`${styles.panelToggle} ${isInspectorOpen ? styles.activePanelToggle : ""}`}
  onClick={onToggleInspector}
  aria-expanded={isInspectorOpen}
  aria-controls="floor-inspector"
  aria-label="Inspector panel"
  title={`${isInspectorOpen ? "Hide" : "Show"} inspector (I)`}
>
  <BsLayoutSidebarReverse aria-hidden="true" focusable="false" />
</button>
          </div>
        </div>
      </div>
      {fullscreenError && <span className={`${styles.toolbarStatus} mb-2 text-xs text-rose-300`} role="status">{fullscreenError}</span>}
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
        onClick={handleViewportClick}
        className={`${styles.viewport} ${isPlacingItem ? styles.placementMode : ""} w-full overflow-auto overscroll-contain rounded-xl border shadow-inner ${
          isAdminMode
          ? "bg-gray-950 border-amber-500/50"
            : "bg-gray-950 border-gray-800"
        }`}
      >
        <div
          ref={canvasRef}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleDrop}
          className={`${styles.mapCanvas} ${isAdminMode ? styles.blueprint : ""}`}
          style={{
            width: gridSize.columns * cellWidth,
            height: gridSize.rows * cellHeight,
            backgroundSize: `${cellWidth}px ${cellHeight}px`,
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

          {dropPreview && (
            <div
              aria-hidden="true"
              className={`${styles.dropPreview} ${dropPreview.isValid ? styles.dropPreviewAvailable : styles.dropPreviewBlocked}`}
              style={{
                left: `${dropPreview.xPct}%`,
                top: `${dropPreview.yPct}%`,
                width: `${dropPreview.widthCells / gridSize.columns * 100}%`,
                height: `${dropPreview.heightCells / gridSize.rows * 100}%`,
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
              onItemDragStart={(dragged) => {
                setDraggedSlot(dragged);
                setDropPreview(null);
              }}
              onItemDragEnd={() => {
                setDraggedSlot(null);
                setDropPreview(null);
              }}
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