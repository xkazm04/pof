import { describe, it, expect } from 'vitest';
import { stampPromptVersion, computeVariantFitness, computeVersionFitness } from '@/lib/prompt-evolution/judge-fitness';
import { readProvenance } from '@/lib/provenance';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * The judged-path join: a served variant's id is stamped into the artifact's provenance
 * at POST, so the judge fleet's verdicts on that artifact can be aggregated PER VARIANT —
 * an objective score for an A/B arm, not the run's own self-report.
 */

function artifact(step: string, provenance: Record<string, unknown>): PipelineArtifact {
  return {
    catalogId: 'items',
    entityId: 'itm-rusty-sword',
    step,
    data: { _provenance: provenance },
    ueAssets: [],
    status: 'pass',
  } as unknown as PipelineArtifact;
}

function verdict(step: string, score: number, pass: boolean): JudgeVerdict {
  return {
    catalogId: 'items',
    entityId: 'itm-rusty-sword',
    step,
    score,
    verdict: pass ? 'pass' : 'fail',
  } as unknown as JudgeVerdict;
}

describe('stampPromptVersion — variant stamping', () => {
  it('records the served variant beside the pack version', () => {
    const stamped = stampPromptVersion({ foo: 1 }, 'q1', 'var-abc');
    expect(readProvenance(stamped)).toMatchObject({ promptVersion: 'q1', promptVariantId: 'var-abc' });
    // Never disturbs the payload it stamps.
    expect(stamped.foo).toBe(1);
  });

  it('does NOT stamp the static sentinel — a static run is no experiment', () => {
    const stamped = stampPromptVersion({}, 'q1', 'static');
    expect(readProvenance(stamped)?.promptVariantId).toBeUndefined();
  });

  it('keeps a variant id the producer already wrote into _provenance', () => {
    const stamped = stampPromptVersion({ _provenance: { engine: 'Claude', promptVariantId: 'var-from-producer' } }, 'q1');
    expect(readProvenance(stamped)).toMatchObject({ engine: 'Claude', promptVariantId: 'var-from-producer' });
  });
});

describe('computeVariantFitness', () => {
  it('aggregates judge scores per served variant', () => {
    const artifacts = [
      artifact('Definition', { engine: 'Claude', promptVersion: 'q1', promptVariantId: 'var-a' }),
      artifact('Economy', { engine: 'Claude', promptVersion: 'q1', promptVariantId: 'var-b' }),
      artifact('Art', { engine: 'Claude', promptVersion: 'q1', promptVariantId: 'var-b' }),
    ];
    const verdicts = [
      verdict('Definition', 60, false),
      verdict('Economy', 90, true),
      verdict('Art', 80, true),
    ];

    const fitness = computeVariantFitness(artifacts, verdicts);
    expect(fitness.map((f) => f.variantId)).toEqual(['var-a', 'var-b']);

    const a = fitness.find((f) => f.variantId === 'var-a')!;
    expect(a).toMatchObject({ producedArtifacts: 1, judgedArtifacts: 1, verdicts: 1, avgScore: 60, passRate: 0 });

    const b = fitness.find((f) => f.variantId === 'var-b')!;
    expect(b).toMatchObject({ producedArtifacts: 2, judgedArtifacts: 2, verdicts: 2, avgScore: 85, passRate: 1 });
  });

  it('reports an unjudged variant as unknown (null), never zero', () => {
    const fitness = computeVariantFitness(
      [artifact('Definition', { engine: 'Claude', promptVariantId: 'var-new' })],
      [],
    );
    expect(fitness[0]).toMatchObject({ producedArtifacts: 1, judgedArtifacts: 0, verdicts: 0 });
    expect(fitness[0].avgScore).toBeNull();
    expect(fitness[0].passRate).toBeNull();
  });

  it('excludes artifacts produced by the static prompt (they belong to no experiment)', () => {
    const fitness = computeVariantFitness(
      [artifact('Definition', { engine: 'Claude', promptVersion: 'q1' })],
      [verdict('Definition', 70, true)],
    );
    expect(fitness).toEqual([]);
  });

  it('leaves the per-VERSION fitness aggregation unchanged', () => {
    const artifacts = [
      artifact('Definition', { engine: 'Claude', promptVersion: 'q1', promptVariantId: 'var-a' }),
      artifact('Economy', { engine: 'Claude', promptVersion: 'q1' }),
    ];
    const byVersion = computeVersionFitness(artifacts, [verdict('Definition', 60, false)]);
    expect(byVersion).toHaveLength(1);
    expect(byVersion[0]).toMatchObject({ promptVersion: 'q1', producedArtifacts: 2, verdicts: 1, avgScore: 60 });
  });
});
