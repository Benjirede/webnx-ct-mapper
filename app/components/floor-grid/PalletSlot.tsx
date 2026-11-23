import {
  FLOOR_ITEM_LABELS,
  getLevelCount,
  PALLET_STATUS_GLYPHS,
  PALLET_STATUS_LABELS,
  type PhysicalPallet,
} from "./types";
import { CELL_HEIGHT, CELL_WIDTH } from "./layoutPositions";
import styles from "./PalletSlot.module.css";
import {
  FLOOR_ITEM_STYLES,
  PALLET_STATUS_BADGES,
  PALLET_STATUS_STYLES,
} from "./floorItemStyles";

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
        aria-label={slot.itemType === "pallet"
          ? `${slot.id}, ${PALLET_STATUS_LABELS[status]}${slot.projectId ? `, ${slot.projectId}` : ""}`
          : slot.id}
        title={slot.itemType === "pallet"
          ? `${PALLET_STATUS_LABELS[status]}${slot.projectId ? ` · ${slot.projectId}` : ""}`
          : undefined}
        onClick={() => onSelect(slot)}
        draggable={isAdminMode || (slot.itemType === "pallet" && slot.isOccupied)}
        onDragStart={handleDragStart}
        style={{
          width: `${Math.max(32, slot.widthCells * CELL_WIDTH - 8)}px`,
          height: `${Math.max(28, slot.heightCells * CELL_HEIGHT - 8)}px`,
        }}
        className={`${styles.slotButton} ${FLOOR_ITEM_STYLES[slot.itemType]} ${
          slot.itemType === "pallet" ? PALLET_STATUS_STYLES[status] : ""
        } shadow-lg ${
          isAdminMode
            ? "cursor-move"
            : slot.itemType === "pallet"
              ? slot.isOccupied
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-pointer"
              : "cursor-pointer"
        } ${isSelected ? "ring-2 ring-emerald-400 z-10 scale-105" : ""} ${
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
        {slot.itemType === "pallet" ? (
          <div className={styles.palletCardDetails}>
            <span className={`${styles.palletStatusLabel} truncate`}>
              {PALLET_STATUS_GLYPHS[status] && (
                <span
                  aria-hidden="true"
                  className={PALLET_STATUS_BADGES[status] ?? ""}
                >
                  {PALLET_STATUS_GLYPHS[status]}
                </span>
              )}
              <span className="truncate">{PALLET_STATUS_LABELS[status]}</span>
            </span>
            {slot.projectId && (
              <span className={styles.palletProjectId}>ID: {slot.projectId}</span>
            )}
          </div>
        ) : (
          <span className="truncate text-[9px] font-medium">
            {isContainer
              ? `${storedCount}/${capacity} stored ${isExpanded ? "\u25B4" : "\u25BE"}`
              : FLOOR_ITEM_LABELS[slot.itemType]}
          </span>
        )}
      </button>
    </div>
  );
}