'use client';

import { OPACITY_8, withOpacity } from '@/lib/chart-colors';

/* ── Tag row ─────────────────────────────────────────────────────────── */

export function TagRow({ label, tag, color }: {
  label: string;
  tag: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-16 shrink-0">
        {label}
      </span>
      <code
        className="text-xs px-1.5 py-0.5 rounded font-mono"
        style={{ color, background: withOpacity(color, OPACITY_8) }}
      >
        {tag}
      </code>
    </div>
  );
}
