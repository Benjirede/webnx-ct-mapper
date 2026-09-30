import { useState } from "react";
import { PhysicalPallet } from "./types";

interface Props {
  selectedSlot: PhysicalPallet | null;
  onCreate: (id: string) => Promise<boolean>;
  onRename: (newName: string) => void;
}

export default function AdminPanel({ selectedSlot, onCreate, onRename }: Props) {
  const [newSlotId, setNewSlotId] = useState("");
  const [renameValue, setRenameValue] = useState(selectedSlot?.id ?? "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await onCreate(newSlotId)) setNewSlotId("");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-md font-mono font-bold text-amber-400 uppercase tracking-wider border-b border-gray-700 pb-2">
        🛠️ Blueprint Control Deck
      </h2>

      <form onSubmit={handleCreate} className="space-y-2">
        <label className="text-xs text-gray-400 font-mono block">CREATE NEW STAGING ZONE</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. RACK-C1"
            value={newSlotId}
            onChange={(e) => setNewSlotId(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-400"
          />
          <button type="submit" className="bg-amber-500 text-gray-950 font-bold px-3 rounded text-sm hover:bg-amber-600 transition-colors">
            Create
          </button>
        </div>
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