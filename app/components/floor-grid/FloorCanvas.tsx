import { useEffect, useRef, useState } from "react";
import { PhysicalPallet } from "./types";
import PalletSlot from "./PalletSlot";
import FloorNav from "./FloorNav";
import { getGridMetrics, type CanvasSize } from "./layoutPositions";
import type { BayId } from "./types";

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
}

export default function FloorCanvas({
  slots, selectedSlot, isAdminMode, searchQuery, activeBay, onBayChange, onSelect, onPalletDrop, onZoneMove, onCanvasSizeChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setLocalCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      setLocalCanvasSize(size);
      onCanvasSizeChange(size);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onCanvasSizeChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !isAdminMode) return;

    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (dragType !== "move-zone" || !sourceId) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left - canvasRef.current.clientLeft) / canvasRef.current.clientWidth) * 100;
    const yPct = ((e.clientY - rect.top - canvasRef.current.clientTop) / canvasRef.current.clientHeight) * 100;
    onZoneMove(sourceId, xPct, yPct);
  };

  const query = searchQuery.trim().toLowerCase();
  const grid = getGridMetrics(canvasSize);

  return (
    <section className="lg:col-span-3 min-w-0">
      <FloorNav activeBay={activeBay} onBayChange={onBayChange} />
      <div
        ref={canvasRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`rounded-xl p-4 relative min-h-[750px] shadow-inner overflow-hidden border transition-all ${
          isAdminMode
            ? "bg-gray-950 border-amber-500/50 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)]"
            : "bg-gray-950 border-gray-800"
        }`}
        style={isAdminMode && grid ? { backgroundSize: `${grid.cellWidth}px ${grid.cellHeight}px` } : undefined}
      >
        <div className="absolute left-[35%] top-0 bottom-0 border-r border-dashed border-gray-800/60 pointer-events-none flex items-center justify-center">
          <span className="text-[10px] uppercase font-mono tracking-widest text-gray-700 select-none rotate-90">
            Main Tech Walking Lane
          </span>
        </div>

        {slots.map((slot) => (
          <PalletSlot
            key={slot.id}
            slot={slot}
            isAdminMode={isAdminMode}
            isSelected={selectedSlot?.id === slot.id}
            matchesSearch={query !== "" && slot.projectId.toLowerCase().includes(query)}
            cellWidth={grid?.cellWidth ?? 90}
            cellHeight={grid?.cellHeight ?? 80}
            onSelect={onSelect}
            onPalletDrop={onPalletDrop}
          />
        ))}
      </div>
    </section>
  );
}