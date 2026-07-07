'use client';

/** One swimlane cell, Blueprint-styled: names the ENGINE powering the step (the step
 *  label moves to the second line + tooltip); background encodes the strict grade.
 *  Unwired cells render hollow with a dashed border so bottlenecks pop. */
import type { StepCell, CellGrade } from '@/lib/status/statusModel';

/** Grade → lab token. Green (ok) is reserved for gate-proven; ungated generative
 *  output holds at warn; trusted (LLM/code) uses the blueprint ink. */
export const GRADE_VAR: Record<CellGrade, string> = {
  verified: 'var(--lab-ok)',
  trusted: 'var(--lab-ink)',
  ungated: 'var(--lab-warn)',
  deferred: 'var(--lab-deferred)',
  attention: 'var(--lab-bad)',
  pending: 'var(--lab-accent-bg)',
  unwired: 'transparent',
};

export function StatusCell({ cell }: { cell: StepCell }) {
  const { counts } = cell;
  const title = [
    `${cell.label} — ${cell.grade}${cell.tier ? ` (${cell.tier})` : ''} · engine: ${cell.engine}`,
    `pass ${counts.pass} · deferred ${counts.deferred} · pending ${counts.pending} · fail ${counts.fail}`,
    cell.reason ? `reason: ${cell.reason}` : '',
  ].filter(Boolean).join('\n');

  const unwired = cell.grade === 'unwired';
  const color = GRADE_VAR[cell.grade];
  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      style={{
        height: 40,
        width: 118,
        padding: 'var(--lab-s1) var(--lab-s2)',
        border: unwired ? '1px dashed var(--lab-line)' : `1px solid color-mix(in srgb, ${color} 70%, transparent)`,
        borderRadius: 'var(--lab-r-sm)',
        background: unwired ? 'transparent' : `color-mix(in srgb, ${color} 24%, transparent)`,
        color: unwired ? 'var(--text-subtle)' : 'var(--lab-text)',
        fontSize: 'var(--lab-fs-xs)',
        lineHeight: 1.25,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'block', fontFamily: 'var(--lab-font-mono)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {unwired ? '—' : cell.engine}
      </span>
      <span style={{ display: 'block', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cell.label}{!unwired && cell.tier ? ` · ${cell.tier}` : ''}
      </span>
    </div>
  );
}
