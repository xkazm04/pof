export function ReviewProgressBar({
  scanned,
  total,
  accentColor,
}: {
  scanned: number;
  total: number;
  accentColor: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {scanned}/{total} features scanned
        </span>
        <span className="text-xs text-text-muted">{pct}%</span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-slow ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: accentColor,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}
