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
 */

import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { PromptVersionFitness } from '@/types/prompt-evolution';
import { readProvenance, type Provenance } from '@/lib/provenance';
import { PROMPT_VERSION } from '@/lib/prompts/quality';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { listAllArtifacts, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';

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
): Record<string, unknown> {
  const existing = readProvenance(data);
  const provenance: Provenance = {
    ...(existing ?? { engine: 'unknown' }),
    promptVersion: promptVersion ?? existing?.promptVersion ?? PROMPT_VERSION,
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
  const versionByKey = new Map<string, string>();
  const produced = new Map<string, number>();

  for (const a of artifacts) {
    const version = readProvenance(a.data)?.promptVersion;
    if (!version) continue;
    versionByKey.set(joinKey(a.catalogId, a.entityId, a.step), version);
    produced.set(version, (produced.get(version) ?? 0) + 1);
  }

  const scoreSum = new Map<string, number>();
  const verdictCount = new Map<string, number>();
  const passCount = new Map<string, number>();
  const judgedArtifactKeys = new Map<string, Set<string>>();

  for (const v of verdicts) {
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

  return Array.from(produced.entries())
    .map(([promptVersion, producedArtifacts]) => {
      const verdicts = verdictCount.get(promptVersion) ?? 0;
      const judgedArtifacts = judgedArtifactKeys.get(promptVersion)?.size ?? 0;
      return {
        promptVersion,
        producedArtifacts,
        judgedArtifacts,
        verdicts,
        // Unjudged is unknown, not zero.
        avgScore: verdicts > 0 ? (scoreSum.get(promptVersion) ?? 0) / verdicts : null,
        passRate: verdicts > 0 ? (passCount.get(promptVersion) ?? 0) / verdicts : null,
        isCurrent: promptVersion === PROMPT_VERSION,
      };
    })
    .sort((a, b) => a.promptVersion.localeCompare(b.promptVersion));
}

/** Read both tables and compute the per-version fitness. Server-only. */
export function getPromptVersionFitness(): PromptVersionFitness[] {
  return computeVersionFitness(listAllArtifacts(), listVerdicts());
}
