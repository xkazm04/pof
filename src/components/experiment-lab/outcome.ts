/**
 * What an experiment result is allowed to CLAIM on screen.
 *
 * `ExperimentResult.ok` means only "the run produced output" — a completed probe, or at
 * least one observation sample. The panel used to render that as a green "✓ ran", which
 * put a green chip immediately beside a red behavioural fail for the same run: the player
 * spawned, did nothing, and the header said the run was fine. And a scenario with no
 * assertions ticked (the default — all three boxes start off) produced NO verdict at all
 * and rendered NOTHING, so an unjudged run looked like a passing one minus a chip.
 *
 * This module is the single derivation of the chips, pure so it is testable without a UE:
 *  - the run chip says WHAT WAS MEASURED (samples observed / probe completed), never
 *    "passed", and it may not sit at `ok` while a verdict for the same run reads `fail`;
 *  - a scenario with nothing asserted gets an explicit UNVERIFIED chip naming the reason.
 */
import type { StatusLevel } from '@/lib/status-token';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

export interface OutcomeChip {
  key: 'run' | 'behavior' | 'visual';
  /** Small muted word in front of the tag ('behavior', 'visual'); '' for the run chip. */
  label: string;
  level: StatusLevel;
  word: string;
  detail: string;
}

/** A judge that could not run is WARN (deferred), never the red an observed defect earns. */
const VERDICT_LEVEL: Record<'pass' | 'fail' | 'deferred', StatusLevel> = { pass: 'ok', fail: 'bad', deferred: 'warn' };

/** A scenario run is the one that carries observations; a python probe never does. */
function isScenario(r: ExperimentResult): boolean {
  return r.observationSummary !== undefined;
}

export function experimentChips(r: ExperimentResult): OutcomeChip[] {
  const chips: OutcomeChip[] = [];
  const scenario = isScenario(r);

  // Any observed defect for THIS run. A `deferred` verdict is not one — nothing was judged.
  const contradicted = r.behavioralVerdict?.status === 'fail' || r.verdict?.status === 'fail';

  if (!r.ok) {
    chips.push({
      key: 'run',
      label: '',
      level: 'bad',
      word: scenario ? 'NO SAMPLES' : 'PROBE FAILED',
      detail: r.error ?? (scenario ? 'the scenario produced no observations' : 'the probe reported an error'),
    });
  } else {
    const n = r.observationSummary?.sampleCount ?? 0;
    chips.push({
      key: 'run',
      label: '',
      // The run chip measures execution, not success. When a verdict for the same run
      // says `fail`, execution alone does not earn green — two adjacent chips must not
      // carry opposite polarity for one run.
      level: contradicted ? 'warn' : 'ok',
      word: scenario ? `${n} SAMPLES OBSERVED` : 'PROBE COMPLETED',
      detail: scenario
        ? `the scenario ran and produced ${n} observation sample${n === 1 ? '' : 's'} — that it ran is not that it passed`
        : 'the Python probe ran to completion without raising',
    });
  }

  if (scenario) {
    chips.push(
      r.behavioralVerdict
        ? {
            key: 'behavior',
            label: 'behavior',
            level: VERDICT_LEVEL[r.behavioralVerdict.status],
            word: r.behavioralVerdict.status,
            detail: r.behavioralVerdict.detail,
          }
        : {
            key: 'behavior',
            label: 'behavior',
            level: 'warn',
            word: 'UNVERIFIED',
            detail: 'no assertions were checked, so nothing judged this run\'s behaviour — tick "moved" / "animated" / "montage played" before running to get a verdict',
          },
    );
  }

  if (r.verdict) {
    chips.push({
      key: 'visual',
      label: 'visual',
      level: VERDICT_LEVEL[r.verdict.status],
      word: r.verdict.status,
      detail: r.verdict.detail,
    });
  }

  return chips;
}
