import { BAY_IDS, type BayId } from "./types";

interface Props {
  activeBay: BayId;
  onBayChange: (bay: BayId) => void;
  searchMatchBayIds?: BayId[];
}

export default function FloorNav({ activeBay, onBayChange, searchMatchBayIds = [] }: Props) {
  const handleBayDragOver = (e: React.DragEvent<HTMLButtonElement>, bay: BayId) => {
    const dataTypes = Array.from(e.dataTransfer.types);
    if (!dataTypes.includes("text/source-id") || !dataTypes.includes("text/drag-type")) return;

    e.preventDefault();
    if (activeBay !== bay) onBayChange(bay);
  };

  return (
    <nav aria-label="Floor bays" className="mb-3 flex min-w-0 gap-2 overflow-x-auto border-b border-gray-800">
      {BAY_IDS.map((bay, index) => (
        <button
          key={bay}
          type="button"
          aria-pressed={activeBay === bay}
          title={
            searchMatchBayIds.includes(bay)
              ? `Search match found in Bay ${index + 1}`
              : undefined
          }
          onClick={() => onBayChange(bay)}
          onDragEnter={(e) => handleBayDragOver(e, bay)}
          onDragOver={(e) => handleBayDragOver(e, bay)}
          className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
            activeBay === bay
              ? "border-emerald-400 text-emerald-300"
              : "border-transparent text-gray-400 hover:border-gray-600 hover:text-white"
          } ${
            searchMatchBayIds.includes(bay)
              ? "animate-pulse border-cyan-400 bg-cyan-400/15 text-cyan-200 ring-2 ring-inset ring-cyan-400"
              : ""
          }`}
        >
          Bay {index + 1}
        </button>
      ))}
    </nav>
  );
}