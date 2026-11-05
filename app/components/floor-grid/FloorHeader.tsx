interface Props {
  isAdminMode: boolean;
  searchQuery: string;
  onToggleAdmin: () => void;
  onSearchChange: (value: string) => void;
}

export default function FloorHeader({ isAdminMode, searchQuery, onToggleAdmin, onSearchChange }: Props) {
  return (
    <header className="mb-6 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-400">WebNX Custom Floorplan</h1>
        <p className="text-gray-400 text-sm">Spatial visual map tracking of hardware pallets and custom project stages</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onToggleAdmin}
          className={`px-4 py-3 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-colors shadow-md border ${
            isAdminMode
              ? "bg-emerald-600 border-lime-400 text-white-950 animate-pulse"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          {isAdminMode ? "🔒 Exit Blueprint" : "🛠️ Edit Layout"}
        </button>

        <input
          type="text"
<<<<<<< HEAD
          placeholder="🔍 Search ID, name, notes..."
=======
          placeholder="🔍 Search project or item ID..."
          aria-label="Search projects or item IDs"
>>>>>>> components
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400 placeholder-gray-500 shadow-md w-64"
        />
      </div>
    </header>
  );
}