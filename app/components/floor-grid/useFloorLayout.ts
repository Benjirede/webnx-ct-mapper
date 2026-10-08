import { useState, useEffect } from "react";
import { PhysicalPallet, type BayId, type GridFootprint } from "./types";
import { fetchLayout, postSlot } from "./api";
import { findNearestOpenPosition, getPositionForFootprint, type CanvasSize } from "./layoutPositions";

export function useFloorLayout() {
  const [slots, setSlots] = useState<PhysicalPallet[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PhysicalPallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeBay, setActiveBay] = useState<BayId>("bay3");
  const [searchQuery, setSearchQuery] = useState("");
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [isPlacingPallet, setIsPlacingPallet] = useState(false);
  const [pendingFootprint, setPendingFootprint] = useState<GridFootprint | null>(null);
  const activeSlots = slots.filter((slot) => slot.bayId === activeBay);
  const placementAvailable = pendingFootprint
    ? Boolean(getPositionForFootprint(activeSlots, activeBay, pendingFootprint))
    : false;

  const selectBay = (bay: BayId) => {
    setActiveBay(bay);
    setSelectedSlot(null);
    setPendingFootprint(null);
    setIsPlacingPallet(false);
  };

  useEffect(() => {
    fetchLayout().then((data) => {
      if (data) setSlots(data);
      setLoading(false);
    });
  }, []);

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => !prev);
    setSelectedSlot(null);
    setPendingFootprint(null);
    setIsPlacingPallet(false);
  };

  const saveDetails = async (projectId: string, notes: string) => {
    if (!selectedSlot) return;
    const updated = {
      ...selectedSlot,
      isOccupied: projectId.trim() !== "",
      projectId,
      notes,
    };
    setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedSlot(updated);
    await postSlot(updated);
  };

  const renameZone = async (newName: string) => {
    if (!selectedSlot || !newName.trim()) return;
    const targetNewName = newName.trim().toUpperCase();

    if (slots.some((s) => s.id === targetNewName && s.id !== selectedSlot.id)) {
      alert("Collision: Another warehouse spot already uses that name!");
      return;
    }

    const renamed = { ...selectedSlot, id: targetNewName };
    setSlots((prev) => prev.map((s) => (s.id === selectedSlot.id ? renamed : s)));
    setSelectedSlot(renamed);

    await postSlot({ ...renamed, action: "rename", oldId: selectedSlot.id });
  };

  const createZone = async (newId: string, footprint: GridFootprint) => {
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
      widthCells: footprint.widthCells,
      heightCells: footprint.heightCells,
      isOccupied: false,
      projectId: "",
      notes: "",
      ...position,
    };
    setSlots((prev) => [...prev, brandNew]);
    setSelectedSlot(brandNew);
    setPendingFootprint(null);
    setIsPlacingPallet(false);

    await postSlot({ ...brandNew, action: "create" });
    return true;
  };

  /** xPct / yPct are raw canvas percentages; placement snaps to the nearest open cell. */
  const moveZone = async (sourceId: string, xPct: number, yPct: number) => {
    const target = slots.find((s) => s.id === sourceId);
    if (!target || target.bayId !== activeBay) return;

    const position = findNearestOpenPosition(activeSlots, canvasSize, activeBay, xPct, yPct, sourceId, target);
    if (!position) {
      alert("No open pallet-sized location is available on the floor layout.");
      return;
    }

    const updated = { ...target, ...position };
    setSlots((prev) => prev.map((s) => (s.id === sourceId ? updated : s)));
    if (selectedSlot?.id === sourceId) setSelectedSlot(updated);
    await postSlot(updated);
  };

  const movePallet = async (sourceId: string, targetSlot: PhysicalPallet) => {
    if (sourceId === targetSlot.id) return;
    if (targetSlot.isOccupied) {
      alert("Allocation Collision: This location slot already has an active inventory pallet block!");
      return;
    }

    const sourceSlot = slots.find((s) => s.id === sourceId);
    if (!sourceSlot || !sourceSlot.isOccupied || sourceSlot.bayId !== activeBay || targetSlot.bayId !== activeBay) return;

    const newTarget = {
      ...targetSlot,
      isOccupied: true,
      projectId: sourceSlot.projectId,
      notes: sourceSlot.notes,
    };
    const newSource = { ...sourceSlot, isOccupied: false, projectId: "", notes: "" };

    setSlots((prev) =>
      prev.map((s) => (s.id === targetSlot.id ? newTarget : s.id === sourceSlot.id ? newSource : s))
    );
    if (selectedSlot?.id === sourceSlot.id) setSelectedSlot(newSource);
    if (selectedSlot?.id === targetSlot.id) setSelectedSlot(newTarget);

    await postSlot(newTarget);
    await postSlot(newSource);
  };

  return {
    slots,
    selectedSlot,
    loading,
    isAdminMode,
    activeBay,
    activeSlots,
    searchQuery,
    isPlacingPallet,
    pendingFootprint,
    placementAvailable,
    setCanvasSize,
    setSearchQuery,
    setPendingFootprint,
    startPalletPlacement: () => {
      setPendingFootprint(null);
      setIsPlacingPallet(true);
    },
    cancelPalletPlacement: () => {
      setPendingFootprint(null);
      setIsPlacingPallet(false);
    },
    finishPalletPlacement: () => setIsPlacingPallet(false),
    selectSlot: setSelectedSlot,
    selectBay,
    toggleAdminMode,
    saveDetails,
    renameZone,
    createZone,
    moveZone,
    movePallet,
  };
}