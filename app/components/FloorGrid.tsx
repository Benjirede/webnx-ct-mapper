"use client";

import { useState, useEffect } from "react";

interface PhysicalPallet {
  id: string;
  isOccupied: boolean;
  projectId: string;
  notes: string;
  xPos: number; 
  yPos: number; 
}

export default function FloorGrid() {
  const [slots, setSlots] = useState<PhysicalPallet[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PhysicalPallet | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Inspector Input Forms
  const [inputProjectId, setInputProjectId] = useState("");
  const [inputNotes, setInputNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Admin Configuration States
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [newSlotId, setNewSlotId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    fetch("/api/layout-data")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setSlots(data);
        setLoading(false);
      });
  }, []);

  const handleSelectSlot = (slot: PhysicalPallet) => {
    setSelectedSlot(slot);
    setInputProjectId(slot.projectId);
    setInputNotes(slot.notes);
    setRenameValue(slot.id); // Seed rename field automatically
  };

  const handleSaveData = async (targetSlot?: PhysicalPallet) => {
    const slotToUpdate = targetSlot || selectedSlot;
    if (!slotToUpdate) return;

    const isNowOccupied = targetSlot ? targetSlot.isOccupied : inputProjectId.trim() !== "";
    const updated = {
      ...slotToUpdate,
      isOccupied: isNowOccupied,
      projectId: targetSlot ? targetSlot.projectId : inputProjectId,
      notes: targetSlot ? targetSlot.notes : inputNotes
    };

    setSlots(prev => prev.map(s => s.id === slotToUpdate.id ? updated : s));
    if (selectedSlot?.id === slotToUpdate.id) setSelectedSlot(updated);

    await fetch("/api/layout-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  // --- Admin Mode: Rename Zone IDs Securely ---
  const handleRenameZone = async () => {
    if (!selectedSlot || !renameValue.trim()) return;
    const targetNewName = renameValue.trim().toUpperCase();

    if (slots.some(s => s.id === targetNewName && s.id !== selectedSlot.id)) {
      alert("Collision: Another warehouse spot already uses that name!");
      return;
    }

    // Delete the old row record and write a brand new key constraint entry via action
    const renamedSlot = { ...selectedSlot, id: targetNewName };
    
    // SQLite can update the ID directly if handled via specialized query actions
    setSlots(prev => prev.map(s => s.id === selectedSlot.id ? renamedSlot : s));
    setSelectedSlot(renamedSlot);

    await fetch("/api/layout-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...renamedSlot, action: "create", oldId: selectedSlot.id }),
    });
  };

  // --- Admin Mode: Spawn a Brand New Grid Zone Slot ---
  const handleCreateNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotId.trim()) return;
    const finalId = newSlotId.trim().toUpperCase();

    if (slots.some(s => s.id === finalId)) {
      alert("A location bay with that name already exists on the map blueprint!");
      return;
    }

    const brandNewSlot: PhysicalPallet = {
      id: finalId,
      isOccupied: false,
      projectId: "",
      notes: "",
      xPos: 40, // Spawn centered
      yPos: 30
    };

    setSlots(prev => [...prev, brandNewSlot]);
    setNewSlotId("");
    setSelectedSlot(brandNewSlot);

    await fetch("/api/layout-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...brandNewSlot, action: "create" }),
    });
  };

  // --- HTML5 Drag Multi-Routing Engine ---
  const handleDragStart = (e: React.DragEvent, sourceSlot: PhysicalPallet) => {
    e.dataTransfer.setData("text/source-id", sourceSlot.id);
    e.dataTransfer.setData("text/drag-type", isAdminMode ? "move-zone" : "move-payload");
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = async (e: React.DragEvent, canvasRef: HTMLDivElement | null) => {
    e.preventDefault();
    if (!canvasRef || !isAdminMode) return;
    
    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");
    if (dragType !== "move-zone" || !sourceId) return;

    const rect = canvasRef.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Grid Snapping: Automatically snap coordinates to the nearest 4% step grid increment
    const snapGridStep = 4;
    let snappedX = Math.round(rawX / snapGridStep) * snapGridStep;
    let snappedY = Math.round(rawY / snapGridStep) * snapGridStep;

    // Safety canvas bounds barriers (4% - 96%)
    snappedX = Math.max(4, Math.min(96, snappedX));
    snappedY = Math.max(4, Math.min(96, snappedY));

    setSlots(prev => prev.map(s => s.id === sourceId ? { ...s, xPos: snappedX, yPos: snappedY } : s));
    
    const targetedSlot = slots.find(s => s.id === sourceId);
    if (targetedSlot) {
      const updatedNode = { ...targetedSlot, xPos: snappedX, yPos: snappedY };
      if (selectedSlot?.id === sourceId) setSelectedSlot(updatedNode);

      await fetch("/api/layout-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedNode),
      });
    }
  };

  const handlePayloadDropOnSlot = async (e: React.DragEvent, targetSlot: PhysicalPallet) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData("text/drag-type");
    const sourceId = e.dataTransfer.getData("text/source-id");

    if (isAdminMode || dragType !== "move-payload" || sourceId === targetSlot.id) return;
    if (targetSlot.isOccupied) {
      alert("Allocation Collision: This location slot already has an active inventory pallet block!");
      return;
    }

    const sourceSlot = slots.find(s => s.id === sourceId);
    if (!sourceSlot || !sourceSlot.isOccupied) return;

    const newTargetState = { ...targetSlot, isOccupied: true, projectId: sourceSlot.projectId, notes: sourceSlot.notes };
    const newSourceState = { ...sourceSlot, isOccupied: false, projectId: "", notes: "" };

    setSlots(prev => prev.map(s => {
      if (s.id === targetSlot.id) return newTargetState;
      if (s.id === sourceSlot.id) return newSourceState;
      return s;
    }));

    if (selectedSlot?.id === sourceSlot.id) setSelectedSlot(newSourceState);
    if (selectedSlot?.id === targetSlot.id) setSelectedSlot(newTargetState);

    await fetch("/api/layout-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTargetState),
    });
    await fetch("/api/layout-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSourceState),
    });
  };
  let canvasElement: HTMLDivElement | null = null;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-900 text-white min-h-screen flex flex-col">
      <header className="mb-6 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400">WebNX Custom Tech Floor Digital Twin</h1>
          <p className="text-gray-400 text-sm">Spatial visual map tracking of hardware pallets and custom project stages</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsAdminMode(!isAdminMode);
              setSelectedSlot(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-colors shadow-md border ${
              isAdminMode 
                ? "bg-amber-500 border-amber-400 text-gray-950 animate-pulse" 
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {isAdminMode ? "🔒 Exit Blueprint Edit" : "🛠️ Edit Floor Layout Blueprint"}
          </button>

          <input 
            type="text"
            placeholder="🔍 Search Project ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400 placeholder-gray-500 shadow-md w-64"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Expanded Blueprint Map Canvas Layer - Increased Height to 750px */}
        <div 
          ref={(el) => { canvasElement = el; }}
          onDragOver={handleCanvasDragOver}
          onDrop={(e) => handleCanvasDrop(e, canvasElement)}
          className={`lg:col-span-3 rounded-xl p-4 relative min-h-[750px] shadow-inner overflow-hidden border transition-all ${
            isAdminMode 
              ? "bg-gray-950 border-amber-500/50 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4%_4%]" 
              : "bg-gray-950 border-gray-800"
          }`}
        >
          <div className="absolute left-[35%] top-0 bottom-0 border-r border-dashed border-gray-800/60 pointer-events-none flex items-center justify-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-gray-700 select-none rotate-90">Main Tech Walking Lane</span>
          </div>

          {slots.map((slot) => {
            const matchesSearch = searchQuery.trim() !== "" && slot.projectId.toLowerCase().includes(searchQuery.toLowerCase());

            return (
              <div
                key={slot.id}
                style={{ left: `${slot.xPos}%`, top: `${slot.yPos}%` }}
                onDragOver={handleCanvasDragOver}
                onDrop={(e) => handlePayloadDropOnSlot(e, slot)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 p-1"
              >
                <button
                  onClick={() => handleSelectSlot(slot)}
                  draggable={isAdminMode || slot.isOccupied}
                  onDragStart={(e) => handleDragStart(e, slot)}
                  className={`w-28 h-20 rounded-md border text-left p-2 transition-all flex flex-col justify-between shadow-lg relative ${
                    isAdminMode
                      ? "bg-gray-900 border-amber-500 text-amber-300 cursor-move border-dashed hover:border-amber-400"
                      : slot.isOccupied
                        ? "bg-amber-950/60 border-amber-500 text-amber-300 cursor-grab active:cursor-grabbing"
                        : "bg-gray-900/40 border-gray-800 text-gray-600 hover:border-gray-600 cursor-pointer"
                  } ${selectedSlot?.id === slot.id ? "ring-2 ring-emerald-400 border-transparent z-10 scale-105" : ""} ${
                    matchesSearch ? "ring-4 ring-cyan-400 border-transparent z-20 scale-110 animate-bounce" : ""
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[9px] font-mono bg-gray-800/90 text-gray-200 px-1 rounded font-bold truncate max-w-[70px]">{slot.id}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isAdminMode ? "bg-amber-400" : slot.isOccupied ? "bg-amber-400 animate-pulse" : "bg-gray-700"}`}></span>
                  </div>
                  <div className="text-[10px] font-medium truncate w-full tracking-tight">
                    {isAdminMode ? `📐 X:${slot.xPos}% Y:${slot.yPos}%` : slot.isOccupied ? `ID: ${slot.projectId}` : "✨ EMPTY ZONE"}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Dynamic Multi-Mode Sidebar Controller Deck */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl h-fit flex flex-col space-y-4">
          {isAdminMode ? (
            <div className="space-y-4">
              <h2 className="text-md font-mono font-bold text-amber-400 uppercase tracking-wider border-b border-gray-700 pb-2">🛠️ Blueprint Control Deck</h2>
              
              <form onSubmit={handleCreateNewSlot} className="space-y-2">
                <label className="text-xs text-gray-400 font-mono block">CREATE NEW STAGING ZONE</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. RACK-C1"
                    value={newSlotId}
                    onChange={(e) => setNewSlotId(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                  />
                  <button type="submit" className="bg-amber-500 text-gray-950 font-bold px-3 rounded text-sm hover:bg-amber-600 transition-colors">Create</button>
                </div>
              </form>

              {selectedSlot && (
                <div className="pt-4 border-t border-gray-700 space-y-2">
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
                      onClick={handleRenameZone}
                      className="bg-emerald-500 text-gray-950 font-bold px-3 rounded text-xs hover:bg-emerald-600 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-900/60 p-3 rounded border border-gray-700 text-[11px] text-gray-400 leading-relaxed space-y-1">
                <p className="font-bold text-amber-300">💡 Snapping Controls Active:</p>
                <p>Zone slots now align to an **automatic grid snapping step matrix** when dragged. Select any item to edit its name identifier label directly.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-300">Staging Inspector</h2>
              {selectedSlot ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-400 font-mono block">LOCATION SLOT</span>
                    <p className="text-xl font-bold text-emerald-400">{selectedSlot.id}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-mono block">PROJECT PROFILE ID (PALLET)</label>
                    <input 
                      type="text"
                      placeholder="Enter ID to spawn pallet (Clear to empty)"
                      value={inputProjectId}
                      onChange={(e) => setInputProjectId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-mono block">CONTENTS / BATCH INFO</label>
                    <textarea 
                      rows={3}
                      placeholder="Specify server equipment chassis specifications..."
                      value={inputNotes}
                      onChange={(e) => setInputNotes(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-400 resize-none"
                    />
                  </div>

                  <button
                    onClick={() => handleSaveData()}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold py-2 rounded text-sm transition-colors"
                  >
                    Sync Data State
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">Click any physical pallet box on the canvas layout to inspect, or drag an occupied pallet onto a vacant zone slot.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}