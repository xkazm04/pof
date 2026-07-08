import { OPACITY_15 } from '@/lib/chart-colors';

// ── Primitives ─────────────────────────────────────────────────────────────

export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-32 shrink-0">{label}</span>
      <span className={`text-xs text-text truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-2xs font-medium px-1.5 py-0.5 rounded shrink-0"
      style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
    >
      {text}
    </span>
  );
}

export function EmptyHint({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="pl-1">
      <p className="text-xs text-text-muted italic">{text}</p>
      {hint && <p className="text-xs text-text-muted/50 mt-0.5">{hint}</p>}
    </div>
  );
}
