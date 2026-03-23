'use client';

/* ── Tag row ─────────────────────────────────────────────────────────── */

export function TagRow({ label, tag, color }: {
  label: string;
  tag: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 w-14 shrink-0">
        {label}
      </span>
      <code
        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
        style={{ color, background: `${color}15` }}
      >
        {tag}
      </code>
    </div>
  );
}
