/**
 * Realization audit lookup — has a step's output actually been PROVEN to run in the
 * Browser preview and/or UE, independent of its quality grade? Complements the
 * capability map (browser-mirror.ts: could it run) with evidence (did it run).
 * Fed by realization-facts.json, grown one reviewed pipeline at a time with human
 * sign-off (dual-execution-preview-spec.md trio process). Display-only — never
 * touches acceptance grading.
 */
import realizationFactsJson from './realization-facts.json';

export type RealizationLevel = 'proven' | 'probable' | 'no';

export interface StepRealization {
  browser: RealizationLevel;
  ue: RealizationLevel;
  note: string;
}

interface RealizationFacts {
  pipelines: Record<string, { reviewedAt: string; steps: Record<string, StepRealization> }>;
}

const FACTS = realizationFactsJson as unknown as RealizationFacts;

export function getRealization(catalogId: string, step: string): StepRealization | undefined {
  return FACTS.pipelines[catalogId]?.steps[step];
}

/** Pipelines that have been through the dual-execution review (for /status affordances). */
export function reviewedPipelines(): string[] {
  return Object.keys(FACTS.pipelines);
}
