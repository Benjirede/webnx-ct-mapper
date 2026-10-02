"use client";

import { useFloorLayout } from "./floor-grid/useFloorLayout";
import FloorHeader from "./floor-grid/FloorHeader";
import FloorCanvas from "./floor-grid/FloorCanvas";
import AdminPanel from "./floor-grid/AdminPanel";
import InspectorPanel from "./floor-grid/InspectorPanel";

export default function FloorGrid() {
  const layout = useFloorLayout();
  const { selectedSlot, isAdminMode } = layout;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-900 text-white min-h-screen flex flex-col">
      <FloorHeader
        isAdminMode={isAdminMode}
        searchQuery={layout.searchQuery}
        onToggleAdmin={layout.toggleAdminMode}
        onSearchChange={layout.setSearchQuery}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <FloorCanvas
          slots={layout.activeSlots}
          selectedSlot={selectedSlot}
          isAdminMode={isAdminMode}
          searchQuery={layout.searchQuery}
          activeBay={layout.activeBay}
          onBayChange={layout.selectBay}
          onSelect={layout.selectSlot}
          onPalletDrop={layout.movePallet}
          onZoneMove={layout.moveZone}
          onCanvasSizeChange={layout.setCanvasSize}
        />

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl h-fit flex flex-col space-y-4">
          {isAdminMode ? (
            <AdminPanel
              key={selectedSlot?.id ?? "none"}
              selectedSlot={selectedSlot}
              onCreate={layout.createZone}
              onRename={layout.renameZone}
            />
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-300">Staging Inspector</h2>
              {selectedSlot ? (
                <InspectorPanel key={selectedSlot.id} slot={selectedSlot} onSave={layout.saveDetails} />
              ) : (
                <p className="text-gray-500 text-sm italic">
                  Click any physical pallet box on the canvas layout to inspect, or drag an occupied pallet onto a vacant zone slot.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}