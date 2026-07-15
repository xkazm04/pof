import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// In-memory DB, mocked before importing anything that touches harness-runs-db.
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import { startRun, finalizeRun, reopenRun, getRun, reapStrandedRuns } from '@/lib/harness-runs-db';
import {
  resolveRunIdentity,
  rehydrateHarnessOrchestrator,
  readRunMeta,
  isResumableStatus,
  healStrandedAreas,
  createDefaultConfig,
  type RunMeta,
} from '@/lib/harness/orchestrator';
import type { GamePlan, ModuleArea, HarnessConfig } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
});

// ── test fixtures ──────────────────────────────────────────────────────────────

/** A statePath dir with a run-meta.json + a real config snapshot on disk. */
function seedStateDir(runId: string, parentRunId?: string): { statePath: string; projectPath: string } {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));
  const config = createDefaultConfig({ projectPath, projectName: 'PoF', ueVersion: '5.8', statePath });
  fs.writeFileSync(path.join(statePath, 'harness-config.json'), JSON.stringify(config, null, 2));
  const meta: RunMeta = { runId, projectPath, statePath, startedAt: '2026-01-01T00:00:00.000Z', ...(parentRunId ? { parentRunId } : {}) };
  fs.writeFileSync(path.join(statePath, 'run-meta.json'), JSON.stringify(meta, null, 2));
  return { statePath, projectPath };
}

function area(id: string, status: ModuleArea['status']): ModuleArea {
  return {
    id, moduleId: 'arpg-combat' as never, label: id, description: '',
    checklistItemIds: [], featureNames: [], dependsOn: [], status, features: [],
  };
}

function plan(areas: ModuleArea[]): GamePlan {
  return {
    game: 'PoF', projectPath: 'C:/p', ueVersion: '5.8', areas, iteration: 3,
    totalFeatures: 0, passingFeatures: 0, createdAt: '', updatedAt: '',
  };
}

// ── healStrandedAreas ──────────────────────────────────────────────────────────

describe('healStrandedAreas', () => {
  it('flips in-progress areas back to pending and counts them', () => {
    const p = plan([area('a', 'in-progress'), area('b', 'completed'), area('c', 'in-progress')]);
    const healed = healStrandedAreas(p);
    expect(healed).toBe(2);
    expect(p.areas.map((a) => a.status)).toEqual(['pending', 'completed', 'pending']);
  });
  it('is a no-op when nothing is stranded', () => {
    const p = plan([area('a', 'completed'), area('b', 'pending')]);
    expect(healStrandedAreas(p)).toBe(0);
  });
});

// ── isResumableStatus ──────────────────────────────────────────────────────────

describe('isResumableStatus', () => {
  it('paused / interrupted / running are resumable; completed / error are not', () => {
    expect(isResumableStatus('paused')).toBe(true);
    expect(isResumableStatus('interrupted')).toBe(true);
    expect(isResumableStatus('running')).toBe(true);
    expect(isResumableStatus('completed')).toBe(false);
    expect(isResumableStatus('error')).toBe(false);
    expect(isResumableStatus(undefined)).toBe(false);
  });
});

// ── reopenRun (DB re-adopt) ─────────────────────────────────────────────────────

describe('reopenRun', () => {
  it('reopens an interrupted run to running (resumable) and re-registers it live', () => {
    startRun({ runId: 'r1', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'r1', status: 'interrupted', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });
    expect(getRun('r1')?.status).toBe('interrupted');

    expect(reopenRun('r1')).toBe(true);
    expect(getRun('r1')?.status).toBe('running');
    expect(getRun('r1')?.endedAt).toBeNull();

    // Now live in-process → the reaper must NOT interrupt it again.
    reapStrandedRuns();
    expect(getRun('r1')?.status).toBe('running');
  });
  it('returns false for a nonexistent run', () => {
    startRun({ runId: 'seed', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    expect(reopenRun('ghost')).toBe(false);
  });
});

// ── resolveRunIdentity (resume vs fork vs fresh) ────────────────────────────────

describe('resolveRunIdentity', () => {
  it('fresh when no run-meta exists at the statePath', () => {
    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));
    expect(resolveRunIdentity(statePath)).toEqual({ mode: 'fresh' });
  });

  it('RESUMES (same runId) when the prior run is paused', () => {
    const { statePath } = seedStateDir('run-paused');
    startRun({ runId: 'run-paused', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-paused', status: 'paused', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });
    expect(resolveRunIdentity(statePath)).toEqual({ mode: 'resume', resumeRunId: 'run-paused' });
  });

  it('RESUMES a reaped interrupted run (reaper hand-off)', () => {
    const { statePath } = seedStateDir('run-int');
    startRun({ runId: 'run-int', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-int', status: 'interrupted', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });
    const id = resolveRunIdentity(statePath);
    expect(id.mode).toBe('resume');
    expect(id.resumeRunId).toBe('run-int');
  });

  it('RESUMES (adopts the id) when run-meta exists but the DB row vanished', () => {
    const { statePath } = seedStateDir('run-ghost');
    // No DB row inserted for run-ghost, but ensure the table exists.
    startRun({ runId: 'seed', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    expect(resolveRunIdentity(statePath)).toEqual({ mode: 'resume', resumeRunId: 'run-ghost' });
  });

  it('FORKS with provenance when the prior run completed', () => {
    const { statePath } = seedStateDir('run-done');
    startRun({ runId: 'run-done', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-done', status: 'completed', endedAt: '2026-01-01T00:05:00.000Z', plan: null, progress: [], guide: null, cost: null });
    const id = resolveRunIdentity(statePath);
    expect(id.mode).toBe('fork');
    expect(id.parentRunId).toBe('run-done');
    expect(id.resumeRunId).toBeUndefined();
  });

  it('FORCE-forks even from a resumable run', () => {
    const { statePath } = seedStateDir('run-paused2');
    startRun({ runId: 'run-paused2', projectName: 'p', projectPath: 'C:/p', startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-paused2', status: 'paused', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });
    const id = resolveRunIdentity(statePath, { forceFork: true });
    expect(id).toEqual({ mode: 'fork', parentRunId: 'run-paused2' });
  });
});

// ── rehydrateHarnessOrchestrator (restart resume, SAME runId) ───────────────────

describe('rehydrateHarnessOrchestrator', () => {
  it('rebuilds an orchestrator adopting the same runId from disk', () => {
    const { statePath } = seedStateDir('run-x');
    const rh = rehydrateHarnessOrchestrator(statePath);
    expect(rh).not.toBeNull();
    // Same runId — no fragmentation across the "restart".
    expect(rh!.runId).toBe('run-x');
    expect(rh!.orchestrator.getRunId()).toBe('run-x');
    expect(rh!.config.statePath).toBe(statePath);
  });

  it('returns null when there is no run-meta', () => {
    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));
    // config present but no run-meta.
    fs.writeFileSync(path.join(statePath, 'harness-config.json'), JSON.stringify({} as HarnessConfig));
    expect(rehydrateHarnessOrchestrator(statePath)).toBeNull();
  });

  it('returns null when the config snapshot is missing', () => {
    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));
    const meta: RunMeta = { runId: 'r', projectPath: 'C:/p', statePath, startedAt: '' };
    fs.writeFileSync(path.join(statePath, 'run-meta.json'), JSON.stringify(meta));
    expect(rehydrateHarnessOrchestrator(statePath)).toBeNull();
  });

  it('readRunMeta round-trips the persisted binding', () => {
    const { statePath } = seedStateDir('run-rt', 'parent-1');
    const meta = readRunMeta(statePath);
    expect(meta?.runId).toBe('run-rt');
    expect(meta?.parentRunId).toBe('parent-1');
  });
});
