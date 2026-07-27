import { describe, it, expect } from 'vitest';
import { computeVersionFitness, stampPromptVersion } from '@/lib/prompt-evolution/judge-fitness';
import { readProvenance } from '@/lib/provenance';
import { PROMPT_VERSION } from '@/lib/prompts/quality';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

function artifact(
  step: string,
  promptVersion: string | null,
  over: Partial<PipelineArtifact> = {},
): PipelineArtifact {
  return {
    catalogId: 'items',
    entityId: 'itm-1',
    step,
    data: promptVersion ? { _provenance: { engine: 'Claude', promptVersion } } : {},
    ueAssets: [],
    status: 'pass',
    ...over,
  } as PipelineArtifact;
}

function verdict(step: string, score: number, v: 'pass' | 'fail' = 'pass', over: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId: 'items',
    entityId: 'itm-1',
    step,
    judge: 'llm-panel',
    verdict: v,
    score,
    findings: 'detailed findings that make this verdict auditable',
    model: 'sonnet-fleet-w1',
    ...over,
  };
}

describe('stampPromptVersion', () => {
  it('stamps the current pack version and leaves the rest of the payload alone', () => {
    const data = { name: 'Rusty Sword', damage: 5 };
    const out = stampPromptVersion(data);
    expect(out.name).toBe('Rusty Sword');
    expect(out.damage).toBe(5);
    expect(readProvenance(out)?.promptVersion).toBe(PROMPT_VERSION);
    // Input is never mutated — the grader sees the original payload.
    expect(data).not.toHaveProperty('_provenance');
  });

  it('an explicit version wins over the current pack version', () => {
    expect(readProvenance(stampPromptVersion({}, 'q0'))?.promptVersion).toBe('q0');
  });

  it('preserves an existing provenance stamp the producer already wrote', () => {
    const out = stampPromptVersion({ _provenance: { engine: 'Tripo', model: 'v3.1' } });
    const p = readProvenance(out);
    expect(p?.engine).toBe('Tripo');
    expect(p?.model).toBe('v3.1');
    expect(p?.promptVersion).toBe(PROMPT_VERSION);
  });

  it('does not overwrite a promptVersion already on the artifact', () => {
    const out = stampPromptVersion({ _provenance: { engine: 'Claude', promptVersion: 'q0' } });
    expect(readProvenance(out)?.promptVersion).toBe('q0');
  });
});

describe('computeVersionFitness — verdict ⋈ artifact ⋈ promptVersion', () => {
  it('averages judge scores per prompt version', () => {
    const artifacts = [
      artifact('Concept Brief', 'q1'),
      artifact('Attributes', 'q1'),
      artifact('Icon 2D Art', 'q2'),
    ];
    const verdicts = [
      verdict('Concept Brief', 80),
      verdict('Attributes', 90),
      verdict('Icon 2D Art', 60, 'fail'),
    ];

    const fitness = computeVersionFitness(artifacts, verdicts);
    const q1 = fitness.find((f) => f.promptVersion === 'q1')!;
    const q2 = fitness.find((f) => f.promptVersion === 'q2')!;

    expect(q1.avgScore).toBe(85);
    expect(q1.passRate).toBe(1);
    expect(q1.judgedArtifacts).toBe(2);
    expect(q1.producedArtifacts).toBe(2);
    expect(q1.verdicts).toBe(2);

    expect(q2.avgScore).toBe(60);
    expect(q2.passRate).toBe(0);
  });

  it('reports an unjudged version as null — never zero', () => {
    const fitness = computeVersionFitness([artifact('Concept Brief', 'q9')], []);
    expect(fitness).toHaveLength(1);
    expect(fitness[0].promptVersion).toBe('q9');
    expect(fitness[0].producedArtifacts).toBe(1);
    expect(fitness[0].judgedArtifacts).toBe(0);
    expect(fitness[0].avgScore).toBeNull();
    expect(fitness[0].passRate).toBeNull();
    // The distinction that matters: a genuine 0 score is NOT null.
    const scored = computeVersionFitness([artifact('Concept Brief', 'q9')], [verdict('Concept Brief', 0, 'fail')]);
    expect(scored[0].avgScore).toBe(0);
  });

  it('ignores artifacts with no promptVersion stamp rather than guessing one', () => {
    const fitness = computeVersionFitness(
      [artifact('Concept Brief', null), artifact('Attributes', 'q1')],
      [verdict('Concept Brief', 10), verdict('Attributes', 90)],
    );
    expect(fitness).toHaveLength(1);
    expect(fitness[0].promptVersion).toBe('q1');
    // The unstamped artifact's score must not pollute q1's average.
    expect(fitness[0].avgScore).toBe(90);
  });

  it('ignores a verdict whose artifact does not exist', () => {
    const fitness = computeVersionFitness([artifact('Attributes', 'q1')], [verdict('Ghost Step', 5)]);
    expect(fitness[0].avgScore).toBeNull();
  });

  it('joins on all three key parts — same step, different entity, is a different artifact', () => {
    const artifacts = [
      artifact('Concept Brief', 'q1'),
      artifact('Concept Brief', 'q2', { entityId: 'itm-2' }),
    ];
    const verdicts = [
      verdict('Concept Brief', 100),
      verdict('Concept Brief', 20, 'fail', { entityId: 'itm-2' }),
    ];
    const fitness = computeVersionFitness(artifacts, verdicts);
    expect(fitness.find((f) => f.promptVersion === 'q1')!.avgScore).toBe(100);
    expect(fitness.find((f) => f.promptVersion === 'q2')!.avgScore).toBe(20);
  });

  it('counts several judges on one artifact as several verdicts but one judged artifact', () => {
    const fitness = computeVersionFitness(
      [artifact('Icon 2D Art', 'q1')],
      [verdict('Icon 2D Art', 80), verdict('Icon 2D Art', 60, 'pass', { judge: 'vlm' })],
    );
    expect(fitness[0].verdicts).toBe(2);
    expect(fitness[0].judgedArtifacts).toBe(1);
    expect(fitness[0].avgScore).toBe(70);
  });

  it('flags the version production currently runs under', () => {
    const fitness = computeVersionFitness(
      [artifact('Concept Brief', PROMPT_VERSION), artifact('Attributes', 'q-old')],
      [],
    );
    expect(fitness.find((f) => f.promptVersion === PROMPT_VERSION)!.isCurrent).toBe(true);
    expect(fitness.find((f) => f.promptVersion === 'q-old')!.isCurrent).toBe(false);
  });

  it('returns nothing when no artifact carries a stamp', () => {
    expect(computeVersionFitness([artifact('Concept Brief', null)], [verdict('Concept Brief', 90)])).toEqual([]);
  });
});
