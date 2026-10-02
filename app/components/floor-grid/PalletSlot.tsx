import { PhysicalPallet } from "./types";
import styles from "./PalletSlot.module.css";

interface Props {
  slot: PhysicalPallet;
  isAdminMode: boolean;
  isSelected: boolean;
  matchesSearch: boolean;
  onSelect: (slot: PhysicalPallet) => void;
  onPalletDrop: (sourceId: string, target: PhysicalPallet) => void;
}

export default function PalletSlot({ slot, isAdminMode, isSelected, matchesSearch, onSelect, onPalletDrop }: Props) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/source-id", slot.id);
    e.dataTransfer.setData("text/drag-type", isAdminMode ? "move-zone" : "move-payload");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (isAdminMode || dragType !== "move-payload") return;
    onPalletDrop(sourceId, slot);
  };

  return (
    <div
      style={{ left: `${slot.xPos}%`, top: `${slot.yPos}%` }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={styles.positioner}
    >
      <button
        onClick={() => onSelect(slot)}
        draggable={isAdminMode || slot.isOccupied}
        onDragStart={handleDragStart}
        className={`${styles.slotButton} shadow-lg ${
          isAdminMode
            ? "bg-gray-900 border-amber-500 text-amber-300 cursor-move border-dashed hover:border-amber-400"
            : slot.isOccupied
              ? "bg-amber-950/60 border-amber-500 text-amber-300 cursor-grab active:cursor-grabbing"
              : "bg-gray-900/40 border-gray-800 text-gray-600 hover:border-gray-600 cursor-pointer"
        } ${isSelected ? "ring-2 ring-emerald-400 border-transparent z-10 scale-105" : ""} ${
          matchesSearch ? "ring-4 ring-cyan-400 border-transparent z-20 scale-110 animate-bounce" : ""
        }`}
      >
        <div className="flex justify-between items-start w-full">
          <span className="text-[9px] font-mono bg-gray-800/90 text-gray-200 px-1 rounded font-bold truncate max-w-[70px]">
            {slot.id}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAdminMode ? "bg-amber-400" : slot.isOccupied ? "bg-amber-400 animate-pulse" : "bg-gray-700"
            }`}
          ></span>
        </div>
        
      </button>
    </div>
  );
}