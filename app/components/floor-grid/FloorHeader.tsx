interface Props {
  isAdminMode: boolean;
  searchQuery: string;
  onToggleAdmin: () => void;
  onSearchChange: (value: string) => void;
}

export default function FloorHeader({ isAdminMode, searchQuery, onToggleAdmin, onSearchChange }: Props) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="mb-6 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-400">WebNX Custom Floorplan</h1>
        <p className="text-gray-400 text-sm">Spatial visual map tracking of hardware pallets and custom project stages</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onToggleAdmin}
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-400 placeholder-gray-500 shadow-md w-64"
        />

        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-colors shadow-md border bg-red-950/50 border-red-800/70 text-red-300 hover:bg-red-900/60 hover:text-white"
        >
          🚪 Sign Out
        </button>
      </div>
    </header>
  );
}
