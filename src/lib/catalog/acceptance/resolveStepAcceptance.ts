import type { AcceptanceResult } from './types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { bridgeJudgeVerdict, judgedContentOf, type JudgedContent } from './judgeBridge';
import { getStepFact } from '@/lib/status/statusModel';

/** The persisted (server-side) verdict for a step — the shape both the artifact cache and
 *  the hydrated `LabStepArtifact` expose. */
export interface PersistedVerdict {
  status?: string;
  tier?: string;
  reason?: string;
}

/**
 * Overlay the SERVER's verdict on a locally-recomputed one.
 *
 * The only case where the server knows more than the local checker is an L3/L4 gate: a pure
 * Checker can only ever say `deferred` for an unrun runtime/visual gate, while the drain
 * runner has actually run it. So a concrete server `pass`/`fail` wins over a local
 * `deferred` (carrying the server's tier + reason); anything else leaves the local verdict
 * untouched — the server never silently overrides a checker that could decide for itself.
 */
export function serverVerdictOverlay(local: AcceptanceResult, persisted?: PersistedVerdict): AcceptanceResult {
  if (local.status !== 'deferred') return local;
  const s = persisted?.status;
  if (s !== 'pass' && s !== 'fail') return local;
  // Drop the local (deferred) reason — the server's outcome supersedes it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured to OMIT the key
  const { reason: _localReason, ...rest } = local;
  return {
    ...rest,
    status: s,
    ...(persisted?.tier ? { tier: persisted.tier as AcceptanceResult['tier'] } : {}),
    ...(persisted?.reason ? { reason: persisted.reason } : {}),
  };
}

/**
 * THE one acceptance truth for a single step — the whole app's only merge of the three
 * verdict sources, in the one order that is correct:
 *
 *   1. the step's own **Checker** (`local`, already computed by the caller against its
 *      `CheckerContext` — the caller owns the context because the lab and the server build
 *      it from different stores);
 *   2. the **server drain overlay** ({@link serverVerdictOverlay}) — a real L3/L4 gate
 *      outcome supersedes a local `deferred`;
 *   3. the **judge bridge** ({@link bridgeJudgeVerdict}) — a current-rubric, matching-class
 *      judge FAIL that is BOUND to the content on record condemns a shape-pass; a verdict
 *      about content the step no longer holds is reported as `stale`, never applied.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * Before this function TWO derivations both claimed to be the one truth: the step banner
 * (`useStepAcceptance`) applied all three layers, while the rail / matrix / step-coach /
 * global-coach / entity rollup (`deriveEntityArtifacts`) applied only 1–2 — so a
 * judge-failed step showed a GREEN rail dot next to its own RED banner, and `/status`
 * (which bridges, via `headless.ts`) sided with the banner against the rail. Every one of
 * those consumers now funnels through here, so they cannot disagree by construction.
 *
 * Pure and side-effect free: the caller supplies the verdicts it read (the lab from
 * `/api/judge-verdicts`, the server from `listVerdicts`). Nothing here re-grades anything.
 */
export function resolveStepAcceptance({ catalogId, step, local, persisted, verdicts, judgeClass, content, data, updatedAt }: {
  /** Catalog the step belongs to — used only to resolve the step's audited judge class. */
  catalogId?: string;
  step: string;
  /** The Checker's own verdict for this step's data. */
  local: AcceptanceResult;
  /** The server-stored verdict for the same step, when one exists. */
  persisted?: PersistedVerdict;
  /** Judge verdicts already scoped to THIS (catalog, entity, step). Empty → no overlay. */
  verdicts?: JudgeVerdict[];
  /** Explicit judge class override; defaults to the audited `StepFact.judge`. */
  judgeClass?: string;
  /**
   * The content the step holds now, so each verdict's binding can be checked. Supply either
   * the raw `data` (+ write time) or a prebuilt {@link JudgedContent}. Omitted → no verdict
   * can be confirmed OR refuted, so every verdict degrades to `unknown` provenance
   * (labelled, still applied) — honest, never silently "current".
   */
  content?: JudgedContent;
  data?: Record<string, unknown>;
  updatedAt?: string;
}): AcceptanceResult {
  const overlaid = serverVerdictOverlay(local, persisted);
  if (!verdicts?.length) return overlaid;
  const cls = judgeClass ?? (catalogId ? getStepFact(catalogId, step)?.judge : undefined);
  const bound = content ?? (data ? judgedContentOf(data, updatedAt) : undefined);
  return bridgeJudgeVerdict(overlaid, verdicts, cls, bound);
}

/** Scope a catalog-wide verdict list to one (entity, step). Shared by every consumer so the
 *  filter can't drift between the banner and the rail. */
export function verdictsForStep(verdicts: JudgeVerdict[] | undefined, entityId: string, step: string): JudgeVerdict[] {
  if (!verdicts?.length) return [];
  return verdicts.filter((v) => v.entityId === entityId && v.step === step);
}
