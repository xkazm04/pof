import { describe, it, expect } from 'vitest';
import { diffRuns } from '@/lib/harness/run-diff';
import type { GamePlan, PlannedFeature } from '@/lib/harness/types';
import type { HarnessRunDetail } from '@/lib/harness-runs-db';

function feat(name: string, status: PlannedFeature['status']): PlannedFeature {
  return { id: name, name, status, quality: null, lastSession: null };
}

function plan(areas: Array<{ id: string; label: string; status: GamePlan['areas'][number]['status']; features: PlannedFeature[] }>): GamePlan {
  return {
    game: 'P', projectPath: '', ueVersion: '5.5',
    iteration: 1,
    totalFeatures: areas.reduce((n, a) => n + a.features.length, 0),
    passingFeatures: areas.reduce((n, a) => n + a.features.filter((f) => f.status === 'pass').length, 0),
    createdAt: '', updatedAt: '',
    areas: areas.map((a) => ({
      ...a,
      moduleId: 'arpg-combat' as never,
      description: '', checklistItemIds: [], featureNames: [], dependsOn: [],
    })),
  };
}

function run(overrides: Partial<HarnessRunDetail>): HarnessRunDetail {
  return {
    runId: 'x', projectName: 'p', projectPath: '', status: 'completed',
    startedAt: '2026-05-27T10:00:00.000Z', endedAt: '2026-05-27T10:10:00.000Z',
    durationMs: 10 * 60 * 1000,
    iteration: 1, totalFeatures: 0, passingFeatures: 0, passRate: 0,
    totalAreas: 0, completedAreas: 0, failedAreas: 0,
    spentUsd: 0, budgetUsd: null, sessions: 0,
    themeDirective: null, errorMessage: null,
    plan: null, progress: [], guide: null, cost: null,
    ...overrides,
  };
}

describe('diffRuns', () => {
  it('flags improved + regressed areas correctly', () => {
    const a = run({
      runId: 'a', passRate: 25, passingFeatures: 1, totalFeatures: 4, spentUsd: 0.5, sessions: 2, durationMs: 60_000,
      plan: plan([
        { id: 'core', label: 'Core', status: 'failed', features: [feat('x', 'fail'), feat('y', 'pass')] },
        { id: 'ui', label: 'UI', status: 'completed', features: [feat('a', 'pass'), feat('b', 'pass')] },
      ]),
    });
    const b = run({
      runId: 'b', passRate: 75, passingFeatures: 3, totalFeatures: 4, spentUsd: 1.5, sessions: 5, durationMs: 120_000,
      plan: plan([
        { id: 'core', label: 'Core', status: 'completed', features: [feat('x', 'pass'), feat('y', 'pass')] },
        { id: 'ui', label: 'UI', status: 'failed', features: [feat('a', 'pass'), feat('b', 'fail')] },
      ]),
    });

    const d = diffRuns(a, b);
    expect(d.passRateDelta).toBe(50);
    expect(d.costDeltaUsd).toBeCloseTo(1, 5);
    expect(d.sessionDelta).toBe(3);
    expect(d.durationMsDelta).toBe(60_000);

    const core = d.areas.find((e) => e.areaId === 'core')!;
    expect(core.kind).toBe('improved');
    expect(core.passRateA).toBe(0.5);
    expect(core.passRateB).toBe(1);

    const ui = d.areas.find((e) => e.areaId === 'ui')!;
    expect(ui.kind).toBe('regressed');

    expect(d.improved.map((e) => e.areaId)).toEqual(['core']);
    expect(d.regressed.map((e) => e.areaId)).toEqual(['ui']);
  });

  it('detects added + removed areas', () => {
    const a = run({ runId: 'a', plan: plan([{ id: 'old', label: 'Old', status: 'completed', features: [feat('x', 'pass')] }]) });
    const b = run({ runId: 'b', plan: plan([{ id: 'new', label: 'New', status: 'completed', features: [feat('y', 'pass')] }]) });
    const d = diffRuns(a, b);
    expect(d.added.map((e) => e.areaId)).toEqual(['new']);
    expect(d.removed.map((e) => e.areaId)).toEqual(['old']);
  });

  it('treats matching plans with same statuses as unchanged', () => {
    const p = plan([{ id: 'core', label: 'Core', status: 'completed', features: [feat('x', 'pass')] }]);
    const a = run({ runId: 'a', plan: p, passRate: 100, passingFeatures: 1, totalFeatures: 1 });
    const b = run({ runId: 'b', plan: p, passRate: 100, passingFeatures: 1, totalFeatures: 1 });
    const d = diffRuns(a, b);
    expect(d.improved).toEqual([]);
    expect(d.regressed).toEqual([]);
    expect(d.areas[0].kind).toBe('unchanged');
    expect(d.passRateDelta).toBe(0);
  });

  it('newFailureAreas surfaces areas that newly appear in failure progress', () => {
    const a = run({
      runId: 'a',
      progress: [
        { iteration: 1, timestamp: 't', areaId: 'core', moduleId: 'arpg-combat' as never,
          action: 'execute', outcome: 'success', summary: '', durationMs: 0, featuresChanged: [] },
      ],
    });
    const b = run({
      runId: 'b',
      progress: [
        { iteration: 1, timestamp: 't', areaId: 'core', moduleId: 'arpg-combat' as never,
          action: 'execute', outcome: 'failure', summary: '', durationMs: 0, featuresChanged: [] },
        { iteration: 1, timestamp: 't', areaId: 'ui', moduleId: 'arpg-combat' as never,
          action: 'execute', outcome: 'partial', summary: '', durationMs: 0, featuresChanged: [] },
      ],
    });
    const d = diffRuns(a, b);
    expect(d.newFailureAreas.sort()).toEqual(['core', 'ui']);
  });

  it('durationMsDelta is null when either side lacks duration', () => {
    const a = run({ runId: 'a', durationMs: null });
    const b = run({ runId: 'b', durationMs: 5000 });
    expect(diffRuns(a, b).durationMsDelta).toBeNull();
  });
});
