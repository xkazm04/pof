import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import { upsertVerdict, listVerdicts, rowToVerdict, type JudgeVerdict } from '@/lib/status/judge-verdicts-db';

function base(partial: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
    judge: 'llm-panel', verdict: 'pass', score: 92,
    findings: 'Clean silhouette; strong value hierarchy.', model: 'opus',
    ...partial,
  };
}

beforeEach(() => {
  // ensureTable() memoizes creation in a module flag, so DROP would leave it unrecreated.
  // Clear rows instead; the first run has no table yet (upsert creates it).
  try { getDb().exec('DELETE FROM judge_verdicts'); } catch { /* table not created yet */ }
});

describe('judge-verdicts-db — dimensions column (WS2, additive)', () => {
  it('round-trips a verdict WITH per-dimension scores', () => {
    upsertVerdict(base({ dimensions: { silhouette: 95, valueHierarchy: 88, edgeQuality: 90 } }));
    const [v] = listVerdicts('items');
    expect(v.dimensions).toEqual({ silhouette: 95, valueHierarchy: 88, edgeQuality: 90 });
    expect(v.score).toBe(92);
  });

  it('round-trips a verdict WITHOUT dimensions (field absent, not null)', () => {
    upsertVerdict(base({ entityId: 'shield' }));
    const [v] = listVerdicts('items');
    expect(v.dimensions).toBeUndefined();
    // The flat score remains the source of truth regardless.
    expect(v.score).toBe(92);
  });

  it('upsert overwrites dimensions on conflict', () => {
    upsertVerdict(base({ dimensions: { silhouette: 60 } }));
    upsertVerdict(base({ score: 40, verdict: 'fail', dimensions: { silhouette: 30, edgeQuality: 20 } }));
    const [v] = listVerdicts('items');
    expect(v.verdict).toBe('fail');
    expect(v.dimensions).toEqual({ silhouette: 30, edgeQuality: 20 });
  });

  it('a legacy NULL dimensions row parses to undefined (back-compat)', () => {
    // Simulate a row written before the column existed: dimensions stays NULL.
    upsertVerdict(base());
    getDb().prepare('UPDATE judge_verdicts SET dimensions = NULL').run();
    const [v] = listVerdicts('items');
    expect(v.dimensions).toBeUndefined();
  });

  it('rowToVerdict tolerates malformed dimensions JSON without throwing', () => {
    const v = rowToVerdict({
      catalog_id: 'items', entity_id: 'sword', step: 'x', judge: 'llm-panel',
      verdict: 'pass', score: 80, findings: 'f', model: 'opus', dimensions: '{not json',
    });
    expect(v.dimensions).toBeUndefined();
    expect(v.score).toBe(80);
  });

  it('empty dimensions object is treated as absent', () => {
    upsertVerdict(base({ dimensions: {} }));
    const [v] = listVerdicts('items');
    expect(v.dimensions).toBeUndefined();
  });
});
