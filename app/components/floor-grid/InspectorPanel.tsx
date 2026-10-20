import { useState } from "react";
import { FLOOR_ITEM_LABELS, type PhysicalPallet } from "./types";
import DeleteItemButton from "./DeleteItemButton";

interface Props {
  slot: PhysicalPallet;
  onSave: (projectId: string, notes: string) => void;
  onDelete: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function InspectorPanel({ slot, onSave, onDelete }: Props) {
  const [projectId, setProjectId] = useState(slot.projectId);
  const [notes, setNotes] = useState(slot.notes ?? "");
  const isPallet = slot.itemType === "pallet";
  const typeLabel = FLOOR_ITEM_LABELS[slot.itemType];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-gray-400 font-mono block">{typeLabel} ID</span>
          <p className="text-xl font-bold text-emerald-400">{slot.id}</p>
        </div>
        <DeleteItemButton itemId={slot.id} onDelete={onDelete} />
      </div>

      {isPallet ? (
        <div className="space-y-1">
          <label htmlFor="inspector-project" className="text-xs text-gray-400 font-mono block">PROJECT NAME</label>
          <input
            id="inspector-project"
            type="text"
            placeholder="Enter ID to spawn pallet (Clear to empty)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
          />
        </div>
      ) : (
        <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
          <p className="font-semibold text-emerald-300">{typeLabel}</p>
          <p className="mt-1 text-xs text-gray-400">
            Footprint: {slot.widthCells} x {slot.heightCells} cells
          </p>
          <p className="mt-1 text-xs text-gray-400">Bay {slot.bayId.slice(-1)}</p>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="inspector-notes" className="text-xs text-gray-400 font-mono block">
          {isPallet ? "CONTENTS / PALLET INFO" : "NOTES"}
        </label>
        <textarea
          id="inspector-notes"
          rows={isPallet ? 3 : 5}
          placeholder={
            isPallet
              ? "Specify server equipment chassis specifications..."
              : `Add notes here`
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-400 resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onSave(projectId, notes)}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold py-2 rounded text-sm transition-colors"
      >
        {isPallet ? "Sync Data State" : "Save Notes"}
      </button>
    </div>
  );
}