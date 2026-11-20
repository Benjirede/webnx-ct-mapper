import { useState, useEffect } from "react";
import {
  DEFAULT_LEVEL,
  getDeleteBlockedReason,
  getLevelCount,
  hasLevels,
  type PhysicalPallet,
  type BayId,
  type FloorItemType,
  type GridFootprint,
  matchesSearchQuery,
} from "./types";
import { deleteSlot, fetchLayout, postSlot } from "./api";
import { findNearestOpenPosition, getPositionForFootprint, type CanvasSize } from "./layoutPositions";

export function useFloorLayout() {
  const [slots, setSlots] = useState<PhysicalPallet[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PhysicalPallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeBay, setActiveBay] = useState<BayId>("bay3");
  const [searchQuery, setSearchQuery] = useState("");
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [isPlacingItem, setIsPlacingItem] = useState(false);
  const [pendingFootprint, setPendingFootprint] = useState<GridFootprint | null>(null);
  const [expandedShelfId, setExpandedShelfId] = useState<string | null>(null);

  const bayItems = slots.filter((slot) => slot.bayId === activeBay);
  // Things drawn on the floor (pallet slots, shelves, desks...). Pallets stored on a shelf are excluded.
  const activeSlots = bayItems.filter((slot) => !slot.parentId);
  // Pallets stored on shelves in the active bay.
  const shelfContents = bayItems.filter((slot) => slot.parentId);
  const searchMatchBayIds = searchQuery.trim()
    ? Array.from(new Set(
        slots
          .filter((slot) => matchesSearchQuery(slot, searchQuery))
          .map((slot) => slot.bayId)
          .filter((bayId) => bayId !== activeBay)
      ))
    : [];
  const placementAvailable = pendingFootprint
    ? Boolean(getPositionForFootprint(activeSlots, activeBay, pendingFootprint))
    : false;

  const countStored = (shelfId: string) =>
    slots.reduce((total, slot) => (slot.parentId === shelfId ? total + 1 : total), 0);

  const applySavedVersion = (id: string, version?: number) => {
    if (version === undefined) return;
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, version } : slot)));
    setSelectedSlot((prev) => (prev?.id === id ? { ...prev, version } : prev));
  };

  const selectBay = (bay: BayId) => {
    setActiveBay(bay);
    setSelectedSlot(null);
    setPendingFootprint(null);
    setIsPlacingItem(false);
    setExpandedShelfId(null);
  };

  useEffect(() => {
    fetchLayout().then((data) => {
      if (data) setSlots(data);
      setLoading(false);
    });
  }, []);

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => !prev);
    setPendingFootprint(null);
    setIsPlacingItem(false);
    setExpandedShelfId(null);
  };

  /** Selecting a shelf/rack also opens (or closes) its contents view. */
  const selectSlot = (slot: PhysicalPallet) => {
    setSelectedSlot(slot);
    if (hasLevels(slot.itemType)) {
      setExpandedShelfId((prev) => (prev === slot.id ? null : slot.id));
    }
  };

  const clearSelection = () => setSelectedSlot(null);

  const closeShelf = () => setExpandedShelfId(null);

  const deleteZone = async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
    const target = slots.find((slot) => slot.id === itemId);
    const blockedReason = target ? getDeleteBlockedReason(target, countStored(itemId)) : undefined;
    if (blockedReason) return { ok: false, error: blockedReason };

    try {
      const result = await deleteSlot(itemId);
      if (!result.ok) return result;

      setSlots((prev) => prev.filter((slot) => slot.id !== itemId));
      setSelectedSlot((prev) => (prev?.id === itemId ? null : prev));
      setExpandedShelfId((prev) => (prev === itemId ? null : prev));
      return result;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  };

  const saveDetails = async (projectId: string, notes: string) => {
    if (!selectedSlot) return;

    // Clearing the project on a shelved pallet takes it off the shelf (it has no floor slot to go back to).
    if (selectedSlot.parentId && projectId.trim() === "") {
      const emptied = await postSlot({ ...selectedSlot, isOccupied: false, projectId: "", notes });
      if (!emptied.ok) {
        alert(`Unable to remove pallet from shelf: ${emptied.error}`);
        return;
      }
      const removed = await deleteZone(selectedSlot.id);
      if (!removed.ok) alert(`Unable to remove pallet from shelf: ${removed.error}`);
      return;
    }

    const updated = {
      ...selectedSlot,
      isOccupied: projectId.trim() !== "",
      projectId,
      notes,
    };
    setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedSlot(updated);
    const result = await postSlot(updated);
    if (result.ok && result.version !== undefined) {
      const saved = { ...updated, version: result.version };
      setSlots((prev) => prev.map((slot) => (slot.id === updated.id ? saved : slot)));
      setSelectedSlot((prev) => prev?.id === updated.id ? saved : prev);
    }
  };

  const renameZone = async (newName: string) => {
    if (!selectedSlot || !newName.trim()) return;
    const targetNewName = newName.trim().toUpperCase();
    const oldId = selectedSlot.id;

    if (slots.some((s) => s.id === targetNewName && s.id !== oldId)) {
      alert("Collision: Another warehouse spot already uses that name!");
      return;
    }

    const renamed = { ...selectedSlot, id: targetNewName };

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === oldId) return renamed;
        if (s.parentId === oldId) return { ...s, parentId: targetNewName };
        return s;
      })
    );
    setSelectedSlot(renamed);
    setExpandedShelfId((prev) => (prev === oldId ? targetNewName : prev));

    await postSlot({ ...renamed, action: "rename", oldId });
  };

  const createZone = async (
    newId: string,
    itemType: FloorItemType,
    footprint: GridFootprint,
    levels?: number
  ) => {
    if (!newId.trim()) return false;
    const finalId = newId.trim().toUpperCase();

    if (slots.some((s) => s.id === finalId)) {
      alert("A location bay with that name already exists on the map blueprint!");
      return false;
    }

    const position = getPositionForFootprint(activeSlots, activeBay, footprint);
    if (!position) {
      alert("That pallet footprint is out of bounds or overlaps an existing slot.");
      return false;
    }

    const brandNew: PhysicalPallet = {
      id: finalId,
      bayId: activeBay,
      itemType,
      widthCells: footprint.widthCells,
      heightCells: footprint.heightCells,
      isOccupied: false,
      projectId: "",
      notes: "",
      ...(hasLevels(itemType) ? { levels: levels ?? DEFAULT_LEVEL } : {}),
      ...position,
    };
    try {
      const result = await postSlot({ ...brandNew, action: "create" });
      if (!result.ok) {
        alert(`Unable to save item: ${result.error}`);
        return false;
      }

      setSlots((prev) => [...prev, brandNew]);
      setSelectedSlot(brandNew);
      setPendingFootprint(null);
      setIsPlacingItem(false);
      return true;
    } catch (error) {
      alert(`Unable to save item: ${error instanceof Error ? error.message : "Network error"}`);
      return false;
    }
  };

  /** xPct / yPct are raw canvas percentages; placement snaps to the nearest open cell. */
  const moveZone = async (sourceId: string, xPct: number, yPct: number) => {
    const target = slots.find((s) => s.id === sourceId);
    if (!target || target.parentId) return;

    const position = findNearestOpenPosition(activeSlots, canvasSize, activeBay, xPct, yPct, sourceId, target);
    if (!position) {
      alert("No open pallet-sized location is available on the floor layout.");
      return;
    }

    const updated = { ...target, bayId: activeBay, ...position };
    try {
      const result = await postSlot(updated);
      if (!result.ok) {
        alert(`Unable to move item: ${result.error}`);
        return;
      }

      const saved = result.version === undefined ? updated : { ...updated, version: result.version };
      setSlots((prev) => prev.map((slot) => {
        if (slot.id === sourceId) return saved;
        if (target.bayId !== activeBay && slot.parentId === sourceId) {
          return {
            ...slot,
            bayId: activeBay,
            ...(slot.version === undefined ? {} : { version: slot.version + 1 }),
          };
        }
        return slot;
      }));
      setSelectedSlot((prev) => prev?.id === sourceId ? saved : prev);
    } catch (error) {
      alert(`Unable to move item: ${error instanceof Error ? error.message : "Network error"}`);
    }
  };

  /** Drop an occupied pallet (from the floor or a shelf) onto a vacant floor pallet slot. */
  const movePallet = async (sourceId: string, targetSlot: PhysicalPallet) => {
    if (sourceId === targetSlot.id) return;
    if (targetSlot.itemType !== "pallet" || targetSlot.parentId) return;
    if (targetSlot.isOccupied) {
      alert("Allocation Collision: This location slot already has an active inventory pallet block!");
      return;
    }

    const sourceSlot = slots.find((s) => s.id === sourceId);
    if (
      !sourceSlot || sourceSlot.itemType !== "pallet" || !sourceSlot.isOccupied ||
      targetSlot.bayId !== activeBay
    ) return;

    const newTarget = {
      ...targetSlot,
      isOccupied: true,
      projectId: sourceSlot.projectId,
      notes: sourceSlot.notes,
    };

    // Shelf -> vacant floor slot: the contents move to the floor slot and the shelf record is removed.
    if (sourceSlot.parentId) {
      const saved = await postSlot(newTarget);
      if (!saved.ok) {
        alert(`Unable to move pallet: ${saved.error}`);
        return;
      }
      // The API only deletes empty records, so empty the shelf record before removing it.
      const cleared = await postSlot({ ...sourceSlot, isOccupied: false, projectId: "", notes: "" });
      const removed = cleared.ok ? await deleteSlot(sourceSlot.id) : cleared;
      if (!removed.ok) {
        await postSlot({ ...targetSlot, version: saved.version ?? targetSlot.version, isOccupied: false, projectId: "", notes: "" });
        alert(`Unable to remove pallet from shelf: ${removed.error}`);
        return;
      }

      setSlots((prev) =>
        prev.filter((s) => s.id !== sourceSlot.id).map((s) => (s.id === targetSlot.id ? newTarget : s))
      );
      setSelectedSlot((prev) => (prev?.id === sourceSlot.id || prev?.id === targetSlot.id ? newTarget : prev));
      applySavedVersion(targetSlot.id, saved.version);
      return;
    }

    try {
      const result = await postSlot({
        action: "move_pallet",
        sourceId: sourceSlot.id,
        targetId: targetSlot.id,
      });
      if (!result.ok) {
        alert(`Unable to move pallet: ${result.error}`);
        return;
      }

      const newSource = {
        ...sourceSlot,
        isOccupied: false,
        projectId: "",
        notes: "",
        ...(result.sourceVersion === undefined ? {} : { version: result.sourceVersion }),
      };
      const savedTarget = {
        ...newTarget,
        ...(result.targetVersion === undefined ? {} : { version: result.targetVersion }),
      };
      setSlots((prev) =>
        prev.map((s) => s.id === targetSlot.id ? savedTarget : s.id === sourceSlot.id ? newSource : s)
      );
      setSelectedSlot((prev) => {
        if (prev?.id === sourceSlot.id) return newSource;
        if (prev?.id === targetSlot.id) return savedTarget;
        return prev;
      });
    } catch (error) {
      alert(`Unable to move pallet: ${error instanceof Error ? error.message : "Network error"}`);
    }
  };

  /**
   * Drop an occupied pallet (from the floor or another shelf cell) into a shelf cell.
   * The pallet itself moves: once it has a parentId it is no longer part of the floor grid.
   */
  const moveToShelf = async (sourceId: string, shelfId: string, level: number, column: number, row: number) => {
    const shelf = slots.find((s) => s.id === shelfId);
    const source = slots.find((s) => s.id === sourceId);
    const reject = (reason: string) => {
      console.warn("moveToShelf rejected:", reason, { sourceId, shelfId, level, column, row, shelf, source });
      alert(`Can't store that pallet: ${reason}`);
    };
    if (!shelf) return reject(`shelf "${shelfId}" was not found.`);
    if (!source) return reject(`dragged item "${sourceId}" was not found.`);
    if (!hasLevels(shelf.itemType)) return reject(`${shelfId} is not a shelf or rack.`);
    if (source.itemType !== "pallet") return reject("only pallets can be stored on a shelf.");
    if (!source.isOccupied) return reject("that pallet slot is empty.");
    if (shelf.bayId !== activeBay || source.bayId !== activeBay) return reject("the pallet and shelf must be in the same bay.");
    if (
      level < 1 || level > getLevelCount(shelf) ||
      column < 0 || column >= shelf.widthCells ||
      row < 0 || row >= shelf.heightCells
    ) return reject(`level ${level}, column ${column + 1}, row ${row + 1} is outside the shelf (levels: ${getLevelCount(shelf)}).`);

    if (source.parentId === shelfId && source.level === level && source.cellColumn === column && source.cellRow === row) return;

    const taken = slots.some(
      (s) => s.parentId === shelfId && s.level === level && s.cellColumn === column && s.cellRow === row
    );
    if (taken) return reject("that shelf slot already holds a pallet.");

    const updated: PhysicalPallet = { ...source, parentId: shelfId, level, cellColumn: column, cellRow: row };
    const restore = () => {
      setSlots((prev) => prev.map((s) => (s.id === sourceId ? source : s)));
      setSelectedSlot((prev) => (prev?.id === sourceId ? source : prev));
    };

    setSlots((prev) => prev.map((s) => (s.id === sourceId ? updated : s)));
    setSelectedSlot((prev) => (prev?.id === sourceId ? updated : prev));
    try {
      const result = await postSlot(updated);
      if (!result.ok) {
        restore();
        alert(`Unable to store pallet: ${result.error}`);
        return;
      }
      applySavedVersion(sourceId, result.version);
    } catch (error) {
      restore();
      alert(`Unable to store pallet: ${error instanceof Error ? error.message : "Network error"}`);
    }
  };

  /** Drop a shelved pallet on open floor: it leaves the shelf and snaps to the nearest open floor cell. */
  const takeOffShelf = async (sourceId: string, xPct: number, yPct: number) => {
    const source = slots.find((s) => s.id === sourceId);
    if (!source || !source.parentId) return;

    const position = findNearestOpenPosition(activeSlots, canvasSize, activeBay, xPct, yPct, source.id, source);
    if (!position) {
      alert("No open floor space is available for that pallet.");
      return;
    }

    const updated: PhysicalPallet = {
      ...source,
      bayId: activeBay,
      ...position,
      parentId: undefined,
      level: undefined,
      cellColumn: undefined,
      cellRow: undefined,
    };
    const restore = () => {
      setSlots((prev) => prev.map((s) => (s.id === sourceId ? source : s)));
      setSelectedSlot((prev) => (prev?.id === sourceId ? source : prev));
    };

    setSlots((prev) => prev.map((s) => (s.id === sourceId ? updated : s)));
    setSelectedSlot((prev) => (prev?.id === sourceId ? updated : prev));
    try {
      // null (not undefined) tells the API to clear the shelf placement.
      const result = await postSlot({ ...updated, parentId: null, level: null, cellColumn: null, cellRow: null });
      if (!result.ok) {
        restore();
        alert(`Unable to move pallet to the floor: ${result.error}`);
        return;
      }
      applySavedVersion(sourceId, result.version);
    } catch (error) {
      restore();
      alert(`Unable to move pallet to the floor: ${error instanceof Error ? error.message : "Network error"}`);
    }
  };

  return {
    slots,
    selectedSlot,
    loading,
    isAdminMode,
    activeBay,
    activeSlots,
    shelfContents,
    searchMatchBayIds,
    expandedShelfId,
    searchQuery,
    isPlacingItem,
    pendingFootprint,
    placementAvailable,
    setCanvasSize,
    setSearchQuery,
    setPendingFootprint,
    startItemPlacement: () => {
      setPendingFootprint(null);
      setIsPlacingItem(true);
    },
    cancelPalletPlacement: () => {
      setPendingFootprint(null);
      setIsPlacingItem(false);
    },
    finishItemPlacement: () => setIsPlacingItem(false),
    selectSlot,
    clearSelection,
    closeShelf,
    selectBay,
    toggleAdminMode,
    saveDetails,
    renameZone,
    createZone,
    deleteZone,
    moveZone,
    movePallet,
    moveToShelf,
    takeOffShelf,
    storedCountFor: countStored,
  };
}