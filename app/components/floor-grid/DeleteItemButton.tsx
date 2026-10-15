import { useState } from "react";

interface Props {
  itemId: string;
  onDelete: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function DeleteItemButton({ itemId, onDelete }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const closeDialog = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setConfirmation("");
    setError("");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");
    try {
      const result = await onDelete(itemId);
      if (!result.ok) {
        setError(result.error || "The item could not be deleted.");
        return;
      }
      setIsOpen(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The item could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Delete ${itemId}`}
        title="Delete item"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded border border-rose-800 text-rose-300 transition-colors hover:border-rose-500 hover:bg-rose-950/60 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
            className="w-full max-w-sm space-y-4 rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl"
          >
            <div>
              <h2 id="delete-item-title" className="text-base font-semibold text-gray-100">Delete {itemId}?</h2>
              <p className="mt-1 text-sm text-gray-400">This permanently removes the item from the floor grid.</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="delete-item-confirmation" className="text-sm text-gray-300">
                Type <span className="font-mono font-semibold text-rose-300">delete</span> to confirm
              </label>
              <input
                id="delete-item-confirmation"
                autoFocus
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-rose-400 focus:outline-none"
              />
            </div>

            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isDeleting}
                className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmation.trim().toLowerCase() !== "delete" || isDeleting}
                className="rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}