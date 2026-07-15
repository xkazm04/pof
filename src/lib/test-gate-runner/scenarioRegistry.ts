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
  /**
   * Explicit ability/tag override for gameplay-ability scenarios. When set it WINS over the
   * blind PascalCase derivation from `entityId` (which silently produces a wrong tag that reads
   * as "no montage and no resource"). A full tag (`Ability.Fireball`, or any dotted tag) is used
   * verbatim; a bare name (`Fireball`) is PascalCased under `Ability.`.
   */
  abilityTag?: string;
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

/**
 * Resolve the gameplay-ability tag for a scenario. `override` (when a non-empty string) WINS:
 * a dotted tag (`Ability.Fireball`, `Foo.Bar`) is used verbatim, a bare name is PascalCased under
 * `Ability.`. With no override it blind-PascalCases `entityId` — 'ground-slam' / 'ground_slam' /
 * 'GroundSlam' -> 'Ability.GroundSlam'. The override is the escape hatch for an entityId whose
 * PascalCase does NOT match the registered tag (which otherwise silently reads as "no effect").
 */
export function abilityTagFor(entityId: string, override?: string): string {
  const src = override && override.trim() ? override.trim() : null;
  if (src) return src.includes('.') ? src : `Ability.${pascalCase(src)}`;
  return `Ability.${pascalCase(entityId)}`;
}

function pascalCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Built-in scenarios. Re-registered idempotently (clear-safe).
 *
 * - **abilities** — open the lit test map, activate the entity's ability tag directly on the
 *   pawn's ASC, and assert the ability committed (a montage played and/or a resource dropped).
 *   The requested tag is stamped onto the assertion so an unresolvable tag reports LOUDLY.
 * - **movement** (`character-pipeline`) — drive the W key for ~1.8s with AI disabled (so enemies
 *   can't stagger the pawn), then assert on REAL observations: horizontal displacement + peak
 *   speed. This is the WASD-run half of the character-pipeline gate, judged by the observed
 *   effect rather than a symbolic test name.
 */
export function registerBuiltinScenarios(): void {
  registerScenario('abilities', (job) => {
    const tag = abilityTagFor(job.entityId, job.abilityTag);
    return {
      map: '/Game/Maps/TestHarness',
      totalSeconds: 2.5,
      numSamples: 8,
      settle: 1.0,
      inputs: [
        { event: 'activate_ability', eventArg: tag, start: 0.5, duration: 0.1 },
      ],
      assert: [{ kind: 'ability-activated', tag }],
    };
  });

  registerScenario('character-pipeline', () => ({
    map: '/Game/Maps/TestHarness',
    totalSeconds: 3,
    numSamples: 12,
    settle: 1.0,
    disableAI: true,
    inputs: [
      { key: 'W', start: 0.5, duration: 1.8 },
    ],
    assert: [
      { kind: 'moved', minDist: 100 },
      { kind: 'min-speed', minSpeed: 50 },
    ],
  }));
}

registerBuiltinScenarios();
