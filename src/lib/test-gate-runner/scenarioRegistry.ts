/**
 * Scenario registry — lets a pipeline step/archetype declare the behavioural
 * GateScenario its L3 gate should run, so a deferred `pipeline_artifacts` row resolves
 * to a faithful "drive + observe" gate (not just a symbolic testName). `collectDeferred`
 * consults this; the spawn executor runs whatever scenario is attached.
 *
 * A factory (not a static scenario) so the scenario can be parameterised by the entity
 * (e.g. the ability tag is derived from `entityId`).
 */
import type { GateScenario } from './types';

export interface ScenarioJobKey {
  catalogId: string;
  entityId: string;
  step: string;
  testName?: string;
}

export type ScenarioFactory = (job: ScenarioJobKey) => GateScenario | undefined;

const registry = new Map<string, ScenarioFactory>();

/** Register a scenario factory. Keys are matched most→least specific by `resolveScenario`:
 *  `${catalogId}:${step}`, then `${catalogId}`, then `${testName}`. */
export function registerScenario(key: string, factory: ScenarioFactory): void {
  registry.set(key, factory);
}

/** Test seam — wipe + re-seed. */
export function clearScenarioRegistry(): void {
  registry.clear();
}

/** Resolve the most-specific registered scenario for a job, if any. */
export function resolveScenario(job: ScenarioJobKey): GateScenario | undefined {
  const keys = [`${job.catalogId}:${job.step}`, job.catalogId, job.testName].filter(
    (k): k is string => !!k,
  );
  for (const k of keys) {
    const scenario = registry.get(k)?.(job);
    if (scenario) return scenario;
  }
  return undefined;
}

/** 'ground-slam' / 'ground_slam' / 'GroundSlam' -> 'Ability.GroundSlam'. */
export function abilityTagFor(entityId: string): string {
  const pascal = entityId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return `Ability.${pascal}`;
}

/**
 * Built-in scenarios. Re-registered idempotently (clear-safe). The abilities archetype:
 * open the lit test map, activate the entity's ability tag directly on the pawn's ASC,
 * and assert the ability actually committed (a montage played and/or a resource dropped).
 */
export function registerBuiltinScenarios(): void {
  registerScenario('abilities', (job) => ({
    map: '/Game/Maps/TestHarness',
    totalSeconds: 2.5,
    numSamples: 8,
    settle: 1.0,
    inputs: [
      { event: 'activate_ability', eventArg: abilityTagFor(job.entityId), start: 0.5, duration: 0.1 },
    ],
    assert: [{ kind: 'ability-activated' }],
  }));
}

registerBuiltinScenarios();
