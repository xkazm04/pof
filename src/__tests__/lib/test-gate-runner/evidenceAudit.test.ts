import { describe, it, expect } from 'vitest';
import { buildEvidenceAudit, readEvidence } from '@/lib/test-gate-runner/evidenceAudit';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

function art(a: Partial<PipelineArtifact> & { entityId: string; step: string }): PipelineArtifact {
  return {
    catalogId: 'items', data: {}, ueAssets: [], status: 'pass', tier: 'L3', ...a,
  } as PipelineArtifact;
}

const scenarioEvidence = {
  kind: 'scenario', at: '2026-07-01T00:00:00.000Z',
  stats: { distance: 412, sampleCount: 8 },
  samples: [{ droopL: 1, droopR: 1, loc_x: 0, loc_y: 0 }],
};

describe('readEvidence', () => {
  it('reads a well-formed persisted evidence object', () => {
    expect(readEvidence({ data: { evidence: scenarioEvidence } })?.kind).toBe('scenario');
  });

  it('reads null for absent / malformed / unknown-kind evidence (never a half-parsed proof)', () => {
    expect(readEvidence({ data: {} })).toBeNull();
    expect(readEvidence({ data: { evidence: 'yes' } })).toBeNull();
    expect(readEvidence({ data: { evidence: [1, 2] } })).toBeNull();
    expect(readEvidence({ data: { evidence: { kind: 'vibes', at: 'x' } } })).toBeNull();
    expect(readEvidence({ data: { evidence: { kind: 'scenario' } } })).toBeNull(); // no timestamp
  });
});

describe('buildEvidenceAudit', () => {
  it('projects gate rows into proof rows + a summary, and reports un-auditable verdicts', () => {
    const audit = buildEvidenceAudit([
      art({ entityId: 'item-1', step: 'Test Gate', data: { evidence: scenarioEvidence }, reason: 'ok' }),
      art({ entityId: 'item-2', step: 'Test Gate', status: 'pass' }), // flipped with NO proof
      art({ entityId: 'item-3', step: 'Concept Brief', tier: 'L0', data: { evidence: scenarioEvidence } }), // not a gate
    ]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ entityId: 'item-1', step: 'Test Gate', status: 'pass', tier: 'L3' });
    expect(audit.rows[0].summary).toContain('[scenario]');
    expect(audit.rows[0].summary).toContain('distance=412');
    expect(audit.missing).toEqual([{ catalogId: 'items', entityId: 'item-2', step: 'Test Gate', status: 'pass', tier: 'L3' }]);
  });

  it('filters by entity / step / tier', () => {
    const rows = [
      art({ entityId: 'a', step: 'Test Gate', data: { evidence: scenarioEvidence } }),
      art({ entityId: 'b', step: 'Visual Gate', tier: 'L4', data: { evidence: { ...scenarioEvidence, kind: 'visual' } } }),
    ];
    expect(buildEvidenceAudit(rows, { entityId: 'a' }).rows.map((r) => r.entityId)).toEqual(['a']);
    expect(buildEvidenceAudit(rows, { tier: 'L4' }).rows.map((r) => r.entityId)).toEqual(['b']);
    expect(buildEvidenceAudit(rows, { step: 'Visual Gate' }).rows.map((r) => r.entityId)).toEqual(['b']);
  });

  it('excludes synthetic fixture entities unless explicitly asked', () => {
    const rows = [art({ entityId: 'test-headless-mcp', step: 'Test Gate', data: { evidence: scenarioEvidence } })];
    expect(buildEvidenceAudit(rows).rows).toEqual([]);
    expect(buildEvidenceAudit(rows).missing).toEqual([]);
    expect(buildEvidenceAudit(rows, { includeSynthetic: true }).rows).toHaveLength(1);
  });
});
