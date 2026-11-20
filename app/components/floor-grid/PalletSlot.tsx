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

const palletStatusStyles: Record<NonNullable<PhysicalPallet["status"]>, string> = {
  empty: "border-violet-500 bg-violet-950/80 text-violet-100",
  "in-progress": "border-blue-500 bg-blue-950/80 text-blue-100",
  "on-hold": "border-red-500 bg-red-950/80 text-red-100",
  "direct-sale": "border-yellow-400 bg-yellow-950/80 text-yellow-100",
  "dc-techs": "border-green-500 bg-green-950/80 text-green-100",
  inactive: "border-gray-500 bg-gray-800 text-gray-200",
};

const palletStatusColors: Record<NonNullable<PhysicalPallet["status"]>, {
  backgroundColor: string;
  borderColor: string;
  color: string;
}> = {
  empty: { backgroundColor: "#4c1d95", borderColor: "#8b5cf6", color: "#ede9fe" },
  "in-progress": { backgroundColor: "#1e3a8a", borderColor: "#3b82f6", color: "#dbeafe" },
  "on-hold": { backgroundColor: "#7f1d1d", borderColor: "#ef4444", color: "#fee2e2" },
  "direct-sale": { backgroundColor: "#713f12", borderColor: "#facc15", color: "#fef9c3" },
  "dc-techs": { backgroundColor: "#14532d", borderColor: "#22c55e", color: "#dcfce7" },
  inactive: { backgroundColor: "#374151", borderColor: "#6b7280", color: "#e5e7eb" },
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
  const status = slot.status ?? "empty";
  const statusColor = palletStatusColors[status];

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
          ...(slot.itemType === "pallet"
            ? statusColor
            : {}),
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
        } ${slot.itemType === "pallet" ? palletStatusStyles[status] : ""}`}
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