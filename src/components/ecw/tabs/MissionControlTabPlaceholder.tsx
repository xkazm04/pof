'use client';

export function MissionControlTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Mission Control</h1>
      <p className="text-text-muted">The project-wide overview surface lands in Phase 5.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Catalog lifecycle progress (8-catalog roll-up)</li>
        <li>Critical Path DAG + NBA queue</li>
        <li>Forecast (playable-by ETA, velocity, confidence)</li>
        <li>Activity feed + cook log + cost dashboard</li>
        <li>Absorbs the current 26-tab Evaluator god-tab</li>
      </ul>
    </div>
  );
}
