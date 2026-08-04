/**
 * Realization audit lookup — has a step's output actually been PROVEN to run in the
 * Browser preview and/or UE, independent of its quality grade? Complements the
 * capability map (browser-mirror.ts: could it run) with evidence (did it run).
 * Fed by realization-facts.json, grown one reviewed pipeline at a time with human
 * sign-off (dual-execution-preview-spec.md trio process).
 *
 * Never touches ACCEPTANCE grading — the checkers, `gradeArtifact` and the artifact POST
 * path do not read it. It is, deliberately, one input to the /status readiness DISPLAY:
 * `readiness.ts` awards R5 SHIPPED to a cell that is already R4 gate-proven AND audited
 * `ue: 'proven'` here. So "display-only" now means "display and the readiness projection",
 * not "decoration" — a distinction worth keeping straight before adding facts.
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
