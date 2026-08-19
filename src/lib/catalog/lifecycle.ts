import { summarizeEntity } from '@/lib/catalog/rollup';
import type { LifecycleState, TestResult } from '@/lib/catalog/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const ORDER: LifecycleState[] = ['planned', 'scaffolded', 'generated', 'wired', 'verified'];

/**
 * Structurally legal transition?  any → 'failed'; 'failed' → 'planned' (retry);
 * otherwise exactly one step forward along ORDER.
 */
export function canTransition(current: LifecycleState, next: LifecycleState): boolean {
  if (next === 'failed') return true;
  if (current === 'failed') return next === 'planned';
  const ci = ORDER.indexOf(current);
  const ni = ORDER.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

/**
 * The gate: returns the lifecycle to commit, or null to reject. `wired→verified`
 * additionally requires a passing functional test (the "compiles ≠ runs" rule).
 */
export function resolveTransition(
  current: LifecycleState,
  next: LifecycleState,
  testResult?: TestResult,
): LifecycleState | null {
  if (!canTransition(current, next)) return null;
  if (next === 'verified' && testResult !== 'pass') return null;
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation from pipeline truth
//
// The lab tree paints each entity's dot from its LifecycleState, and until now
// nothing could ever move it: every seed hardcodes `'planned'` and the only
// writer was the legacy generation callback (measured 2026-08-19: 0 rows in
// `catalog_lifecycle` against 817 persisted artifacts / 736 `pass`).
//
// So the state is DERIVED from what the pipeline actually persisted — never a
// manual toggle (Rule 4b) — with one rule that must not bend: `verified` is
// gated on a DRAINED runtime/visual gate (an L3/L4 artifact that actually
// PASSES), never on shape checks alone. An entity whose every step is a green
// L0 shape check is config-complete and nothing more; it stops at `wired`, and
// the evidence sentence SAYS that its runtime is unproven. Deriving a green dot
// from L0 passes is exactly the lie this derivation exists to refuse.
// ─────────────────────────────────────────────────────────────────────────────

/** Tiers whose `pass` can only come from a real drained gate (the runtime/visual runner). */
export const GATE_TIERS = ['L3', 'L4'] as const;

/** What a derived lifecycle is standing on — rendered as the tree dot's tooltip. */
export interface LifecycleEvidence {
  /** Steps the pipeline declares (0 when the catalog registers none). */
  totalSteps: number;
  /** Steps with a persisted artifact. */
  produced: number;
  passed: number;
  deferred: number;
  failed: number;
  /** Produced-but-unresolved plus never-produced (`summarizeEntity`'s pending). */
  pending: number;
  /** L3/L4 artifacts that PASS — i.e. gates that were actually drained. */
  gatePasses: number;
  /** L3/L4 artifacts still `deferred` — gates the runner has not drained yet. */
  gatesUndrained: number;
  /** Straight from `summarizeEntity` — never re-implemented here. */
  configComplete: boolean;
  /** One plain sentence naming the evidence behind the state. */
  summary: string;
}

export interface DerivedLifecycle {
  lifecycle: LifecycleState;
  /**
   * The input to the `verified` gate: `'pass'` ONLY when a drained L3/L4 gate passed.
   * Undefined otherwise, so `resolveTransition(..., 'verified', testResult)` refuses.
   */
  testResult?: TestResult;
  evidence: LifecycleEvidence;
}

function evidenceSentence(state: LifecycleState, e: Omit<LifecycleEvidence, 'summary'>): string {
  const steps = `${e.passed}/${e.totalSteps || e.produced} step(s) pass`;
  switch (state) {
    case 'failed':
      return `${e.failed} step(s) FAILED acceptance — ${steps}.`;
    case 'planned':
      return 'no step has produced an artifact yet.';
    case 'scaffolded':
      return `${steps}; ${e.pending} step(s) still pending or never produced.`;
    case 'generated':
      return `every step has produced (${steps}), but an early-tier deferral holds it below config-complete.`;
    case 'wired':
      return e.gatesUndrained > 0
        ? `config-complete (${steps}), but ${e.gatesUndrained} runtime/visual gate(s) are still deferred — runtime UNPROVEN.`
        : `config-complete (${steps}) on shape/static checks only — no L3/L4 gate has been drained, so runtime is UNPROVEN.`;
    case 'verified':
      return `config-complete (${steps}) AND ${e.gatePasses} drained L3/L4 gate(s) pass — runtime proven.`;
  }
}

/**
 * Derive an entity's lifecycle from its persisted artifacts.
 *
 * `configComplete` comes from {@link summarizeEntity} (`rollup.ts`) — the single
 * input, not a re-implementation. The only thing counted here that the rollup does
 * not expose is the gate evidence: which L3/L4 artifacts pass vs remain deferred.
 *
 * Ladder:
 *  - any `fail`                          → `failed`
 *  - nothing produced                    → `planned`
 *  - something pending / never produced  → `scaffolded`
 *  - everything produced, not complete   → `generated`
 *  - config-complete, no drained gate    → `wired`   ← where a shape-only pass STOPS
 *  - config-complete + drained gate pass → `verified` (through `resolveTransition`)
 */
export function deriveEntityLifecycle(
  artifacts: ReadonlyArray<Pick<PipelineArtifact, 'status' | 'tier'>>,
  totalSteps: number,
): DerivedLifecycle {
  const roll = summarizeEntity(artifacts as PipelineArtifact[], totalSteps);
  let gatePasses = 0;
  let gatesUndrained = 0;
  for (const a of artifacts) {
    if (a.tier !== 'L3' && a.tier !== 'L4') continue;
    if (a.status === 'pass') gatePasses++;
    else if (a.status === 'deferred') gatesUndrained++;
  }
  const testResult: TestResult | undefined = gatePasses > 0 ? 'pass' : undefined;

  const base = {
    totalSteps,
    produced: artifacts.length,
    passed: roll.done,
    deferred: roll.deferred,
    failed: roll.failed,
    pending: roll.pending,
    gatePasses,
    gatesUndrained,
    configComplete: roll.configComplete,
  };

  let state: LifecycleState;
  if (roll.failed > 0) state = 'failed';
  else if (artifacts.length === 0) state = 'planned';
  else if (roll.configComplete) {
    // The ONE rung that needs proof beyond shape: route it through the tested gate
    // rather than assigning `verified` directly, so the "compiles ≠ runs" rule is
    // enforced by `resolveTransition` and not by a second, drift-prone copy of it.
    state = resolveTransition('wired', 'verified', testResult) ?? 'wired';
  } else if (roll.pending > 0) state = 'scaffolded';
  else state = 'generated';

  return {
    lifecycle: state,
    ...(testResult ? { testResult } : {}),
    evidence: { ...base, summary: evidenceSentence(state, base) },
  };
}
