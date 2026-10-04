'use client';
/**
 * Reach, in the only three states the evidence actually has.
 *
 * This is the honesty core of the whole surface, and the one rule a port loses first:
 *
 *   `reach` present                      -> MEASURED. A 0 is drawn: a solid track, a `0%` label.
 *   `reach` null, `reachMean` present    -> DERIVED from measured descendants. Muted fill, `~`
 *                                          prefix, and it says out loud that it is not a
 *                                          measurement.
 *   `reach` null, `reachMean` null       -> UNMEASURED. A hatched track and an em dash, never an
 *                                          empty bar, because an empty bar reads as zero.
 *
 * A measured 0% and an unmeasured row therefore differ in three independent ways — the track
 * (`data-measured`), the label (`0%` vs `—`) and the prose — so the distinction survives
 * greyscale, a colourblind reader and a screen reader alike (WCAG 1.4.1).
 *
 * `OrreryNode.reachMean` / `reachMeasured` are the model's own derivation: this component never
 * recomputes reach, it only renders which of the three states the model reports.
 */

import { Note } from '@/components/story/orrery/panel/parts';
import type { NodeIx, OrreryModel, ReachRow } from '@/lib/story/orrery';

export type ReachState = 'measured' | 'derived' | 'unmeasured';

export function reachStateOf(reach: ReachRow, mean: ReachRow): ReachState {
  if (reach) return 'measured';
  if (mean) return 'derived';
  return 'unmeasured';
}

const pct = (v: number) => Math.max(0, Math.min(100, v));

function Row({
  label,
  value,
  derived,
}: {
  label: string;
  value: number | undefined;
  derived: boolean;
}) {
  // A cohort the row does not carry is unmeasured FOR THIS NODE, even when its siblings were
  // measured — so it gets the hatched track, not a zero-length bar.
  if (typeof value !== 'number') {
    return (
      <>
        <span>{label}</span>
        <span data-role="orrery-bar" data-measured="false" />
        <span>&mdash;</span>
      </>
    );
  }
  return (
    <>
      <span>{label}</span>
      <span data-role="orrery-bar" data-derived={derived ? 'true' : undefined}>
        <i style={{ width: `${pct(value)}%`, background: derived ? 'var(--or-mut)' : undefined }} />
      </span>
      <span>
        {derived ? '~' : ''}
        {derived ? value.toFixed(0) : value}%
      </span>
    </>
  );
}

export function ReachBars({ model, i }: { model: OrreryModel; i: NodeIx }) {
  const n = model.R[i];
  const state = reachStateOf(n.reach, n.reachMean);
  const cohorts = model.cohorts.length > 0 ? model.cohorts : Object.keys(n.reach ?? n.reachMean ?? {});
  const runs = model.prov.runs;
  const sample = runs[0]?.n;

  if (state === 'unmeasured') {
    return (
      <>
        <div data-role="orrery-bars">
          <span>no row</span>
          <span data-role="orrery-bar" data-measured="false" />
          <span>&mdash;</span>
        </div>
        <Note tone="warn">
          No reach row for this node: <b>unmeasured, which is not the same as 0%</b>. It is drawn
          hatched in the reach lens.
        </Note>
      </>
    );
  }

  const row = state === 'measured' ? n.reach : n.reachMean;
  return (
    <>
      <div data-role="orrery-bars">
        {cohorts.map((c) => (
          <Row key={c} label={c} value={row?.[c]} derived={state === 'derived'} />
        ))}
      </div>
      {state === 'derived' ? (
        <Note>
          A container has no reach row of its own. These bars are the mean over its{' '}
          {n.reachMeasured} measured descendant{n.reachMeasured === 1 ? '' : 's'} &mdash; derived,
          not a measurement.
        </Note>
      ) : (
        <Note>
          Percent of runs that reach this node, per cohort
          {typeof sample === 'number' ? ` (n = ${sample} runs)` : ''}.
        </Note>
      )}
    </>
  );
}
