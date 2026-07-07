'use client';

/** One swimlane cell: a colored block whose background encodes step readiness.
 *  Unwired steps render hollow (dark) so bottlenecks pop against proven lanes. */
import type { StepCell } from '@/lib/status/statusModel';
import { OPACITY_20, OPACITY_60 } from '@/lib/chart-colors';

export function StatusCell({ cell, color }: { cell: StepCell; color?: string }) {
  const { counts } = cell;
  const title = [
    `${cell.label} — ${cell.readiness}${cell.tier ? ` (${cell.tier})` : ''}`,
    `pass ${counts.pass} · deferred ${counts.deferred} · pending ${counts.pending} · fail ${counts.fail}`,
    cell.reason ? `reason: ${cell.reason}` : '',
  ].filter(Boolean).join('\n');

  const unwired = cell.readiness === 'unwired' || !color;
  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={`h-9 w-28 rounded-sm border px-1.5 py-1 text-xs leading-tight overflow-hidden select-none ${
        unwired ? 'border-slate-800 text-slate-500 bg-transparent' : 'text-slate-200'
      }`}
      style={unwired ? undefined : { background: color + OPACITY_20, borderColor: color + OPACITY_60 }}
    >
      <span className="block truncate">{cell.label}</span>
      <span className="block truncate opacity-70">{unwired ? 'unwired' : `${cell.readiness}${cell.tier ? ` · ${cell.tier}` : ''}`}</span>
    </div>
  );
}
