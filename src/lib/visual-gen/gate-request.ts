/**
 * The ONE rule for "what does a mesh of class C, at stage S, generated against budget B,
 * get held to by the Tier-1 gate". Pure.
 *
 * Every producer (TripoSR / Hunyuan / TRELLIS / Tripo / mesh-finish / remediate) used to
 * hand-build its own `CritiqueDeps`: four builders, the nominal-extent fallback copied
 * into each, two of them skipping `resolveAssetClass`. The cost was concrete — when the
 * orientation rule was added to `scoreMesh`, no builder had a slot for it, so
 * `orientation-lying` could not fire on any production verdict while the asset viewer
 * graded the same bbox `lying`. The builders now differ ONLY in the facts their producer
 * owns: the stage, and the budget it actually sent.
 *
 * Rules, each owned exactly once here:
 *  - class: `resolveAssetClass` — an absent/unrecognised class is STATED in `gradedAs`,
 *    never silently graded class-blind and never promoted to a guessed class;
 *  - ceilings: `critiqueThresholdsFor` of the RESOLVED class (empty → defaults);
 *  - size: `targetExtentM ?? nominalExtentFor(class)` — nominal only where honest;
 *  - orientation: `expectsUprightFor(class)` — only a class that reliably stands is held
 *    to standing (a prop, a sword, a rug are not). It grades a WARN, never a fail, so no
 *    re-roll / finish / remediation decision (all fail-only) is moved by it;
 *  - budget: ONLY when one was actually sent to the generator — a fabricated budget would
 *    report "the provider ignored your budget" about a budget nobody sent.
 *
 * Follow-ups this makes a one-liner: the viewer's inline derivation
 * (`asset-viewer/assetGrade.ts`) and the class-blind MCP gate (`blender-mcp/mcp-gate.ts`).
 */
import type { CritiqueDeps } from './mesh-critique';
import type { MeshStage } from './critique-stage';
import type { BudgetRequest } from './face-budget';
import { critiqueThresholdsFor, resolveAssetClass } from './polycount-presets';
import { expectsUprightFor, nominalExtentFor } from './world-scale';

export interface GateRequestInput {
  /** What the caller sent — resolved (and stated) here, never trusted raw. */
  assetClass: string | undefined;
  /** What the producer's output IS: generator output is `raw`, a finish run is `finished`. */
  stage: MeshStage;
  /** Intended longest extent (m); falls back to the class nominal only where one is honest. */
  targetExtentM?: number;
  /** The face budget actually SENT to the generator/finisher. Absent → no budget grade. */
  sentBudget?: BudgetRequest;
}

export interface GateRequest {
  deps: CritiqueDeps;
  /** One line naming what the mesh was graded against (class budget, or class-blind and why). */
  gradedAs: string;
}

export function gateRequestFor(input: GateRequestInput): GateRequest {
  const resolved = resolveAssetClass(input.assetClass);
  const cls = resolved.assetClass;
  const extent = input.targetExtentM ?? nominalExtentFor(cls);
  const upright = expectsUprightFor(cls);
  const deps: CritiqueDeps = {
    thresholds: cls ? critiqueThresholdsFor(cls) : {},
    stage: input.stage,
    ...(extent !== undefined ? { size: { targetExtentM: extent } } : {}),
    ...(input.sentBudget ? { budget: input.sentBudget } : {}),
    ...(upright ? { orientation: { expectUpright: true } } : {}),
  };
  return { deps, gradedAs: resolved.gradedAs };
}
