import { useEffect, useRef } from "react";
import { PhysicalPallet } from "./types";
import PalletSlot from "./PalletSlot";
import { getGridMetrics, type CanvasSize } from "./layoutPositions";

interface Props {
  slots: PhysicalPallet[];
  selectedSlot: PhysicalPallet | null;
  isAdminMode: boolean;
  searchQuery: string;
  onSelect: (slot: PhysicalPallet) => void;
  onPalletDrop: (sourceId: string, target: PhysicalPallet) => void;
  onZoneMove: (sourceId: string, xPct: number, yPct: number) => void;
  onCanvasSizeChange: (size: CanvasSize) => void;
}

export default function FloorCanvas({
  slots, selectedSlot, isAdminMode, searchQuery, onSelect, onPalletDrop, onZoneMove, onCanvasSizeChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      onCanvasSizeChange({ width: canvas.clientWidth, height: canvas.clientHeight });
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
  const grid = getGridMetrics({
    width: canvasRef.current?.clientWidth ?? 0,
    height: canvasRef.current?.clientHeight ?? 0,
  });

  return (
    <div
      ref={canvasRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`lg:col-span-3 rounded-xl p-4 relative min-h-[750px] shadow-inner overflow-hidden border transition-all ${
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
          onSelect={onSelect}
          onPalletDrop={onPalletDrop}
        />
      ))}
    </div>
  );
}