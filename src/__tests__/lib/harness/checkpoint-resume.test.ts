/**
 * Checkpoints SURVIVE resume — rollback goes to the real green.
 *
 * These run against REAL throwaway git repos (not a git double): the bug being
 * guarded is about what git actually does to refs and the working tree when a
 * rehydrated run re-attaches to its ledger.
 *
 * Before the fix `createCheckpointer` always started empty, `init()` re-`checkout
 * -B`'d the branch and recorded a NEW baseline at the resume-time tree — so
 * `rollbackToLastGreen` hard-reset to the WRONG commit while the UI kept
 * rendering the stale `checkpoints.json` ledger the rollback ignored.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// The orchestrator-wiring test at the bottom drives the real runLoop; its
// Claude sessions and gates are stubbed (this suite is about git, not gates).
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));
vi.mock('@/lib/harness/executor', () => ({
  executeArea: async () => ({ completed: true, assistantOutput: 'ok', costUsd: 0.01, durationMs: 1, errors: [] }),
  parseAreaResult: () => ({ features: [], learnings: [], summary: 'stub area done' }),
  readAgentsMd: () => '',
  appendAgentsMd: () => {},
}));
vi.mock('@/lib/harness/verifier', () => ({
  verify: async (area: { id: string }, iteration: number) => ({
    iteration, areaId: area.id, timestamp: '', gates: [], allPassed: true, requiredFailures: 0,
  }),
  formatVerificationSummary: () => 'Verification PASSED',
  detectGates: () => [],
  checkSuccessReachable: () => ({ reachable: true, blockingGates: [] }),
}));

import { createHarnessOrchestrator, readCheckpoints } from '@/lib/harness/orchestrator';
import type { GamePlan, HarnessConfig, HarnessEvent } from '@/lib/harness/types';
import {
  createCheckpointer,
  checkpointBranch,
  BASELINE_AREA_ID,
  type CheckpointState,
} from '@/lib/harness/checkpoint';

const repos: string[] = [];

afterEach(() => {
  for (const d of repos.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
});

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' }).trim();
}

/** A throwaway repo with one commit, isolated from the user's git config. */
function initRepo(): string {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-git-')));
  repos.push(d);
  git(d, 'init', '-b', 'main');
  git(d, 'config', 'user.email', 'harness@test.local');
  git(d, 'config', 'user.name', 'Harness Test');
  git(d, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(d, 'README.md'), 'base\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-m', 'base');
  return d;
}

const write = (repo: string, file: string, body: string) =>
  fs.writeFileSync(path.join(repo, file), body);
const has = (repo: string, file: string) => fs.existsSync(path.join(repo, file));

/** Run a fresh run's worth of checkpoints, returning the persisted ledger. */
async function seedTwoGreens(repo: string, runId: string) {
  const cp = createCheckpointer(runId, repo);
  expect(await cp.init()).toBe(true);
  write(repo, 'a.ts', 'AREA A');
  const green1 = await cp.commitArea('area-a', 1);
  write(repo, 'b.ts', 'AREA B');
  const green2 = await cp.commitArea('area-b', 1);
  expect(green1).not.toBeNull();
  expect(green2).not.toBeNull();
  // Exactly what saveCheckpoints() writes to checkpoints.json.
  return { ledger: cp.getState() as CheckpointState, green2: green2! };
}

describe('checkpointer resume — rehydrated ledger', () => {
  it('rolls back to the REAL last green after a restart, not a resume-time baseline', async () => {
    const repo = initRepo();
    const { ledger, green2 } = await seedTwoGreens(repo, 'run-1');
    expect(ledger.checkpoints).toHaveLength(3); // baseline + 2 greens

    // ── simulate the process restart ──────────────────────────────────────
    // Work exists in the tree that was NOT green (this is what the old code
    // silently promoted into a fresh baseline).
    write(repo, 'bad.ts', 'BROKEN WORK SINCE THE LAST GREEN');

    const resumed = createCheckpointer('run-1', repo, undefined, ledger);
    expect(await resumed.init()).toBe(true);
    expect(resumed.isResumed()).toBe(true);

    // The DISPLAY ledger and the ROLLBACK TARGET cannot disagree: no new
    // baseline was appended, and lastGreen is still the last real green.
    expect(resumed.getState().checkpoints).toEqual(ledger.checkpoints);
    expect(resumed.lastGreen()).toBe(green2.sha);

    const to = await resumed.rollbackToLastGreen();
    expect(to).toBe(green2.sha);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(green2.sha);

    // Green work survives; the non-green resume-time work is discarded…
    expect(has(repo, 'a.ts')).toBe(true);
    expect(has(repo, 'b.ts')).toBe(true);
    expect(has(repo, 'bad.ts')).toBe(false);
    // …but is NOT destroyed: the resume snapshot tag keeps it reachable.
    const tags = git(repo, 'tag', '-l', 'harness/run-1/resume-*');
    expect(tags).not.toBe('');
    expect(git(repo, 'show', '--name-only', '--format=', tags.split('\n')[0])).toContain('bad.ts');
  });

  it('re-attaches without orphaning the ledger commits (branch still points past them)', async () => {
    const repo = initRepo();
    const { ledger, green2 } = await seedTwoGreens(repo, 'run-2');

    const resumed = createCheckpointer('run-2', repo, undefined, ledger);
    expect(await resumed.init()).toBe(true);

    // `checkout -B` would have moved the branch onto the resume-time HEAD.
    // Every ledger checkpoint must still be an ancestor of the branch tip.
    const branch = checkpointBranch('run-2');
    for (const c of ledger.checkpoints) {
      expect(() => git(repo, 'merge-base', '--is-ancestor', c.sha, branch)).not.toThrow();
    }
    expect(git(repo, 'rev-parse', branch)).toBe(green2.sha);
  });

  it('rebuilds a DELETED harness branch at the last green rather than re-baselining', async () => {
    const repo = initRepo();
    const { ledger, green2 } = await seedTwoGreens(repo, 'run-3');
    // Branch destroyed between runs; the tagged commits survive.
    git(repo, 'checkout', 'main');
    git(repo, 'branch', '-D', checkpointBranch('run-3'));

    const resumed = createCheckpointer('run-3', repo, undefined, ledger);
    expect(await resumed.init()).toBe(true);
    expect(resumed.isResumed()).toBe(true);
    expect(resumed.lastGreen()).toBe(green2.sha);
    expect(git(repo, 'rev-parse', checkpointBranch('run-3'))).toBe(green2.sha);
    expect(await resumed.rollbackToLastGreen()).toBe(green2.sha);
  });

  it('falls back to a FRESH baseline when the ledger names commits that no longer exist', async () => {
    const repo = initRepo();
    const bogus: CheckpointState = {
      branch: checkpointBranch('run-4'),
      checkpoints: [{
        areaId: 'area-a', iteration: 1, sha: 'a'.repeat(40), tag: 't', timestamp: '2026-01-01T00:00:00.000Z',
      }],
    };
    const cp = createCheckpointer('run-4', repo, undefined, bogus);
    expect(await cp.init()).toBe(true);
    // Unusable ledger discarded — never armed against a missing object.
    expect(cp.isResumed()).toBe(false);
    expect(cp.getState().checkpoints).toHaveLength(1);
    expect(cp.getState().checkpoints[0].areaId).toBe(BASELINE_AREA_ID);
    expect(cp.lastGreen()).toBe(git(repo, 'rev-parse', 'HEAD'));
  });

  it("ignores a ledger belonging to a DIFFERENT run's branch", async () => {
    const repo = initRepo();
    const { ledger } = await seedTwoGreens(repo, 'run-5');
    const cp = createCheckpointer('run-6', repo, undefined, ledger); // other run's ledger
    expect(await cp.init()).toBe(true);
    expect(cp.isResumed()).toBe(false);
    expect(cp.getState().branch).toBe(checkpointBranch('run-6'));
    expect(cp.getState().checkpoints).toHaveLength(1);
  });
});

// ── orchestrator wiring ──────────────────────────────────────────────────────

describe('orchestrator rehydrates the ledger from checkpoints.json', () => {
  it('a resumed run adopts the persisted ledger instead of re-baselining', async () => {
    const repo = initRepo();
    const runId = 'run-wired';
    const { ledger, green2 } = await seedTwoGreens(repo, runId);

    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-state-'));
    // Exactly the sidecars a paused run leaves behind.
    fs.writeFileSync(path.join(statePath, 'checkpoints.json'), JSON.stringify(ledger));
    const plan: GamePlan = {
      game: 'PoF', projectPath: repo, ueVersion: '5.8',
      areas: [{
        id: 'area-c', moduleId: 'arpg-combat' as never, label: 'c', description: '',
        checklistItemIds: [], featureNames: [], dependsOn: [], status: 'pending', features: [],
      }],
      iteration: 1, totalFeatures: 0, passingFeatures: 0, createdAt: '', updatedAt: '',
    };
    fs.writeFileSync(path.join(statePath, 'game-plan.json'), JSON.stringify(plan));

    const config: HarnessConfig = {
      projectPath: repo, projectName: 'PoF', ueVersion: '5.8', statePath,
      executor: {
        sessionTimeoutMs: 1000, maxRetriesPerArea: 1, allowedTools: [],
        skipPermissions: true, bareMode: true, maxConcurrent: 1,
      },
      gates: [], maxIterations: 3, generateGuide: false, updateAgentsMd: false,
      targetPassRate: 100, passRateBasis: 'self-reported', unlimited: true, checkpoint: true,
    };

    const orch = createHarnessOrchestrator(config, { resumeRunId: runId });
    const events: HarnessEvent[] = [];
    orch.on((e) => events.push(e));
    await orch.start();

    const learnings = events
      .filter((e): e is Extract<HarnessEvent, { type: 'harness:learning' }> => e.type === 'harness:learning')
      .map((e) => e.learning);
    expect(learnings.some((l) => l.includes('Git checkpointing RESUMED'))).toBe(true);

    // The prior greens are still in the live ledger AND on disk — a resume can
    // no longer roll back to a baseline recorded at the resume-time tree.
    const live = orch.getCheckpoints();
    expect(live?.checkpoints.slice(0, ledger.checkpoints.length)).toEqual(ledger.checkpoints);
    expect(live?.checkpoints.some((c) => c.sha === green2.sha)).toBe(true);
    expect(readCheckpoints(statePath)?.checkpoints[0]).toEqual(ledger.checkpoints[0]);

    fs.rmSync(statePath, { recursive: true, force: true });
  });
});
