import { describe, it, expect } from 'vitest';
import { summarizeEntity } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const a = (step: string, status: PipelineArtifact['status'], tier?: PipelineArtifact['tier']): PipelineArtifact =>
  ({ catalogId: 'items', entityId: 'i', step, data: {}, ueAssets: [], status, tier });

describe('summarizeEntity', () => {
  it('counts pass/deferred/pending and the highest tier reached', () => {
    const r = summarizeEntity([a('A', 'pass', 'L0'), a('B', 'pass', 'L2'), a('C', 'deferred', 'L3')], 4);
    expect(r).toMatchObject({ total: 4, done: 2, deferred: 1, pending: 1, highestTier: 'L2' });
  });
  it('configComplete is true when every authored step is pass-at-L2-or-below or deferred-above', () => {
    expect(summarizeEntity([a('A', 'pass', 'L0'), a('B', 'deferred', 'L3')], 2).configComplete).toBe(true);
    expect(summarizeEntity([a('A', 'pending', 'L0')], 1).configComplete).toBe(false);
  });
});
