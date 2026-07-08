// ── Sparkline tooltip bar ───────────────────────────────────────────────────

export function SparklineBar({ height, isEmpty, color, dayName, total, success, pct }: {
  height: number;
  isEmpty: boolean;
  color: string;
  dayName: string;
  total: number;
  success: number;
  pct: number;
}) {
  return (
    <div
      className="group/tip relative w-full rounded-sm transition-all cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{
        height: `${height}px`,
        backgroundColor: color,
        opacity: isEmpty ? 0.3 : 0.8,
        outlineColor: color,
      }}
      tabIndex={0}
      role="img"
      aria-label={`${dayName}: ${total} sessions, ${success} successful, ${pct}% success rate`}
    >
      {/* CSS-only tooltip */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100
          group-focus-visible/tip:opacity-100 group-focus-visible/tip:scale-100
          transition-all duration-150 z-10"
      >
        <div className="px-2.5 py-2 rounded-md bg-[#1a1a24] border border-border shadow-lg whitespace-nowrap text-left">
          <p className="text-2xs font-medium text-text mb-1">{dayName}</p>
          <div className="space-y-0.5">
            <p className="text-2xs text-text-muted">
              Sessions: <span className="text-text tabular-nums">{total}</span>
            </p>
            <p className="text-2xs text-text-muted">
              Successful: <span className="text-text tabular-nums">{success}</span>
            </p>
            {total > 0 && (
              <p className="text-2xs text-text-muted">
                Rate: <span className="tabular-nums font-medium" style={{ color }}>{pct}%</span>
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
            border-l-[5px] border-l-transparent
            border-r-[5px] border-r-transparent
            border-t-[5px] border-t-border" />
        </div>
      </div>
    </div>
  );
}
