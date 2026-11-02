import { useEffect, useRef, useState } from "react";
import {
  FLOOR_ITEM_LABELS,
  getDeleteBlockedReason,
  getLevelCount,
  MAX_ITEM_ID_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  type PhysicalPallet,
} from "./types";
import DeleteItemButton from "./DeleteItemButton";

interface Props {
  slot: PhysicalPallet;
  storedCount: number;
  onSave: (projectId: string, notes: string) => void | Promise<void>;
  onDelete: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Renames the item's ID. When provided, an editable ID field is shown. */
  onRename?: (newName: string) => void | Promise<void>;
}

type Status = "idle" | "saving" | "success" | "error";

export default function InspectorPanel({ slot, storedCount, onSave, onDelete, onRename }: Props) {
  const [projectId, setProjectId] = useState(slot.projectId);
  const [notes, setNotes] = useState(slot.notes ?? "");
  const [saved, setSaved] = useState({ projectId: slot.projectId, notes: slot.notes ?? "" });
  const [status, setStatus] = useState<Status>("idle");
  const [renameValue, setRenameValue] = useState(slot.id);
  const [renameError, setRenameError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isDataChanged = projectId !== saved.projectId || notes !== saved.notes;

  const normalizedId = renameValue.trim().toUpperCase();
  const isIdEdited = !!onRename && normalizedId !== "" && normalizedId !== slot.id;
  const isIdTooLong = !!onRename && normalizedId.length > MAX_ITEM_ID_LENGTH;
  const isProjectNameTooLong = projectId.length > MAX_PROJECT_NAME_LENGTH;
  const areNotesTooLong = notes.length > MAX_NOTES_LENGTH;

  // One button covers both: data edits and an ID change.
  const hasChanges = isDataChanged || isIdEdited;
  const hasValidationErrors = isIdTooLong || isProjectNameTooLong || areNotesTooLong;

  const isPallet = slot.itemType === "pallet";
  const typeLabel = FLOOR_ITEM_LABELS[slot.itemType];
  const levelCount = getLevelCount(slot);
  const deleteBlockedReason = getDeleteBlockedReason(slot, storedCount);

  // Clear any leftover message when a different item is selected
  useEffect(() => {
    setStatus("idle");
    setRenameValue(slot.id);
    setRenameError("");
  }, [slot.id]);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleSubmit() {
    if (!hasChanges || hasValidationErrors || status === "saving") return;
    clearTimeout(timer.current);
    setRenameError("");
    setStatus("saving");

    // Save name/notes first. Renaming rebuilds the panel, so the data has to be
    // synced under the current ID before the ID changes.
    if (isDataChanged) {
      try {
        await onSave(projectId, notes);
        setSaved({ projectId, notes });
      } catch {
        setStatus("error");
        return;
      }
    }

    if (isIdEdited && onRename) {
      try {
        await onRename(normalizedId);
      } catch (error) {
        setRenameError(error instanceof Error && error.message ? error.message : "The ID could not be changed.");
        setStatus("idle");
        return;
      }
    }

    setStatus("success");
    timer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div>
      {/*
        ID label (left) and delete button (right) share one row. The row sits outside
        the form so the delete button can't trigger a submit; the label still targets
        the input below through htmlFor.
      */}
      <div className={`flex items-center gap-3 ${onRename ? "mb-1 justify-between" : "mb-4 justify-end"}`}>
        {onRename && (
          <label htmlFor="inspector-id" className="text-xs text-gray-400 font-mono">
            {isPallet ? "PALLET" : "ITEM"} ID
          </label>
        )}
        <DeleteItemButton itemId={slot.id} onDelete={onDelete} disabledReason={deleteBlockedReason} />
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        {onRename && (
          <div>
            <input
              id="inspector-id"
              type="text"
              value={renameValue}
              maxLength={MAX_ITEM_ID_LENGTH}
              required
              onChange={(e) => setRenameValue(e.target.value)}
              aria-invalid={isIdTooLong}
              aria-describedby="inspector-id-limit"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono uppercase text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <p id="inspector-id-limit" className={`mt-1 text-xs ${isIdTooLong ? "text-red-400" : "text-gray-500"}`}>
              {renameValue.length}/{MAX_ITEM_ID_LENGTH} characters
              {isIdTooLong && " — item ID must be 10 characters or fewer."}
            </p>
            {renameError && (
              <p role="alert" className="mt-1 text-xs text-red-400">{renameError}</p>
            )}
          </div>
        )}

        {isPallet ? (
          <div className="space-y-1">
            <label htmlFor="inspector-project" className="text-xs text-gray-400 font-mono block">PALLET NAME</label>
            {slot.parentId && (
              <p className="text-xs text-gray-400">
                Stored on {slot.parentId}, level {slot.level ?? 1}. Clear the name and save to remove it from the shelf.
              </p>
            )}
            <input
              id="inspector-project"
              type="text"
              placeholder="Enter pallet name..."
              value={projectId}
              maxLength={MAX_PROJECT_NAME_LENGTH}
              onChange={(e) => setProjectId(e.target.value)}
              aria-invalid={isProjectNameTooLong}
              aria-describedby="inspector-project-limit"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <p id="inspector-project-limit" className={`mt-1 text-xs ${isProjectNameTooLong ? "text-red-400" : "text-gray-500"}`}>
              {projectId.length}/{MAX_PROJECT_NAME_LENGTH} characters
              {isProjectNameTooLong && " — name must be 36 characters or fewer."}
            </p>
          </div>
        ) : (
          <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
            <p className="font-semibold text-emerald-300">{typeLabel}</p>
            <p className="mt-1 text-xs text-gray-400">
              Footprint: {slot.widthCells} x {slot.heightCells} cells
            </p>
            <p className="mt-1 text-xs text-gray-400">Bay {slot.bayId.slice(-1)}</p>
            {levelCount > 0 && (
              <>
                <p className="mt-1 text-xs text-gray-400">
                  {levelCount} {levelCount === 1 ? "level" : "levels"}, {storedCount} of {slot.widthCells * slot.heightCells * levelCount} pallet slots used
                </p>
                <p className="mt-2 text-xs text-gray-400">Click the {typeLabel.toLowerCase()} on the floor map to open it, then drag pallets in or out.</p>
                {deleteBlockedReason && (
                  <p role="note" className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                    {deleteBlockedReason}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="inspector-notes" className="text-xs text-gray-400 font-mono block">
            {isPallet ? "PALLET CONTENTS" : "NOTES"}
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
            maxLength={MAX_NOTES_LENGTH}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={areNotesTooLong}
            aria-describedby="inspector-notes-limit"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-400 resize-none"
          />
          <p id="inspector-notes-limit" className={`text-xs ${areNotesTooLong ? "text-red-400" : "text-gray-500"}`}>
            {notes.length}/{MAX_NOTES_LENGTH} characters
            {areNotesTooLong && " — notes must be 4000 characters or fewer."}
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={!hasChanges || hasValidationErrors || status === "saving"}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500"
          >
            {status === "saving" ? "Saving..." : "Save Changes"}
          </button>

          <div aria-live="polite" className="min-h-[1.25rem] text-xs">
            {status === "success" && (
              <p className="text-emerald-400">✓ Changes saved successfully</p>
            )}
            {status === "error" && (
              <p role="alert" className="text-red-400">Something went wrong. Please try again.</p>
            )}
            {status === "idle" && hasChanges && (
              <p className="text-gray-500">Unsaved changes</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}