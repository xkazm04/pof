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
  unpowered: 'var(--lab-bad)',
  deferred: 'var(--lab-deferred)',
  attention: 'var(--lab-bad)',
  pending: 'var(--lab-accent-bg)',
  unwired: 'transparent',
};

export function StatusCell({ cell }: { cell: StepCell }) {
  const { counts } = cell;
  const title = [
    `${cell.label} — ${cell.grade}${cell.tier ? ` (${cell.tier})` : ''} · engine: ${cell.engine}`,
    cell.judged
      ? `JUDGED ${cell.judged.verdict.toUpperCase()} ${cell.judged.score}/100 by ${cell.judged.model}: ${cell.judged.findings}`
      : cell.judge ? `judge needed: ${cell.judge}${cell.checkerMeaningful === false ? ' · checker is shape-only' : ''}` : '',
    `pass ${counts.pass} · deferred ${counts.deferred} · pending ${counts.pending} · fail ${counts.fail}`,
    cell.auditNote ? `audit: ${cell.auditNote}` : '',
    cell.reason ? `reason: ${cell.reason}` : '',
  ].filter(Boolean).join('\n');

  const unwired = cell.grade === 'unwired';
  const unpowered = cell.grade === 'unpowered';
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
        // unpowered: hollow with a solid red frame — a claim with nothing behind it,
        // visually distinct from real failures (filled red) and unwired (dashed grey).
        border: unwired ? '1px dashed var(--lab-line)' : unpowered ? `1px solid ${color}` : `1px solid color-mix(in srgb, ${color} 70%, transparent)`,
        borderRadius: 'var(--lab-r-sm)',
        background: unwired || unpowered ? 'transparent' : `color-mix(in srgb, ${color} 24%, transparent)`,
        color: unwired ? 'var(--text-subtle)' : 'var(--lab-text)',
        fontSize: 'var(--lab-fs-xs)',
        lineHeight: 1.25,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'block', fontFamily: 'var(--lab-font-mono)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cell.label}
      </span>
      <span style={{ display: 'block', fontWeight: 400, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {unwired ? '—' : unpowered ? 'no engine' : `${cell.engine}${cell.tier ? ` · ${cell.tier}` : ''}`}
      </span>
    </div>
  );
}
