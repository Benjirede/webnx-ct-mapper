"use client";

export default function FloorHeader() {
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

      <div className="flex items-center gap-3">
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
