export default function FloorHeader() {
  return (
    <header className="mb-6 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-400">WebNX Custom Floorplan</h1>
        <p className="text-gray-400 text-sm">Spatial visual map tracking of hardware pallets and custom project stages</p>
      </div>
    </header>
  );
}