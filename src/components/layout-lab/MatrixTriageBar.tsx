'use client';

import { COACH_HINT } from './coachLadder';
import { TRIAGE_RUNGS, describePredicate, rungLabel, type TriagePredicate, type TriageRung } from './matrixTriage';
import { Button } from './ui/Button';
import type { LabTheme } from './theme';

interface Props {
  t: LabTheme;
  /** Rows per rung over the UNFILTERED board. */
  tally: Record<TriageRung, number>;
  total: number;
  /** Rows the active predicate keeps (the board's current length). */
  shown: number;
  predicate: TriagePredicate | null;
  onPredicate: (p: TriagePredicate | null) => void;
  /** Stops the filtered board would queue; `Work these N` shows only when > 0 and a handler exists. */
  queueSize: number;
  onWork?: () => void;
}

/** Colorblind-safe: every chip leads with its ladder glyph; hue only reinforces. */
const tone = (t: LabTheme, r: TriageRung) =>
  r === 'fail' ? t.bad : r === 'drift' || r === 'deferred' ? t.warn : r === 'none' ? t.ok : t.muted;

/**
 * The Matrix's triage strip: one chip per coach-ladder rung (plus `all pass`) with its count over
 * the whole board, the active predicate's caption (`2 of 5 · deferred` — the count carries what
 * it counts), Clear, and `Work these N`, which opens the filtered set as a work queue the canvas
 * walks with Next. Column predicates are applied from the grid's column headers.
 */
export function MatrixTriageBar({ t, tally, total, shown, predicate, onPredicate, queueSize, onWork }: Props) {
  const activeRung = predicate?.kind === 'rung' ? predicate.rung : null;
  return (
    <div data-testid="matrix-triage" className={t.fontMono}
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 28px', borderBottom: `1px solid ${t.line}`, fontSize: 13 }}>
      <span style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted }}>Triage</span>
      {TRIAGE_RUNGS.map((r) => {
        const active = activeRung === r;
        return (
          <Button key={r} mono active={active} disabled={tally[r] === 0 && !active} data-testid={`triage-chip-${r}`}
            ariaLabel={`${rungLabel(r)}: ${tally[r]} of ${total} rows${active ? ' (filtering — click to clear)' : ''}`}
            onClick={() => onPredicate(active ? null : { kind: 'rung', rung: r })}
            style={{ padding: '2px 10px', opacity: tally[r] === 0 && !active ? 0.5 : 1 }}>
            <span aria-hidden="true" style={{ color: active ? undefined : tone(t, r) }}>{r === 'none' ? '✓' : COACH_HINT[r].glyph}</span>
            {rungLabel(r)} <strong>{tally[r]}</strong>
          </Button>
        );
      })}
      <span data-testid="matrix-triage-caption" style={{ color: predicate ? t.inkDeep : t.muted, marginLeft: 8 }}>
        {predicate ? describePredicate(predicate, shown, total) : `${total} rows · ranked by the coach ladder`}
      </span>
      {predicate && <Button mono onClick={() => onPredicate(null)} data-testid="matrix-triage-clear">Clear</Button>}
      {predicate && onWork && queueSize > 0 && (
        <Button mono variant="accent" onClick={onWork} data-testid="matrix-work-queue"
          title="Open the first one, then walk the rest with Next from the canvas">
          {`Work these ${queueSize}`}
        </Button>
      )}
    </div>
  );
}
