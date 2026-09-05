import { describe, it, expect, vi } from 'vitest';
import type { FeatureRow } from '@/types/feature-matrix';
import type { PlaytestFinding } from '@/types/game-director';
import type { SubModuleId } from '@/types/modules';
import {
  routeFindingsToMatrix,
  derivePrioritySystems,
  weakestRow,
  sessionStamp,
  type MatrixRoutingDeps,
  type MatrixUpsertRow,
} from '@/lib/game-director/matrix-routing';

function row(partial: Partial<FeatureRow> & { featureName: string; moduleId: SubModuleId }): FeatureRow {
  return {
    id: 1,
    category: 'core',
    status: 'partial',
    description: 'd',
    filePaths: [],
    reviewNotes: 'r',
    qualityScore: 60,
    nextSteps: '',
    lastReviewedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function finding(partial: Partial<PlaytestFinding>): PlaytestFinding {
  return {
    id: 'f1',
    sessionId: 's1',
    category: 'gameplay-feel',
    severity: 'high',
    title: 'Dodge cancels too late',
    description: 'observed',
    relatedModule: null,
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: null,
    confidenceBasis: null,
    createdAt: '2026-09-05T10:00:00.000Z',
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
    ...partial,
  };
}

function fakeDeps(rows: Partial<Record<SubModuleId, FeatureRow[]>>) {
  const writes: { moduleId: SubModuleId; projectId: string; rows: MatrixUpsertRow[] }[] = [];
  const deps: MatrixRoutingDeps = {
    readModule: vi.fn(async (moduleId: SubModuleId) => rows[moduleId] ?? []),
    writeModule: vi.fn(async (moduleId, projectId, upserts) => {
      writes.push({ moduleId, projectId, rows: upserts });
    }),
  };
  return { deps, writes };
}

const BASE = {
  sessionId: 'gd-123',
  sessionName: 'Nightly run',
  projectId: 'C:/proj',
};

describe('routeFindingsToMatrix — routing a finding into work somebody owns', () => {
  it('appends a nextSteps line on the mapped module and leaves other modules alone', async () => {
    const { deps, writes } = fakeDeps({
      'arpg-combat': [
        row({ moduleId: 'arpg-combat', featureName: 'Dodge', qualityScore: 40 }),
        row({ moduleId: 'arpg-combat', featureName: 'Parry', qualityScore: 90 }),
      ],
      'audio': [row({ moduleId: 'audio', featureName: 'Footsteps' })],
    });

    const result = await routeFindingsToMatrix(
      { ...BASE, source: 'external', findings: [finding({ category: 'gameplay-feel' })] },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toEqual([
      { moduleId: 'arpg-combat', featureName: 'Dodge', findings: 1 },
    ]);
    // A module with no finding is never read and never written.
    expect(deps.readModule).toHaveBeenCalledTimes(1);
    expect(writes.map((w) => w.moduleId)).toEqual(['arpg-combat']);
    expect(writes[0].projectId).toBe('C:/proj');
    expect(writes[0].rows[0].nextSteps).toContain(sessionStamp('gd-123'));
    expect(writes[0].rows[0].nextSteps).toContain('Dodge cancels too late');
  });

  it('never overwrites an operator\'s own text', async () => {
    const { deps, writes } = fakeDeps({
      'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge', nextSteps: 'Ask design about the i-frames.' })],
    });
    await routeFindingsToMatrix({ ...BASE, source: 'external', findings: [finding({})] }, deps);
    expect(writes[0].rows[0].nextSteps.startsWith('Ask design about the i-frames.')).toBe(true);
    expect(writes[0].rows[0].nextSteps.split('\n')).toHaveLength(2);
  });

  it('is idempotent for a re-complete — no duplicate line', async () => {
    const existing = `${sessionStamp('gd-123')} 1 finding(s) routed here…`;
    const { deps, writes } = fakeDeps({
      'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge', nextSteps: existing })],
    });
    const result = await routeFindingsToMatrix({ ...BASE, source: 'external', findings: [finding({})] }, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(writes).toHaveLength(0);
    expect(result.data.updated).toHaveLength(0);
    expect(result.data.alreadyPresent).toHaveLength(1);
  });

  it('tags a simulated session\'s line as simulated — a canned finding is not an observed gap', async () => {
    const { deps, writes } = fakeDeps({
      'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge' })],
    });
    await routeFindingsToMatrix({ ...BASE, source: 'simulated', findings: [finding({})] }, deps);
    const line = writes[0].rows[0].nextSteps;
    expect(line).toContain('SIMULATED');
    expect(line).toContain('no build was launched');
    expect(line).not.toContain('measured external playtest');
  });

  it('marks a measured session\'s line as measured', async () => {
    const { deps, writes } = fakeDeps({
      'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge' })],
    });
    await routeFindingsToMatrix({ ...BASE, source: 'external', findings: [finding({})] }, deps);
    expect(writes[0].rows[0].nextSteps).toContain('measured external playtest');
    expect(writes[0].rows[0].nextSteps).not.toContain('SIMULATED');
  });

  it('refuses an unscoped write-back rather than landing on the legacy rows', async () => {
    const { deps, writes } = fakeDeps({ 'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge' })] });
    const result = await routeFindingsToMatrix(
      { ...BASE, projectId: '  ', source: 'external', findings: [finding({})] },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no project scope/i);
    expect(writes).toHaveLength(0);
  });

  it('names a module with no row under this project instead of inventing one', async () => {
    const { deps, writes } = fakeDeps({});
    const result = await routeFindingsToMatrix({ ...BASE, source: 'external', findings: [finding({})] }, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(writes).toHaveLength(0);
    expect(result.data.unrouted[0].reason).toContain('holds no feature-matrix row');
  });

  it('discloses what it did in one sentence', async () => {
    const { deps } = fakeDeps({ 'arpg-combat': [row({ moduleId: 'arpg-combat', featureName: 'Dodge' })] });
    const result = await routeFindingsToMatrix({ ...BASE, source: 'external', findings: [finding({})] }, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.disclosure).toContain('1 matrix row updated');
  });
});

describe('weakestRow', () => {
  it('prefers a missing row, then the lowest score, and never treats unscored as lowest', () => {
    const rows = [
      row({ moduleId: 'arpg-combat', featureName: 'A', qualityScore: null }),
      row({ moduleId: 'arpg-combat', featureName: 'B', qualityScore: 30 }),
      row({ moduleId: 'arpg-combat', featureName: 'C', status: 'missing', qualityScore: 80 }),
    ];
    expect(weakestRow(rows)?.featureName).toBe('C');
    expect(weakestRow(rows.slice(0, 2))?.featureName).toBe('B');
    expect(weakestRow([])).toBeNull();
  });
});

describe('derivePrioritySystems — priorities read off the matrix, not from memory', () => {
  it('ranks by missing count then by quality, and states the reason', () => {
    const suggestions = derivePrioritySystems([
      { moduleId: 'arpg-combat', total: 10, missing: 3, avgQuality: 41 },
      { moduleId: 'audio', total: 8, missing: 3, avgQuality: 22 },
      { moduleId: 'materials', total: 5, missing: 0, avgQuality: 55 },
      { moduleId: 'arpg-ui', total: 5, missing: 0, avgQuality: 92 },
    ]);
    expect(suggestions.map((s) => s.moduleId)).toEqual(['audio', 'arpg-combat', 'materials']);
    expect(suggestions[1].reason).toBe('3 missing, avg quality 41');
  });

  it('never offers a module with no rows — unreviewed is not weak', () => {
    const suggestions = derivePrioritySystems([
      { moduleId: 'arpg-save', total: 0, missing: 0, avgQuality: null },
    ]);
    expect(suggestions).toHaveLength(0);
  });
});
