/**
 * The craft gauge admission door (pure, isomorphic) — what `POST /api/craft-verdicts` will
 * store. The server already holds everything that decides how a step is gauged: its lens
 * (`lensForStep` over the audited step fact), that lens's version (`LENS_VERSIONS`) and the
 * medium's roof (`craft-ceilings.json`). The writer used to name all three on its own word, so a
 * gauge could be re-labelled under a lens the step is not gauged by, stamped with a lens version
 * not in force, or awarded above the roof. The door DERIVES what it owns and refuses a writer
 * that asserts otherwise:
 *  - lens: derived from the step fact; a named lens that differs is refused (naming the expected
 *    one). A step absent from the fleet audit has nothing to derive from — the writer's lens is
 *    kept (it projects no chip), but it must name one.
 *  - lensVersion: `LENS_VERSIONS[lens]`; a named version that differs is refused.
 *  - aLevel: at most the medium's ceiling — raising a roof is a product decision recorded in
 *    craft-ceilings.json, never a gauge.
 *  - the `__process__` scorecard row is gauged by `production-process`, and only it is.
 *
 * Display-only like the rest of the A-axis: no grading module imports this file.
 */
import { craftRank, type GaugedCraftLevel } from '@/lib/status/craft';
import { craftStepOf } from '@/lib/craft/craftCell';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';
import type { LensId } from '@/lib/craft/lens-map';
import { err, ok, type Result } from '@/types/result';

/** The fields the door reads — lens and version are optional assertions, not inputs. */
export interface CraftGaugeClaim {
  catalogId: string;
  entityId: string;
  step: string;
  lens?: LensId;
  lensVersion?: number;
  aLevel: GaugedCraftLevel;
}

/** What the door derived — the lens and version the gauge is stored under. */
export interface AdmittedGauge {
  lens: LensId;
  lensVersion: number;
}

/**
 * Admit a gauge (returning the server-derived lens + version), or say every reason it cannot be
 * stored. `isProcess` marks the `__process__` scorecard row — the caller decides it from
 * `craft-verdicts-db`'s PROCESS_* keys, which this pure module cannot import (that module opens
 * the DB).
 */
export function admitCraftGauge(v: CraftGaugeClaim, { isProcess = false }: { isProcess?: boolean } = {}): Result<AdmittedGauge, string[]> {
  if (isProcess && v.lens !== undefined && v.lens !== 'production-process') {
    return err(['the __process__ scorecard row must use the production-process lens']);
  }
  if (!isProcess && v.lens === 'production-process') {
    return err(['production-process gauges the catalog, not a step — use the __process__ row']);
  }

  const step = isProcess ? undefined : craftStepOf(v.catalogId, v.step);
  const lens: LensId | undefined = isProcess ? 'production-process' : (step?.lens ?? v.lens);
  if (!lens) {
    return err([`${v.catalogId}::${v.step} has no audited step fact to derive a lens from — name the lens`]);
  }

  const reasons: string[] = [];
  if (step && v.lens !== undefined && v.lens !== step.lens) {
    reasons.push(
      `lens '${v.lens}' does not gauge ${v.catalogId}::${v.step} — this step is gauged by the '${step.lens}' lens (its audited deliverable is ${step.deliverable})`,
    );
  }
  const current = LENS_VERSIONS[lens];
  if (v.lensVersion !== undefined && v.lensVersion !== current) {
    reasons.push(`lens '${lens}' v${v.lensVersion} is not in force (current v${current})`);
  }
  if (step && craftRank(v.aLevel) > craftRank(step.ceiling)) {
    reasons.push(
      `${v.aLevel} is above the recorded roof for ${step.deliverable} (ceiling ${step.ceiling}, src/lib/craft/craft-ceilings.json) — not awardable; raising a roof is a product decision, not a gauge`,
    );
  }
  return reasons.length ? err(reasons) : ok({ lens, lensVersion: current });
}
