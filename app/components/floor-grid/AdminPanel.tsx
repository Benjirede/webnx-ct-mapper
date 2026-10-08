import { useState } from "react";
import { PhysicalPallet, type GridFootprint } from "./types";

interface Props {
  selectedSlot: PhysicalPallet | null;
  isPlacingPallet: boolean;
  pendingFootprint: GridFootprint | null;
  placementAvailable: boolean;
  onStartPlacement: () => void;
  onCancelPlacement: () => void;
  onCreate: (id: string, footprint: GridFootprint) => Promise<boolean>;
  onRename: (newName: string) => void;
}

export default function AdminPanel({
  selectedSlot, isPlacingPallet, pendingFootprint, placementAvailable,
  onStartPlacement, onCancelPlacement, onCreate, onRename,
}: Props) {
  const [newSlotId, setNewSlotId] = useState("");
  const [renameValue, setRenameValue] = useState(selectedSlot?.id ?? "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFootprint || !placementAvailable) return;
    const confirmation = `Create ${newSlotId.trim()} as a ${pendingFootprint.widthCells} x ${pendingFootprint.heightCells} pallet in the selected bay?`;
    if (!window.confirm(confirmation)) return;
    if (await onCreate(newSlotId, pendingFootprint)) setNewSlotId("");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-md font-mono font-bold text-amber-400 uppercase tracking-wider border-b border-gray-700 pb-2">
        🛠️ Blueprint Control Deck
      </h2>

      <form onSubmit={handleCreate} className="space-y-2">
        <label htmlFor="new-pallet-id" className="text-xs text-gray-400 font-mono block">CREATE PALLET</label>
        <input
          id="new-pallet-id"
          type="text"
          placeholder="e.g. PALLET-C1"
          value={newSlotId}
          onChange={(e) => setNewSlotId(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-400"
        />

        {isPlacingPallet ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-amber-200">Click-drag across empty grid cells, then release.</p>
            <button
              type="button"
              onClick={onCancelPlacement}
              className="shrink-0 rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartPlacement}
            disabled={!newSlotId.trim()}
            className="w-full rounded border border-amber-500/60 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Choose footprint on floor
          </button>
        )}

        {pendingFootprint && !isPlacingPallet && (
          <div className={`rounded border p-2 text-xs ${placementAvailable ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-rose-700 bg-rose-950/40 text-rose-200"}`}>
            <p>
              {pendingFootprint.widthCells} x {pendingFootprint.heightCells} cells
              {placementAvailable ? " selected" : " overlaps another pallet or is out of bounds"}
            </p>
          </div>
        )}

        {pendingFootprint && !isPlacingPallet && (
          <button
            type="submit"
            disabled={!newSlotId.trim() || !placementAvailable}
            className="w-full rounded bg-amber-500 px-3 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create pallet
          </button>
        )}
      </form>

      {selectedSlot && (
        // key resets the rename field whenever a different zone is selected
        <div key={selectedSlot.id} className="pt-4 border-t border-gray-700 space-y-2">
          <label className="text-xs text-gray-400 font-mono block">RENAME SELECTED ZONE ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-emerald-300 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => onRename(renameValue)}
              className="bg-emerald-500 text-gray-950 font-bold px-3 rounded text-xs hover:bg-emerald-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900/60 p-3 rounded border border-gray-700 text-[11px] text-gray-400 leading-relaxed space-y-1">
        <p className="font-bold text-amber-300">💡 Snapping Controls Active:</p>
        <p>
          Zone slots now align to an **automatic grid snapping step matrix** when dragged. Select any item to edit its
          name identifier label directly.
        </p>
      </div>
    </div>
  );
}