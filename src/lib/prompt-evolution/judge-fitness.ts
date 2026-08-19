/**
 * Judge verdicts → prompt fitness.
 *
 * The quality pack stamps `PROMPT_VERSION` into every artifact it produces, and the judge
 * fleet scores those artifacts — but until now nothing read the two back together, so a
 * pack revision could never be shown to have helped. This module is that join:
 *
 *   judge_verdicts (catalogId, entityId, step)
 *     → pipeline_artifacts (same key)
 *       → data._provenance.promptVersion
 *
 * and aggregates the verdict scores per prompt version.
 *
 * **Honesty rule.** A version that produced artifacts nobody has judged yet reports
 * `avgScore: null` / `passRate: null` — never `0`. An unjudged prompt is unknown, not bad,
 * and rendering it as a zero-height bar would invent a failure the judges never found.
 *
 * **Fixtures are not output.** Test/smoke harnesses POST into the same tables as real content
 * (`isSyntheticEntity` — `test-headless*`, `item-mcp-smoke`), and those rows carry a prompt
 * version stamp like any other. Counting them made this join, the one surface that answers
 * "are my prompts getting better?", report fixture volume as productivity — and asymmetrically,
 * because the harness only ever exercised one arm: measured on the real DB on 2026-08-19,
 * `q1` reported 780 producedArtifacts of which **342 (43.8%) were synthetic**, while `q2`
 * reported 7 of which 0 were. Excluding them here matches what `/status`, `capabilityModel`,
 * the drain and the evidence audit already do; the exclusion lives in `aggregateFitness` so
 * both the version and the variant join get it, and neither can drift from the other.
 */

import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { PromptVersionFitness, PromptVariantFitness } from '@/types/prompt-evolution';
import { readProvenance, type Provenance } from '@/lib/provenance';
import { PROMPT_VERSION } from '@/lib/prompts/quality';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { listAllArtifacts, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { isSyntheticEntity } from '@/lib/status/statusModel';

/** Key an artifact/verdict pair identically so the two tables can be joined. */
function joinKey(catalogId: string, entityId: string, step: string): string {
  return `${catalogId}\u0000${entityId}\u0000${step}`;
}

/**
 * Merge a `promptVersion` into an artifact payload's `_provenance` without disturbing any
 * other key (including a provenance stamp the producer already wrote). Returns a new object;
 * the input is never mutated. An explicit version wins over the pack version in effect now —
 * a replay/drain can report the version its artifact was really produced under.
 */
export function stampPromptVersion(
  data: Record<string, unknown>,
  promptVersion?: string,
  promptVariantId?: string,
): Record<string, unknown> {
  const existing = readProvenance(data);
  const variantId = promptVariantId ?? existing?.promptVariantId;
  const provenance: Provenance = {
    ...(existing ?? { engine: 'unknown' }),
    promptVersion: promptVersion ?? existing?.promptVersion ?? PROMPT_VERSION,
    // Only stamp a REAL variant: `'static'` (or nothing) means the run used the
    // registry/recipe prompt, and inventing a variant id for it would attribute
    // scores to an experiment that never ran.
    ...(variantId && variantId !== 'static' ? { promptVariantId: variantId } : {}),
  };
  return { ...data, _provenance: provenance };
}

/**
 * Aggregate judge scores per prompt version. Pure — the DB-backed entry point below feeds it.
 *
 * Only artifacts carrying a `_provenance.promptVersion` participate: an unstamped artifact
 * (produced before the stamp existed) belongs to no known version, and guessing one would
 * attribute someone else's score to a pack that never ran.
 */
export function computeVersionFitness(
  artifacts: PipelineArtifact[],
  verdicts: JudgeVerdict[],
): PromptVersionFitness[] {
  return aggregateFitness(artifacts, verdicts, (p) => p.promptVersion)
    .map((f) => ({ ...f, promptVersion: f.bucket, isCurrent: f.bucket === PROMPT_VERSION }))
    .sort((a, b) => a.promptVersion.localeCompare(b.promptVersion));
}

/**
 * Aggregate judge scores per SERVED VARIANT — the join the A/B rail was missing.
 *
 * A variant's own trial counter only knows what the run reported about itself; this
 * reads what the judge fleet independently scored the artifact that run produced. Same
 * honesty rule: a variant whose artifacts nobody judged reports `null`, never `0`.
 * Artifacts produced by the static prompt carry no `promptVariantId` and are excluded —
 * they belong to no experiment.
 */
export function computeVariantFitness(
  artifacts: PipelineArtifact[],
  verdicts: JudgeVerdict[],
): PromptVariantFitness[] {
  return aggregateFitness(artifacts, verdicts, (p) => p.promptVariantId)
    .map((f) => ({ ...f, variantId: f.bucket }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));
}

/**
 * Shared artifact⋈verdict aggregation, bucketed by whichever provenance field is asked for.
 *
 * Synthetic (fixture) entities are dropped on BOTH sides — see the module docstring. The
 * filter is here rather than in the two DB entry points so the pure functions a caller may
 * feed by hand cannot report a different number from the ones the app renders.
 */
function aggregateFitness(
  artifacts: PipelineArtifact[],
  verdicts: JudgeVerdict[],
  bucketOf: (p: Provenance) => string | undefined,
): (Omit<PromptVersionFitness, 'promptVersion' | 'isCurrent'> & { bucket: string })[] {
  const versionByKey = new Map<string, string>();
  const produced = new Map<string, number>();

  for (const a of artifacts) {
    if (isSyntheticEntity(a.entityId)) continue;
    const provenance = readProvenance(a.data);
    const version = provenance ? bucketOf(provenance) : undefined;
    if (!version) continue;
    versionByKey.set(joinKey(a.catalogId, a.entityId, a.step), version);
    produced.set(version, (produced.get(version) ?? 0) + 1);
  }

  const scoreSum = new Map<string, number>();
  const verdictCount = new Map<string, number>();
  const passCount = new Map<string, number>();
  const judgedArtifactKeys = new Map<string, Set<string>>();

  for (const v of verdicts) {
    if (isSyntheticEntity(v.entityId)) continue;
    const key = joinKey(v.catalogId, v.entityId, v.step);
    const version = versionByKey.get(key);
    if (!version) continue; // verdict on an artifact produced by no known prompt version
    scoreSum.set(version, (scoreSum.get(version) ?? 0) + v.score);
    verdictCount.set(version, (verdictCount.get(version) ?? 0) + 1);
    if (v.verdict === 'pass') passCount.set(version, (passCount.get(version) ?? 0) + 1);
    const seen = judgedArtifactKeys.get(version) ?? new Set<string>();
    seen.add(key);
    judgedArtifactKeys.set(version, seen);
  }

  return Array.from(produced.entries()).map(([bucket, producedArtifacts]) => {
    const verdicts = verdictCount.get(bucket) ?? 0;
    const judgedArtifacts = judgedArtifactKeys.get(bucket)?.size ?? 0;
    return {
      bucket,
      producedArtifacts,
      judgedArtifacts,
      verdicts,
      // Unjudged is unknown, not zero.
      avgScore: verdicts > 0 ? (scoreSum.get(bucket) ?? 0) / verdicts : null,
      passRate: verdicts > 0 ? (passCount.get(bucket) ?? 0) / verdicts : null,
    };
  });
}

/** Read both tables and compute the per-version fitness. Server-only. */
export function getPromptVersionFitness(): PromptVersionFitness[] {
  return computeVersionFitness(listAllArtifacts(), listVerdicts());
}

/** Read both tables and compute the per-VARIANT judge fitness. Server-only. */
export function getPromptVariantFitness(): PromptVariantFitness[] {
  return computeVariantFitness(listAllArtifacts(), listVerdicts());
}
