// ─── Stat row ───────────────────────────────────────────────────────────────

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-2xs font-medium text-text">{value}</span>
    </div>
  );
}
