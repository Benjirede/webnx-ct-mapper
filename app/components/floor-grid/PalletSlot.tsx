import { FLOOR_ITEM_LABELS, type FloorItemType, type PhysicalPallet } from "./types";
import { CELL_HEIGHT, CELL_WIDTH } from "./layoutPositions";
import styles from "./PalletSlot.module.css";

const itemTypeStyles: Record<FloorItemType, string> = {
  pallet: styles.pallet,
  "walking-lane": styles.walkingLane,
  desk: styles.desk,
  shelf: styles.shelf,
  other: styles.other,
};

interface Props {
  slot: PhysicalPallet;
  isAdminMode: boolean;
  isSelected: boolean;
  matchesSearch: boolean;
  scale: number;
  onSelect: (slot: PhysicalPallet) => void;
  onPalletDrop: (sourceId: string, target: PhysicalPallet) => void;
}

export default function PalletSlot({ slot, isAdminMode, isSelected, matchesSearch, scale, onSelect, onPalletDrop }: Props) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/source-id", slot.id);
    e.dataTransfer.setData("text/drag-type", isAdminMode ? "move-zone" : "move-payload");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (isAdminMode || dragType !== "move-payload" || slot.itemType !== "pallet") return;
    onPalletDrop(sourceId, slot);
  };

  return (
    <div
      style={{
        left: `${slot.xPos}%`,
        top: `${slot.yPos}%`,
        ...(scale === 1 ? {} : { transform: `translate(-50%, -50%) scale(${scale})` }),
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={styles.positioner}
    >
      <button
        type="button"
        onClick={() => onSelect(slot)}
        draggable={isAdminMode || (slot.itemType === "pallet" && slot.isOccupied)}
        onDragStart={handleDragStart}
        style={{
          width: `${Math.max(32, slot.widthCells * CELL_WIDTH - 8)}px`,
          height: `${Math.max(28, slot.heightCells * CELL_HEIGHT - 8)}px`,
        }}
        className={`${styles.slotButton} ${itemTypeStyles[slot.itemType]} shadow-lg ${
          isAdminMode
            ? "border-amber-300 cursor-move border-dashed"
            : slot.itemType === "pallet"
              ? slot.isOccupied
                ? "bg-amber-950/80 border-amber-500 text-amber-200 cursor-grab active:cursor-grabbing"
                : "border-gray-600 text-gray-100 cursor-pointer"
              : "cursor-pointer"
        } ${isSelected ? "ring-2 ring-emerald-400 border-transparent z-10 scale-105" : ""} ${
          matchesSearch ? "ring-4 ring-cyan-400 border-transparent z-20 scale-110 animate-bounce" : ""
        }`}
      >
        <div className="flex justify-between items-start w-full">
          <span className="text-[9px] font-mono bg-gray-950/80 text-gray-100 px-1 rounded font-bold truncate max-w-[70px]">
            {slot.id}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAdminMode ? "bg-amber-300" : slot.isOccupied ? "bg-amber-300 animate-pulse" : "bg-white/70"
            }`}
          ></span>
        </div>
        <span className="truncate text-[9px] font-medium">
          {slot.itemType === "pallet" && slot.isOccupied
            ? `ID: ${slot.projectId}`
            : FLOOR_ITEM_LABELS[slot.itemType]}
        </span>
      </button>
    </div>
  );
}