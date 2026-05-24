'use client';

export function LiveStateTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Live State</h1>
      <p className="text-text-muted">The always-on UE-side surface lands in Phase 6.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Bridge status + asset manifest diff (defined-here vs in-UE)</li>
        <li>Last build verdict + last functional test per catalog</li>
        <li>Live UObject inspector</li>
        <li>Crash Watchtower + 3D Zone Twin</li>
      </ul>
    </div>
  );
}
