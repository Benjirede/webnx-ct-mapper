import { useState, useEffect, type ComponentProps, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  FLOOR_ITEM_LABELS,
  FLOOR_ITEM_TYPES,
  DEFAULT_LEVEL,
  LEVEL_OPTIONS,
  PALLET_STATUSES,
  PALLET_STATUS_LABELS,
  hasLevels,
  MAX_ITEM_ID_LENGTH,
  type FloorItemType,
  type GridFootprint,
  type PalletStatus,
  type PhysicalPallet,
} from "./types";
import InspectorPanel from "./InspectorPanel";

type InspectorProps = ComponentProps<typeof InspectorPanel>;

interface Props {
  fullscreenTargetRef: RefObject<HTMLDivElement | null>;
  selectedSlot: PhysicalPallet | null;
  selectedStoredCount: number;
  isPlacingItem: boolean;
  pendingFootprint: GridFootprint | null;
  placementAvailable: boolean;
  onStartPlacement: () => void;
  onCancelPlacement: () => void;
  onCreate: (
    id: string,
    itemType: FloorItemType,
    footprint: GridFootprint,
    levels?: number,
    status?: PalletStatus,
  ) => Promise<boolean>;
  /** The same handlers the Staging Inspector uses. Renaming the ID happens inside the inspector. */
  onSave: InspectorProps["onSave"];
  onRename?: InspectorProps["onRename"];
  onDelete: InspectorProps["onDelete"];
}

export default function AdminPanel({
  fullscreenTargetRef, selectedSlot, selectedStoredCount, isPlacingItem, pendingFootprint, placementAvailable,
  onStartPlacement, onCancelPlacement, onCreate, onSave, onRename, onDelete,
}: Props) {
  const [newSlotId, setNewSlotId] = useState("");
  const [itemType, setItemType] = useState<FloorItemType>("pallet");
  const [levels, setLevels] = useState<number>(DEFAULT_LEVEL);
  const [palletStatus, setPalletStatus] = useState<PalletStatus>("empty");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const itemHasLevels = hasLevels(itemType);

  // Pilot tester provisioning state
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [newTester, setNewTester] = useState("");
  const [testerStatus, setTesterStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role === "supervisor" || data?.username === "admin") {
          setIsSupervisor(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !pendingFootprint ||
      !placementAvailable ||
      !newSlotId.trim() ||
      newSlotId.trim().length > MAX_ITEM_ID_LENGTH
    ) return;
    setIsConfirmOpen(true);
  };

  const confirmCreate = async () => {
    if (!pendingFootprint || !placementAvailable || isCreating) return;
    setIsCreating(true);
    try {
      if (await onCreate(
        newSlotId,
        itemType,
        pendingFootprint,
        itemHasLevels ? levels : undefined,
        itemType === "pallet" ? palletStatus : undefined,
      )) {
        setIsConfirmOpen(false);
        setNewSlotId("");
        setItemType("pallet");
        setLevels(DEFAULT_LEVEL);
        setPalletStatus("empty");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const confirmationDialog = isConfirmOpen && fullscreenTargetRef.current && pendingFootprint
    ? createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget && !isCreating) setIsConfirmOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-item-confirm-title"
          className="w-full max-w-md space-y-5 rounded-xl border border-gray-700 bg-gray-900 p-6 text-white shadow-2xl"
        >
          <div>
            <h2 id="create-item-confirm-title" className="text-lg font-semibold">Create this floor item?</h2>
            <p className="mt-2 text-sm text-gray-300">
              Create <span className="font-semibold text-amber-200">{newSlotId.trim()}</span> as{" "}
              {FLOOR_ITEM_LABELS[itemType]} ({pendingFootprint.widthCells} x {pendingFootprint.heightCells} cells
              {itemHasLevels ? `, ${levels} ${levels === 1 ? "level" : "levels"}` : ""}) in this bay?
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isCreating}
              className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmCreate()}
              disabled={isCreating}
              className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              {isCreating ? "Creating…" : "Create item"}
            </button>
          </div>
        </div>
      </div>,
      fullscreenTargetRef.current,
    )
    : null;

  const handleAddTester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTester.trim()) return;
    setCreatingUser(true);
    setTesterStatus(null);

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newTester.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setTesterStatus({ type: "err", msg: data.error || "Failed to add user" });
      } else {
        setTesterStatus({
          type: "ok",
          msg: `Added "${data.username}" with default first-time password.`,
        });
        setNewTester("");
      }
    } catch {
      setTesterStatus({ type: "err", msg: "Network error creating user" });
    } finally {
      setCreatingUser(false);
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

          {itemType === "pallet" && (
            <div className="space-y-1.5">
              <label htmlFor="new-pallet-status" className="block text-xs font-medium text-gray-300">Pallet status</label>
              <select
                id="new-pallet-status"
                value={palletStatus}
                onChange={(e) => setPalletStatus(e.target.value as PalletStatus)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              >
                {PALLET_STATUSES.map((status) => (
                  <option key={status} value={status}>{PALLET_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
          )}

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

      {confirmationDialog}

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
      {/* Pilot Tester Provisioning Section (Supervisor Only) */}
      {isSupervisor && (
        <div className="pt-4 border-t border-gray-700 space-y-2">
          <label htmlFor="new-tester-username" className="text-xs text-emerald-400 font-mono font-bold block">
            👤 PROVISION PILOT TESTER
          </label>
          <form onSubmit={handleAddTester} className="space-y-2">
            <input
              id="new-tester-username"
              type="text"
              placeholder="New tech username..."
              value={newTester}
              onChange={(e) => setNewTester(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-emerald-200 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={creatingUser || !newTester.trim()}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-xs font-mono font-bold uppercase text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingUser ? "Adding Tester..." : "+ Add Tester Account"}
            </button>
          </form>

          {testerStatus && (
            <div
              className={`rounded border p-2 text-xs font-mono break-words ${
                testerStatus.type === "ok"
                  ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                  : "border-rose-700 bg-rose-950/40 text-rose-200"
              }`}
            >
              {testerStatus.msg}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-900/60 p-3 rounded border border-gray-700 text-[11px] text-gray-400 leading-relaxed space-y-1">
        <p className="font-bold text-amber-300">Blueprint placement</p>
        <p>Choose an item type, then drag across empty cells to set its size and position.</p>
      </div>
    </div>
  );
}
