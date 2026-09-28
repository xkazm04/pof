import { summarizeBatchDrain, type DrainOutcome } from '@/components/layout-lab/batchDrainModel';

/**
 * Pure model for the PER-ENTITY coach drain ("Run N deferred gates"). The catalog-scope drain
 * already had a full outcome model (`summarizeBatchDrain` + `ranNothing`); the entity scope used
 * to discard its response, so a lease refusal, a server error and a run where no UE editor
 * answered all looked like "nothing happened". This derives ONE displayable outcome from the
 * same `DrainOutcome` shape, reusing the batch derivation, and adds the step INDEX so every
 * failing gate is one click from its own step. Side-effect-free so every state is unit-tested.
 */

/**
 * The drain route's answer as the client sees it: {@link DrainOutcome}, whose `locked` case may
 * also carry the server's own refusal reason (the 409 names the scope already in flight).
 */
export type DrainResponse = Exclude<DrainOutcome, { kind: 'locked' }> | { kind: 'locked'; reason?: string };

/** One gate the operator must read, with where it lives in THIS entity's step list. */
export interface EntityGateNote {
  step: string;
  /** Jump target in the entity's rendered step list; null when the step is not in it. */
  index: number | null;
  reason: string;
}

interface OutcomeBase {
  /** One sentence: what happened (and, for a refusal/empty run, what to do). */
  message: string;
  /** Retry is meaningful (the run can be re-requested as-is). */
  retryable: boolean;
  frames: string[];
}

export type EntityDrainOutcome =
  | (OutcomeBase & {
      state: 'ran';
      ran: number; passed: number; failed: number; deferred: number; skipped: number;
      fails: EntityGateNote[];
      deferrals: EntityGateNote[];
    })
  | (OutcomeBase & { state: 'ran-nothing'; skipped: number })
  | (OutcomeBase & { state: 'refused' })
  | (OutcomeBase & { state: 'error' });

/**
 * Did this run execute nothing at all? `ran: 0` with skipped gates means every job was refused
 * before it started — and with the lab's bridge-only executor that is almost always "no UE
 * editor was listening". A locked/errored run is deliberately NOT this state: the lease refused
 * the run, the executor never got a say. Shared by the Matrix batch drain and the coach drain.
 */
export function ranNothing(summary: { ran: number; skipped: number; entitiesLocked: number; entitiesErrored: number } | null): boolean {
  if (!summary) return false;
  if (summary.entitiesLocked > 0 || summary.entitiesErrored > 0) return false;
  return summary.ran === 0 && summary.skipped > 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Derive the displayable outcome of one entity's drain. A missing response (`null`/`undefined`,
 * e.g. a client stub) is an `error`, never a throw and never a silent success.
 */
export function entityDrainOutcome(steps: readonly string[], outcome: DrainResponse | null | undefined): EntityDrainOutcome {
  if (!outcome) {
    return { state: 'error', message: 'Drain failed — the server returned no result.', retryable: true, frames: [] };
  }
  if (outcome.kind === 'locked') {
    const why = outcome.reason?.trim() || 'another drain holds the UE editor lease';
    return { state: 'refused', message: `Refused: ${why}. Retry once that drain finishes (the runner chip in the header shows it).`, retryable: true, frames: [] };
  }
  if (outcome.kind === 'error') {
    return { state: 'error', message: `Drain failed — ${outcome.reason}`, retryable: true, frames: [] };
  }

  const acc = summarizeBatchDrain([], outcome);
  if (ranNothing(acc)) {
    return {
      state: 'ran-nothing',
      skipped: acc.skipped,
      message: `Nothing ran — ${plural(acc.skipped, 'gate')} queued, 0 ran: no UE editor answered on the PoF bridge. `
        + 'The drain runs through a running UE editor and never launches one — start the editor with the PoF bridge plugin, then Retry.',
      retryable: true,
      frames: [],
    };
  }
  const at = (step: string) => { const i = steps.indexOf(step); return i >= 0 ? i : null; };
  const note = (n: { step: string; reason: string }): EntityGateNote => ({ step: n.step, index: at(n.step), reason: n.reason });
  const counts = [`${acc.passed} passed`, `${acc.failed} failed`];
  if (acc.deferred > 0) counts.push(`${acc.deferred} still deferred`);
  if (acc.skipped > 0) counts.push(`${acc.skipped} skipped`);
  return {
    state: 'ran',
    ran: acc.ran, passed: acc.passed, failed: acc.failed, deferred: acc.deferred, skipped: acc.skipped,
    fails: acc.fails.map(note),
    deferrals: acc.deferrals.map(note),
    message: acc.ran === 0
      ? 'Nothing to drain — the server holds no deferred gate for this entity.'
      : `Drained ${plural(acc.ran, 'gate')}: ${counts.join(' · ')}.`,
    retryable: false,
    frames: acc.screenshots,
  };
}
