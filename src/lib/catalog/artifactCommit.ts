/**
 * The ONE door that persists NEW artifact content.
 *
 * Three writers used to re-implement "grade, derive status/tier/reason, persist" — the lab
 * produce POST, the headless/MCP submit (`submitStepArtifact`) and the revision restore — and
 * each carried a different subset of four rules: UNGRADED stamping, engine-claim sanitising +
 * prompt-version stamping, D18 profile scope, derived-lifecycle sync. They now all call
 * {@link commitArtifact}, and the only thing that differs between them is the {@link WritePolicy}
 * naming WHO is writing (which decides only the `_provenance` stamp — never the verdict).
 *
 * Out of scope on purpose: the re-grade passes (bind-icons, drain, static/packaging verify)
 * re-persist EXISTING content with a new verdict; they are not new-content writers.
 *
 * The grader and lifecycle sync are INJECTED (`CommitDeps`, wired by
 * `artifactCommitDeps` in `headless.ts`) so this module never imports `headless.ts`, which
 * itself delegates `submitStepArtifact` here.
 */
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { canonProfileOf } from '@/lib/catalog/canon/profiles';
import { seededEntities } from '@/lib/catalog/seed';
import { stepAppliesTo } from '@/lib/catalog/stepScope';
import { getArtifact, upsertArtifact, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { describeUngraded, UNGRADED_MARKER } from '@/lib/catalog/acceptance/stepGradability';
import { stampPromptVersion } from '@/lib/prompt-evolution/judge-fitness';
import { PROMPT_VERSION } from '@/lib/prompts/quality';
import { stepContentHash } from '@/lib/judge/contentHash';
import { readProvenance, resolvePersistedEngine, withProvenance, type Provenance } from '@/lib/provenance';
import { logger } from '@/lib/logger';
import { ok, err, type Result } from '@/types/result';
import type { AcceptanceResult, AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';

/**
 * Who is writing — decides the `_provenance` stamp and nothing else.
 *
 * - `lab-post`   — the browser write-through: an engine claim goes through the client allow-list
 *                  (or survives when the server already recorded it on that row); the prompt
 *                  version defaults to the pack in effect now. (Unchanged from wave 26.)
 * - `mcp-submit` — `pof_submit_artifact`: claims are sanitised the same way, and the recipe the
 *                  caller produced from was built now, so the current `PROMPT_VERSION` is stamped.
 * - `in-process` — trusted server code (scripts/diablo producers): it may `attest` the engine it
 *                  dispatched; otherwise the stated absence `unknown` and NEVER a prompt version
 *                  (an ingest is not attributable to a prompt pack).
 * - `restore`    — the archived row's own server-recorded stamp is kept verbatim.
 *
 * For `mcp-submit` and an un-attested `in-process` write, a re-submit whose CONTENT is unchanged
 * (`stepContentHash`, non-content keys excluded) keeps the row's stored stamp — absent stays
 * absent. scripts/diablo/regrade.ts re-submits stored data unchanged, and `contentChanged`
 * compares the whole `data` object: re-stamping there would archive a revision per regrade and
 * overwrite a real stamp with `unknown`.
 */
export type WritePolicy =
  | { kind: 'lab-post'; declaredEngine?: unknown; promptVersion?: string; promptVariantId?: string }
  | { kind: 'mcp-submit' }
  | { kind: 'in-process'; attest?: Provenance }
  | { kind: 'restore' };

/** The status the WRITER reported — stands only where no server checker can grade the step. */
export interface ProducerVerdict {
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
}

export interface CommitInput {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
  producer?: ProducerVerdict;
}

export interface CommitDeps {
  grade(catalogId: string, step: string, data: Record<string, unknown>, entityId?: string): { graded: boolean; raw: AcceptanceResult | null };
  hasRegisteredChecker(catalogId: string, step: string): boolean;
  /** Best-effort write of the re-derivable lifecycle cache. */
  syncLifecycle(catalogId: string, entityId: string): void;
}

export interface CommitOutcome {
  artifact: PipelineArtifact;
  /** True when a server checker graded the data (the persisted status is its PURE verdict). */
  graded: boolean;
  raw: AcceptanceResult | null;
}

export interface DerivedVerdict {
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
}

/**
 * The verdict to PERSIST: the pure checker verdict when a server checker graded the data;
 * otherwise the producer's status, with a reason that SAYS nothing verified it (`UNGRADED:`).
 * A producer reason already carrying the marker is kept as-is, so a round trip never nests it.
 * Shared by every writer and by the restore dry run, so "what would persist" cannot drift.
 */
export function deriveVerdict(input: {
  catalogId: string;
  step: string;
  graded: boolean;
  raw: AcceptanceResult | null;
  producer?: ProducerVerdict;
  hasRegisteredChecker: CommitDeps['hasRegisteredChecker'];
}): DerivedVerdict {
  const { catalogId, step, graded, raw, producer } = input;
  if (graded) {
    const reason = raw?.reason ?? (raw ? undefined : 'unverified: acceptance check did not resolve');
    return { status: raw?.status ?? 'pending', tier: raw?.tier ?? 'L0', ...(reason ? { reason } : {}) };
  }
  const reason = producer?.reason?.startsWith(`${UNGRADED_MARKER}:`)
    ? producer.reason
    : describeUngraded(catalogId, step, input.hasRegisteredChecker, producer?.reason);
  return { status: producer?.status ?? 'pending', ...(producer?.tier ? { tier: producer.tier } : {}), reason };
}

/** Replace (never merge) the stamp — a caller's smuggled fields must not ride along. */
function restamp(data: Record<string, unknown>, provenance: Provenance): Record<string, unknown> {
  return { ...data, _provenance: provenance };
}

/** Put the STORED stamp back (or its absence) without moving any other key. */
function keepStoredStamp(data: Record<string, unknown>, stored: Record<string, unknown>): Record<string, unknown> {
  if ('_provenance' in stored) return { ...data, _provenance: stored._provenance };
  if (!('_provenance' in data)) return data;
  const rest = { ...data };
  delete rest._provenance;
  return rest;
}

/** The `data` to persist under a policy, given what the row stored before (if anything). */
export function resolveStamp(
  policy: WritePolicy,
  data: Record<string, unknown>,
  stored?: Record<string, unknown>,
): Record<string, unknown> {
  if (policy.kind === 'restore') return data;
  const claimed = readProvenance(data)?.engine;
  if (policy.kind === 'lab-post') {
    const engine = resolvePersistedEngine({ declared: policy.declaredEngine, claimed, attested: readProvenance(stored)?.engine });
    return stampPromptVersion(withProvenance(data, { engine }), policy.promptVersion, policy.promptVariantId);
  }
  if (policy.kind === 'in-process' && policy.attest) return restamp(data, { ...policy.attest });
  if (stored && stepContentHash(stored) === stepContentHash(data)) return keepStoredStamp(data, stored);
  // No prior record is consulted: a DIFFERENT content never launders a claim through one.
  const engine = resolvePersistedEngine({ claimed });
  return restamp(data, policy.kind === 'mcp-submit' ? { engine, promptVersion: PROMPT_VERSION } : { engine });
}

/**
 * Why a step is not part of this entity's pipeline (D18 — a step scoped to other canon profiles),
 * or null when it is. A row for it would put a step the entity does not have into its lifecycle
 * and /status. Unregistered catalogs/steps have no scope to enforce.
 */
export function stepScopeRefusal(catalogId: string, entityId: string, step: string): string | null {
  const spec = getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step);
  if (!spec) return null;
  const profile = canonProfileOf(seededEntities(catalogId).find((x) => x.id === entityId));
  if (stepAppliesTo(spec, profile)) return null;
  return `Step "${step}" of ${catalogId} applies only to canon profile(s) ${spec.profiles!.join(', ')}; ${entityId} is "${profile ?? 'pof'}"`;
}

/**
 * Grade, stamp, persist and sync one step's NEW content. Refuses (Err, nothing written) a step
 * the entity's canon profile does not have. The persisted status is the pure checker verdict.
 */
export function commitArtifact(input: CommitInput, policy: WritePolicy, deps: CommitDeps): Result<CommitOutcome, string> {
  const { catalogId, entityId, step, data, ueAssets } = input;
  const refusal = stepScopeRefusal(catalogId, entityId, step);
  if (refusal) return err(refusal);

  // Grade the SUBMITTED data, untouched — the stamp is added only to what is persisted.
  const { graded, raw } = deps.grade(catalogId, step, data, entityId);
  const verdict = deriveVerdict({ catalogId, step, graded, raw, producer: input.producer, hasRegisteredChecker: deps.hasRegisteredChecker });
  const stored = getArtifact(catalogId, entityId, step)?.data;
  const artifact = upsertArtifact({ catalogId, entityId, step, data: resolveStamp(policy, data, stored), ueAssets, ...verdict });

  // The lifecycle is DERIVED from the artifacts, so a write is exactly when it can change. The
  // artifact is the primary job and never fails because the re-derivable cache could not be written.
  try {
    deps.syncLifecycle(catalogId, entityId);
  } catch (e) {
    logger.warn('commitArtifact: could not sync derived lifecycle', e);
  }
  return ok({ artifact, graded, raw });
}
