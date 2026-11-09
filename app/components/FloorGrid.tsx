"use client";

import { useRef, useState } from "react";
import { useFloorLayout } from "./floor-grid/useFloorLayout";
import FloorHeader from "./floor-grid/FloorHeader";
import FloorCanvas from "./floor-grid/FloorCanvas";
import AdminPanel from "./floor-grid/AdminPanel";
import InspectorPanel from "./floor-grid/InspectorPanel";
import styles from "./floor-grid/FloorGrid.module.css";

export default function FloorGrid() {
  const layout = useFloorLayout();
  const { selectedSlot, isAdminMode } = layout;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-900 text-white min-h-screen flex flex-col">
      <FloorHeader />

      <div
        ref={workspaceRef}
        className={`${styles.workspace} flex-1`}
        data-panel-open={isInspectorOpen ? "true" : "false"}
      >
        <div
          className={styles.workspaceContent}
          data-panel-open={isInspectorOpen ? "true" : "false"}
        >
          <FloorCanvas
            fullscreenTargetRef={workspaceRef}
            slots={layout.activeSlots}
            selectedSlot={selectedSlot}
            isAdminMode={isAdminMode}
            onToggleAdmin={layout.toggleAdminMode}
            searchQuery={layout.searchQuery}
            onSearchChange={layout.setSearchQuery}
            isInspectorOpen={isInspectorOpen}
            onToggleInspector={() => setIsInspectorOpen((open) => !open)}
            activeBay={layout.activeBay}
            onBayChange={layout.selectBay}
            onSelect={layout.selectSlot}
            onClearSelection={layout.clearSelection}
            onPalletDrop={layout.movePallet}
            onZoneMove={layout.moveZone}
            onCanvasSizeChange={layout.setCanvasSize}
            isPlacingItem={layout.isPlacingItem}
            pendingFootprint={layout.pendingFootprint}
            placementAvailable={layout.placementAvailable}
            onFootprintChange={layout.setPendingFootprint}
            onFinishPlacement={layout.finishItemPlacement}
            shelfContents={layout.shelfContents}
            expandedShelfId={layout.expandedShelfId}
            onCloseShelf={layout.closeShelf}
            onShelfDrop={layout.moveToShelf}
            onShelfPalletDrop={layout.takeOffShelf}
          />

          <aside
            id="floor-inspector"
            aria-hidden={!isInspectorOpen}
            inert={!isInspectorOpen}
            aria-label={isAdminMode ? "Layout controls" : "Staging inspector"}
            className={`${styles.inspectorPanel} bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl h-fit flex flex-col space-y-4`}
          >
            {isAdminMode ? (
              <AdminPanel
                key={selectedSlot?.id ?? "none"}
                fullscreenTargetRef={workspaceRef}
                selectedSlot={selectedSlot}
                selectedStoredCount={selectedSlot ? layout.storedCountFor(selectedSlot.id) : 0}
                onCreate={layout.createZone}
                isPlacingItem={layout.isPlacingItem}
                pendingFootprint={layout.pendingFootprint}
                placementAvailable={layout.placementAvailable}
                onStartPlacement={layout.startItemPlacement}
                onCancelPlacement={layout.cancelPalletPlacement}
                onSave={layout.saveDetails}
                onRename={layout.renameZone}
                onDelete={layout.deleteZone}
              />
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-300">Staging Inspector</h2>
                {selectedSlot ? (
                  <InspectorPanel
                    key={selectedSlot.id}
                    slot={selectedSlot}
                    storedCount={layout.storedCountFor(selectedSlot.id)}
                    onSave={layout.saveDetails}
                    onDelete={layout.deleteZone}
                  />
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    Click any physical pallet box on the canvas layout to inspect, or drag an occupied pallet onto a vacant zone slot.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
