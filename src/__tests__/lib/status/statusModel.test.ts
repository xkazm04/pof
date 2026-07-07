import { describe, it, expect } from 'vitest';
import { buildSwimlane, deriveCell, sortLanes } from '@/lib/status/statusModel';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const art = (step: string, status: PipelineArtifact['status'], extra: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'c', entityId: 'e1', step, data: {}, ueAssets: [], status, ...extra,
});

describe('deriveCell', () => {
  it('no artifacts → unwired (the bottleneck color)', () => {
    expect(deriveCell('Brief', []).readiness).toBe('unwired');
  });

  it('any pass wins (proven), even alongside pending from other entities', () => {
    const c = deriveCell('Brief', [art('Brief', 'pending'), art('Brief', 'pass', { entityId: 'e2', tier: 'L0' })]);
    expect(c.readiness).toBe('proven');
    expect(c.counts).toEqual({ pass: 1, deferred: 0, fail: 0, pending: 1 });
  });

  it('deferred outranks fail/pending when nothing passes (honest L3/L4 wait)', () => {
    expect(deriveCell('Gate', [art('Gate', 'deferred', { tier: 'L3', reason: 'runner not run' })]).readiness).toBe('deferred');
    expect(deriveCell('Gate', [art('Gate', 'deferred'), art('Gate', 'fail', { entityId: 'e2' })]).readiness).toBe('deferred');
  });

  it('fail without pass/deferred → attention; pending alone → pending', () => {
    expect(deriveCell('X', [art('X', 'fail')]).readiness).toBe('attention');
    expect(deriveCell('X', [art('X', 'pending')]).readiness).toBe('pending');
  });

  it('carries the highest tier and first reason for the tooltip', () => {
    const c = deriveCell('Gate', [art('Gate', 'deferred', { tier: 'L3', reason: 'why' }), art('Gate', 'pass', { tier: 'L0', entityId: 'e2' })]);
    expect(c.tier).toBe('L3');
    expect(c.reason).toBe('why');
  });
});

describe('buildSwimlane', () => {
  it('maps steps in pipeline order and computes proven/wired percentages', () => {
    const lane = buildSwimlane('c', 'Catalog', ['A', 'B', 'C', 'D'], [
      art('A', 'pass'),
      art('B', 'deferred'),
      art('C', 'fail'),
      // D: no artifact → unwired
    ]);
    expect(lane.cells.map((c) => c.readiness)).toEqual(['proven', 'deferred', 'attention', 'unwired']);
    expect(lane.provenPct).toBe(25);
    expect(lane.wiredPct).toBe(75);
  });
});

describe('sortLanes', () => {
  it('most-proven first, alpha tiebreak', () => {
    const a = buildSwimlane('a', 'a', ['S'], [art('S', 'pass')]);
    const b = buildSwimlane('b', 'b', ['S'], []);
    const c = buildSwimlane('c', 'c', ['S'], [art('S', 'pass')]);
    expect(sortLanes([b, c, a]).map((l) => l.catalogId)).toEqual(['a', 'c', 'b']);
  });
});
