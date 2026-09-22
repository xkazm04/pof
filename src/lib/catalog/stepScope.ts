/**
 * Which steps of a pipeline apply to an entity (/diablo W05, decision D18).
 *
 * A step may declare the canon profiles it applies to (`StepSpec.profiles`); a step that declares
 * none applies to every profile, so every existing pipeline is unchanged. This is the ONE resolver —
 * the lab rail, lifecycle totals, the e2e walker, one-shot and the server's submit all read it, so
 * no two surfaces can disagree about an entity's step list.
 */
import { DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';
import type { CatalogPipeline, StepSpec } from '@/lib/catalog/stepSpec';

/** Does `spec` apply to an entity of `canonProfile` (the project's own profile when none)? */
export function stepAppliesTo(spec: Pick<StepSpec, 'profiles'>, canonProfile?: string | null): boolean {
  if (!spec.profiles?.length) return true;
  return spec.profiles.includes(canonProfile ?? DEFAULT_CANON_PROFILE);
}

/** The steps of `pipeline` an entity of `canonProfile` has, in pipeline order. */
export function stepsForProfile(pipeline: CatalogPipeline, canonProfile?: string | null): StepSpec[] {
  return pipeline.steps.filter((s) => stepAppliesTo(s, canonProfile));
}

/** Labels only — for surfaces that key on step labels (the lab rail, the matrix). */
export function stepLabelsForProfile(pipeline: CatalogPipeline | null | undefined, labels: readonly string[], canonProfile?: string | null): string[] {
  if (!pipeline) return [...labels];
  const scoped = new Map(pipeline.steps.map((s) => [s.label, s]));
  return labels.filter((l) => { const s = scoped.get(l); return !s || stepAppliesTo(s, canonProfile); });
}
