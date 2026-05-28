import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  startRun,
  finalizeRun,
  listRuns,
  getRun,
  deleteRun,
} from '@/lib/harness-runs-db';
import type { GamePlan, ProgressEntry, GameBuildGuide, HarnessCostTotals } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
});

function samplePlan(passing = 2, total = 4): GamePlan {
  return {
    game: 'TestProj',
    projectPath: 'C:\\proj',
    ueVersion: '5.5',
    iteration: 3,
    totalFeatures: total,
    passingFeatures: passing,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:30:00.000Z',
    areas: [
      {
        id: 'a-1', moduleId: 'arpg-combat' as never, label: 'Combat core',
        description: '', checklistItemIds: [], featureNames: [], dependsOn: [],
        status: 'completed',
        features: [
          { id: 'f1', name: 'attack', status: 'pass', quality: 4, lastSession: 3 },
          { id: 'f2', name: 'dodge', status: 'pass', quality: 4, lastSession: 3 },
        ],
      },
      {
        id: 'a-2', moduleId: 'arpg-character' as never, label: 'Character',
        description: '', checklistItemIds: [], featureNames: [], dependsOn: [],
        status: 'failed',
        features: [
          { id: 'f3', name: 'genome', status: 'fail', quality: 1, lastSession: 3 },
          { id: 'f4', name: 'inventory', status: 'pending', quality: null, lastSession: null },
        ],
      },
    ],
  };
}

function sampleCost(): HarnessCostTotals {
  return { spentUsd: 1.25, byArea: { 'a-1': 0.8, 'a-2': 0.45 }, sessions: 3, budgetUsd: 5, paused: false };
}

function sampleGuide(): GameBuildGuide {
  return {
    title: 'Build', game: 'TestProj', generatedAt: '2026-05-27T10:30:00.000Z',
    totalIterations: 3, totalDurationMs: 1000, buildOrder: [], steps: [], learnings: [], prerequisites: [],
  };
}

describe('harness-runs-db', () => {
  it('startRun → finalizeRun round-trip preserves snapshots', () => {
    startRun({
      runId: 'run_a',
      projectName: 'TestProj',
      projectPath: 'C:\\proj',
      startedAt: '2026-05-27T10:00:00.000Z',
      themeDirective: 'Star Wars ARPG',
      plan: samplePlan(0, 4),
      cost: { spentUsd: 0, byArea: {}, sessions: 0, budgetUsd: 5, paused: false },
    });

    const inProgress = getRun('run_a');
    expect(inProgress?.status).toBe('running');
    expect(inProgress?.themeDirective).toBe('Star Wars ARPG');
    expect(inProgress?.passRate).toBe(0);
    expect(inProgress?.endedAt).toBeNull();

    const progress: ProgressEntry[] = [
      {
        iteration: 1, timestamp: '2026-05-27T10:05:00.000Z', areaId: 'a-1',
        moduleId: 'arpg-combat' as never, action: 'execute', outcome: 'success',
        summary: 'ok', durationMs: 200, featuresChanged: ['attack', 'dodge'],
      },
    ];

    finalizeRun({
      runId: 'run_a',
      status: 'completed',
      endedAt: '2026-05-27T10:30:00.000Z', // +30 min
      plan: samplePlan(),
      progress,
      guide: sampleGuide(),
      cost: sampleCost(),
    });

    const detail = getRun('run_a');
    expect(detail).not.toBeNull();
    expect(detail!.status).toBe('completed');
    expect(detail!.passRate).toBe(50); // 2 of 4
    expect(detail!.totalAreas).toBe(2);
    expect(detail!.completedAreas).toBe(1);
    expect(detail!.failedAreas).toBe(1);
    expect(detail!.spentUsd).toBe(1.25);
    expect(detail!.budgetUsd).toBe(5);
    expect(detail!.sessions).toBe(3);
    expect(detail!.durationMs).toBe(30 * 60 * 1000);
    expect(detail!.plan?.areas).toHaveLength(2);
    expect(detail!.progress).toHaveLength(1);
    expect(detail!.guide?.title).toBe('Build');
    expect(detail!.cost?.byArea['a-1']).toBe(0.8);
  });

  it('listRuns returns rows newest-first', () => {
    startRun({
      runId: 'run_older', projectName: 'p', projectPath: 'C:\\proj',
      startedAt: '2026-05-26T10:00:00.000Z', plan: null, cost: null,
    });
    startRun({
      runId: 'run_newer', projectName: 'p', projectPath: 'C:\\proj',
      startedAt: '2026-05-27T10:00:00.000Z', plan: null, cost: null,
    });

    const all = listRuns();
    expect(all.map((r) => r.runId)).toEqual(['run_newer', 'run_older']);
  });

  it('listRuns can filter by projectPath', () => {
    startRun({ runId: 'r1', projectName: 'a', projectPath: 'C:\\a', startedAt: '2026-05-27T10:00:00.000Z', plan: null, cost: null });
    startRun({ runId: 'r2', projectName: 'b', projectPath: 'C:\\b', startedAt: '2026-05-27T10:00:00.000Z', plan: null, cost: null });
    expect(listRuns({ projectPath: 'C:\\a' }).map((r) => r.runId)).toEqual(['r1']);
  });

  it('deleteRun removes the row', () => {
    startRun({ runId: 'r1', projectName: 'p', projectPath: 'C:\\p', startedAt: '2026-05-27T10:00:00.000Z', plan: null, cost: null });
    expect(deleteRun('r1')).toBe(true);
    expect(getRun('r1')).toBeNull();
    expect(deleteRun('nope')).toBe(false);
  });

  it('finalizeRun computes duration_ms from the original started_at, not the call site', () => {
    startRun({ runId: 'rx', projectName: 'p', projectPath: 'C:\\p', startedAt: '2026-05-27T10:00:00.000Z', plan: null, cost: null });
    finalizeRun({
      runId: 'rx', status: 'paused', endedAt: '2026-05-27T10:00:05.000Z',
      plan: null, progress: [], guide: null, cost: null,
    });
    expect(getRun('rx')?.durationMs).toBe(5000);
  });
});
