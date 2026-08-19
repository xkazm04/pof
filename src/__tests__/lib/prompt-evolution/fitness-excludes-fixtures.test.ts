/**
 * The prompt-fitness join must not count TEST FIXTURES as prompt output.
 *
 * `getPromptVersionFitness` is the surface that answers "are my prompts getting better?", and
 * it read `listAllArtifacts()` raw. Test harnesses POST synthetic entities into the same table
 * as real content, so those rows carried a `promptVersion` stamp and were counted as
 * production — asymmetrically, because the harness only ever exercised the older pack.
 * Measured on the operator's live DB, 2026-08-19:
 *
 *   q1  producedArtifacts 780, of which 342 synthetic (43.8%)
 *   q2  producedArtifacts   7, of which   0 synthetic
 *
 * `isSyntheticEntity` was already honoured by /status, capabilityModel, the drain and the
 * evidence audit — this join was the one reader that skipped it.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fitness-fixtures-${process.pid}.db`;
});

import { getPromptVersionFitness, getPromptVariantFitness, computeVersionFitness } from '@/lib/prompt-evolution/judge-fitness';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const CAT = 'fitness-fixture-test';
const VERSION = 'ftest1';
const VARIANT = 'ftest-variant';

function seedArtifact(entityId: string, step: string) {
  upsertArtifact({
    catalogId: CAT,
    entityId,
    step,
    data: { _provenance: { engine: 'llm', promptVersion: VERSION, promptVariantId: VARIANT } },
    ueAssets: [],
    status: 'pass',
    tier: 'L0',
  });
}

function seedVerdict(entityId: string, step: string, score: number) {
  upsertVerdict({
    catalogId: CAT, entityId, step, judge: 'llm-panel', verdict: 'pass', score,
    findings: 'seeded', model: 'test', rubricVersion: RUBRIC_VERSION,
  });
}

describe('prompt fitness excludes synthetic fixture entities', () => {
  it('counts only real entities in producedArtifacts / judgedArtifacts / verdicts', () => {
    // Two real entities and three fixtures — the live shape, where fixtures outnumber content.
    seedArtifact('real-a', 'Step One');
    seedArtifact('real-b', 'Step One');
    seedArtifact('test-headless-mcp', 'Step One');
    seedArtifact('test-headless-bridge-x', 'Step One');
    seedArtifact('item-mcp-smoke', 'Step One');

    seedVerdict('real-a', 'Step One', 90);
    seedVerdict('test-headless-mcp', 'Step One', 10);

    const row = getPromptVersionFitness().find((f) => f.promptVersion === VERSION);
    expect(row).toBeDefined();
    // 5 artifacts exist under this version; only 2 belong to the project.
    expect(row!.producedArtifacts).toBe(2);
    expect(row!.judgedArtifacts).toBe(1);
    expect(row!.verdicts).toBe(1);
    // The fixture verdict scored 10 — if it were counted the average would be 50, not 90.
    expect(row!.avgScore).toBe(90);

    const variant = getPromptVariantFitness().find((f) => f.variantId === VARIANT);
    expect(variant?.producedArtifacts).toBe(2);
    expect(variant?.verdicts).toBe(1);
  });

  it('applies the same exclusion to the PURE aggregation, not only the DB entry point', () => {
    const art = (entityId: string): PipelineArtifact => ({
      catalogId: 'c', entityId, step: 'S', status: 'pass',
      data: { _provenance: { engine: 'llm', promptVersion: 'pure1' } }, ueAssets: [],
    });
    const verdict = (entityId: string, score: number): JudgeVerdict => ({
      catalogId: 'c', entityId, step: 'S', judge: 'llm-panel', verdict: 'pass', score,
      findings: '', model: 'test', rubricVersion: RUBRIC_VERSION,
    });

    const out = computeVersionFitness(
      [art('hero-1'), art('test-headless-mcp'), art('item-mcp-smoke')],
      [verdict('hero-1', 80), verdict('test-headless-mcp', 0)],
    );
    const row = out.find((f) => f.promptVersion === 'pure1')!;
    expect(row.producedArtifacts).toBe(1);
    expect(row.verdicts).toBe(1);
    expect(row.avgScore).toBe(80);
  });
});
