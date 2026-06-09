/**
 * Checklist-progress counting — the single source of truth for "what counts as
 * a completed checklist item".
 *
 * The compliance audit (`gdd-compliance`), the synthesized GDD (`gdd-synthesizer`)
 * and the Nexus dependency view all tally per-module checklist progress. Before
 * this helper each site reimplemented `checklist.filter(c => progress[c.id]).length`
 * independently, so a change to the counting rule (weighting, skipped items, …)
 * would have silently diverged the surfaces. Route every tally through these two
 * functions so they always agree.
 */

import type { SubModuleDefinition } from '@/types/modules';
import { SUB_MODULES } from './module-registry';

export interface ChecklistCount {
  /** Number of registry checklist items marked complete in `progress`. */
  done: number;
  /** Total number of registry checklist items for the module(s). */
  total: number;
}

/**
 * Tally one module's checklist. `total` is the module's registry checklist
 * length; `done` is how many of those items are marked complete in `progress`.
 * Progress keys that are not registry checklist items are ignored, so stale
 * toggles can never inflate either count.
 */
export function countChecklist(
  mod: Pick<SubModuleDefinition, 'checklist'>,
  progress: Record<string, boolean> | undefined,
): ChecklistCount {
  const checklist = mod.checklist ?? [];
  const p = progress ?? {};
  const done = checklist.filter((c) => p[c.id]).length;
  return { done, total: checklist.length };
}

/**
 * Project-wide tally across every registered sub-module. `progress` is keyed by
 * module id, then by checklist item id. Equivalent to summing {@link countChecklist}
 * over the whole registry.
 */
export function countAllChecklists(
  progress: Record<string, Record<string, boolean>> | undefined,
): ChecklistCount {
  const p = progress ?? {};
  let done = 0;
  let total = 0;
  for (const mod of SUB_MODULES) {
    const c = countChecklist(mod, p[mod.id]);
    done += c.done;
    total += c.total;
  }
  return { done, total };
}
