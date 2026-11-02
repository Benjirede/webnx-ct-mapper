import { useState, type ComponentProps } from "react";
import {
  FLOOR_ITEM_LABELS,
  FLOOR_ITEM_TYPES,
  DEFAULT_LEVEL,
  LEVEL_OPTIONS,
  hasLevels,
  MAX_ITEM_ID_LENGTH,
  type FloorItemType,
  type GridFootprint,
  type PhysicalPallet,
} from "./types";
import InspectorPanel from "./InspectorPanel";

type InspectorProps = ComponentProps<typeof InspectorPanel>;

interface Props {
  selectedSlot: PhysicalPallet | null;
  selectedStoredCount: number;
  isPlacingItem: boolean;
  pendingFootprint: GridFootprint | null;
  placementAvailable: boolean;
  onStartPlacement: () => void;
  onCancelPlacement: () => void;
  onCreate: (id: string, itemType: FloorItemType, footprint: GridFootprint, levels?: number) => Promise<boolean>;
  /** The same handlers the Staging Inspector uses. Renaming the ID happens inside the inspector. */
  onSave: InspectorProps["onSave"];
  onRename?: InspectorProps["onRename"];
  onDelete: InspectorProps["onDelete"];
}

export default function AdminPanel({
  selectedSlot, selectedStoredCount, isPlacingItem, pendingFootprint, placementAvailable,
  onStartPlacement, onCancelPlacement, onCreate, onSave, onRename, onDelete,
}: Props) {
  const [newSlotId, setNewSlotId] = useState("");
  const [itemType, setItemType] = useState<FloorItemType>("pallet");
  const [levels, setLevels] = useState<number>(DEFAULT_LEVEL);

  const itemHasLevels = hasLevels(itemType);

  const handleCreate = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !pendingFootprint ||
      !placementAvailable ||
      !newSlotId.trim() ||
      newSlotId.trim().length > MAX_ITEM_ID_LENGTH
    ) return;
    const levelsText = itemHasLevels ? `, ${levels} ${levels === 1 ? "level" : "levels"}` : "";
    const confirmation = `Create ${newSlotId.trim()} as ${FLOOR_ITEM_LABELS[itemType]} (${pendingFootprint.widthCells} x ${pendingFootprint.heightCells} cells${levelsText}) in this bay?`;
    if (!window.confirm(confirmation)) return;
    if (await onCreate(newSlotId, itemType, pendingFootprint, itemHasLevels ? levels : undefined)) {
      setNewSlotId("");
      setItemType("pallet");
      setLevels(DEFAULT_LEVEL);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-700 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">Layout Controls</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-100">Add Floor Item</h2>
      </header>

      <section aria-labelledby="add-item-title" className="space-y-4">
        <div>
          <p className="mt-1 text-xs text-gray-400">Enter an ID and type of floor item to add. Then select the space to take up on the floor.</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-pallet-id" className="block text-xs font-medium text-gray-300">Item ID</label>
            <input
              id="new-pallet-id"
              type="text"
              placeholder="e.g. DESK-C1"
              value={newSlotId}
              maxLength={MAX_ITEM_ID_LENGTH}
              required
              onChange={(e) => setNewSlotId(e.target.value)}
              aria-describedby="new-pallet-id-limit"
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
            <p id="new-pallet-id-limit" className="text-xs text-gray-500">
              {newSlotId.length}/{MAX_ITEM_ID_LENGTH} characters
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="floor-item-type" className="block text-xs font-medium text-gray-300">Item type</label>
            <select
              id="floor-item-type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as FloorItemType)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            >
              {FLOOR_ITEM_TYPES.map((type) => (
                <option key={type} value={type}>{FLOOR_ITEM_LABELS[type]}</option>
              ))}
            </select>
          </div>

          {itemHasLevels && (
            <div className="space-y-1.5">
              <label htmlFor="shelf-levels" className="block text-xs font-medium text-gray-300">Shelf levels</label>
              <select
                id="shelf-levels"
                value={levels}
                onChange={(e) => setLevels(Number(e.target.value))}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              >
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>{level} {level === 1 ? "level" : "levels"}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">How many levels this shelf has. Pallets can be placed on each level.</p>
            </div>
          )}

          {isPlacingItem ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-amber-300" />
                <span className="text-sm font-medium text-amber-100">Placement active</span>
              </div>
              <button
                type="button"
                onClick={onCancelPlacement}
                className="shrink-0 rounded border border-amber-300/30 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartPlacement}
              disabled={!newSlotId.trim()}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm font-semibold text-gray-100 transition-colors hover:border-amber-400/70 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Set footprint on floor
            </button>
          )}

          {pendingFootprint && !isPlacingItem && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-md border px-3 py-2.5 ${placementAvailable ? "border-emerald-700/70 bg-emerald-950/40" : "border-rose-700/70 bg-rose-950/40"}`}
            >
              <p className={`text-sm font-semibold ${placementAvailable ? "text-emerald-200" : "text-rose-200"}`}>
                {placementAvailable ? "Footprint ready" : "Footprint unavailable"}
              </p>
              <p className="mt-0.5 text-xs text-gray-300">
                {FLOOR_ITEM_LABELS[itemType]} · {pendingFootprint.widthCells} x {pendingFootprint.heightCells} cells
                {itemHasLevels && ` · ${levels} ${levels === 1 ? "level" : "levels"}`}
                {!placementAvailable && " · Overlaps an item or is out of bounds"}
              </p>
            </div>
          )}

          {pendingFootprint && !isPlacingItem && (
            <button
              type="submit"
              disabled={!newSlotId.trim() || !placementAvailable}
              className="w-full rounded-md bg-amber-400 px-3 py-2.5 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create {FLOOR_ITEM_LABELS[itemType].toLowerCase()}
            </button>
          )}
        </form>
      </section>

      {selectedSlot && (
        <section aria-label="Selected item" className="space-y-4 border-t border-gray-700 pt-5">
          {/* key resets the inspector's fields whenever a different item is selected */}
          <InspectorPanel
            key={selectedSlot.id}
            slot={selectedSlot}
            storedCount={selectedStoredCount}
            onSave={onSave}
            onRename={onRename}
            onDelete={onDelete}
          />
        </section>
      )}
    </div>
  );
}