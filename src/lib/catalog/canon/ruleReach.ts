/**
 * A canon law's REACH — exactly which Produce prompts it enters.
 *
 * Derived from the SAME resolvers `buildStepProducePrompt` uses, so the number the editor shows
 * is the number the prompts carry (the parity test pins it):
 *  - `rulesForProfile`  — which canon profiles the law is in force for (its own + any profile
 *    that inherits it by id);
 *  - `stepsForProfile`  — which steps an entity of that profile has;
 *  - `canonCategoriesForStep` — the category slice each step's prompt carries;
 *  - `selectRules`      — the scope match (global or that catalogId).
 *
 * A scope that names no registered catalog reaches nothing — `scopeKnown: false` — and is
 * refused by `validateRuleDraft` rather than stored as a law no prompt ever cites.
 */
import { canonCategoriesForStep } from '@/lib/catalog/contractPrompt';
import { stepsForProfile } from '@/lib/catalog/stepScope';
import type { CatalogPipeline } from '@/lib/catalog/stepSpec';
import { selectRules } from './canonContext';
import { CANON_PROFILES, rulesForProfile } from './profiles';
import type { ProjectRule } from './types';
import { scopeIsKnown } from './validation';

export interface RuleReach {
  /** `global` or a registered catalog id. */
  scopeKnown: boolean;
  /** Distinct (catalog, step) prompts the law enters. */
  stepCount: number;
  /** `catalogId/Step Label`, in registry then pipeline order. */
  steps: string[];
  byCatalog: { catalogId: string; steps: string[] }[];
}

type ReachRule = Pick<ProjectRule, 'id' | 'category' | 'scope' | 'profile'> & Partial<ProjectRule>;

export function ruleReach(rule: ReachRule, pipelines: readonly CatalogPipeline[]): RuleReach {
  const law = { title: '', body: '', ...rule } as ProjectRule;
  const scopeKnown = scopeIsKnown(law.scope, pipelines);
  const profiles = Object.keys(CANON_PROFILES).filter((p) => rulesForProfile([law], p).length > 0);
  const byCatalog: RuleReach['byCatalog'] = [];
  for (const pipeline of pipelines) {
    const labels = new Set<string>();
    for (const profile of profiles) {
      for (const spec of stepsForProfile(pipeline, profile)) {
        if (selectRules([law], pipeline.catalogId, canonCategoriesForStep(spec)).length) labels.add(spec.label);
      }
    }
    if (!labels.size) continue;
    // Pipeline order, not the order profiles happened to add them.
    byCatalog.push({ catalogId: pipeline.catalogId, steps: pipeline.steps.map((s) => s.label).filter((l) => labels.has(l)) });
  }
  const steps = byCatalog.flatMap((c) => c.steps.map((l) => `${c.catalogId}/${l}`));
  return { scopeKnown, stepCount: steps.length, steps, byCatalog };
}

/** One line for the editor: "Enters 77 prompts across 12 catalogs — e.g. items/Icon 2D Art, …". */
export function reachSummary(reach: RuleReach, sample = 4): string {
  if (!reach.scopeKnown) return 'This scope is not a registered catalog — the law would enter no prompt.';
  if (!reach.stepCount) return 'Enters no prompt: no step in this scope carries this category.';
  const n = reach.byCatalog.length;
  const more = reach.stepCount > sample ? `, +${reach.stepCount - sample} more` : '';
  return `Enters ${reach.stepCount} prompt${reach.stepCount === 1 ? '' : 's'} across ${n} catalog${n === 1 ? '' : 's'} — ${reach.stepCount > sample ? 'e.g. ' : ''}${reach.steps.slice(0, sample).join(', ')}${more}`;
}
