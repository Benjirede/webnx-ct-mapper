import { FLOOR_ITEM_LABELS, getLevelCount, type FloorItemType, type PhysicalPallet } from "./types";
import { CELL_HEIGHT, CELL_WIDTH } from "./layoutPositions";
import styles from "./PalletSlot.module.css";

const itemTypeStyles: Record<FloorItemType, string> = {
  pallet: styles.pallet,
  "walking-lane": styles.walkingLane,
  desk: styles.desk,
  shelf: styles.shelf,
  rack: styles.rack,
  island: styles.island,
  workbench: styles.workbench,
  other: styles.other,
};

interface Props {
  slot: PhysicalPallet;
  isAdminMode: boolean;
  isSelected: boolean;
  matchesSearch: boolean;
  scale: number;
  storedCount: number;
  isExpanded: boolean;
  onSelect: (slot: PhysicalPallet) => void;
  onPalletDrop: (sourceId: string, target: PhysicalPallet) => void;
  onItemDragStart: (slot: PhysicalPallet) => void;
  onItemDragEnd: () => void;
}

export default function PalletSlot({
  slot, isAdminMode, isSelected, matchesSearch, scale, storedCount, isExpanded,
  onSelect, onPalletDrop, onItemDragStart, onItemDragEnd,
}: Props) {
  const levelCount = getLevelCount(slot);
  const isContainer = levelCount > 0;
  const capacity = slot.widthCells * slot.heightCells * levelCount;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/source-id", slot.id);
    e.dataTransfer.setData("text/drag-type", isAdminMode ? "move-zone" : "move-payload");
    onItemDragStart(slot);

    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const dragImage = button.cloneNode(true) as HTMLButtonElement;
    dragImage.style.position = "fixed";
    dragImage.style.left = `${rect.left}px`;
    dragImage.style.top = `${rect.top}px`;
    dragImage.style.zIndex = "-1";
    dragImage.style.pointerEvents = "none";
    dragImage.style.transform = `scale(${scale})`;
    dragImage.style.transformOrigin = "top left";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(
      dragImage,
      (e.clientX - rect.left) * scale,
      (e.clientY - rect.top) * scale,
    );
    window.setTimeout(() => dragImage.remove(), 0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (isAdminMode || dragType !== "move-payload" || slot.itemType !== "pallet") return;
    e.stopPropagation();
    onPalletDrop(sourceId, slot);
  };

  return (
    <div
      style={{
        left: `${slot.xPos}%`,
        top: `${slot.yPos}%`,
        ...(scale === 1 ? {} : { transform: `translate(-50%, -50%) scale(${scale})` }),
      }}
      data-floor-slot-id={slot.id}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnd={onItemDragEnd}
      className={styles.positioner}
    >
      <button
        type="button"
        aria-expanded={isContainer ? isExpanded : undefined}
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
          matchesSearch ? styles.searchMatch : ""
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
            : isContainer
              ? `${storedCount}/${capacity} stored ${isExpanded ? "\u25B4" : "\u25BE"}`
              : FLOOR_ITEM_LABELS[slot.itemType]}
        </span>
      </button>
    </div>
  );
}