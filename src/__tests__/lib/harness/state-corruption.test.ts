/**
 * A corrupt state file STOPS the run — it never restarts it silently.
 *
 * `game-plan.json` was written with a plain `writeFileSync`, so a crash mid-write
 * could truncate it. The read path degrades to a fallback, and `runLoop`'s
 * `loadPlan(...) ?? buildGamePlan(config)` turned that fallback into silent data
 * loss: the run rebuilt the plan from scratch and abandoned every completed area,
 * with nothing anywhere reporting an error.
 *
 * Writes are atomic now (see state-io.test.ts), which prevents the truncation in
 * the first place; these tests cover the second half — a state file that IS
 * unreadable (an older run's damage, a half-copied state dir, a disk fault) must
 * be reported as CORRUPT and stop the run, while a genuinely MISSING file still
 * means "first run, build a plan".
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

const hooks = vi.hoisted(() => ({ executions: 0 }));

vi.mock('@/lib/harness/executor', () => ({
  executeArea: async () => {
    hooks.executions += 1;
    return { completed: true, assistantOutput: 'ok', costUsd: 0.5, durationMs: 1, errors: [] };
  },
  parseAreaResult: () => ({ features: [], learnings: [], summary: 'stub area done' }),
  readAgentsMd: () => '',
  appendAgentsMd: () => {},
}));

vi.mock('@/lib/harness/verifier', () => ({
  verify: async (area: { id: string }, iteration: number) => ({
    iteration,
    areaId: area.id,
    timestamp: new Date().toISOString(),
    gates: [],
    allPassed: true,
    requiredFailures: 0,
  }),
  formatVerificationSummary: () => 'Verification PASSED — all 0 gates green',
  detectGates: () => [],
  checkSuccessReachable: () => ({ reachable: true, blockingGates: [] }),
}));

import { createHarnessOrchestrator } from '@/lib/harness/orchestrator';
import { StateFileCorruptError } from '@/lib/harness/state-io';
import type { HarnessConfig, HarnessEvent } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
  hooks.executions = 0;
});

/** A state dir with NO plan — the caller seeds whatever (broken) files it wants. */
function seedRun() {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-state-'));
  const config: HarnessConfig = {
    projectPath,
    projectName: 'PoF',
    ueVersion: '5.8',
    statePath,
    executor: {
      sessionTimeoutMs: 1000,
      maxRetriesPerArea: 1,
      allowedTools: [],
      skipPermissions: true,
      bareMode: true,
      maxConcurrent: 1,
    },
    gates: [],
    areas: [], // an empty plan completes immediately — the control path
    maxIterations: 3,
    generateGuide: false,
    updateAgentsMd: false,
    targetPassRate: 100,
    passRateBasis: 'self-reported',
    unlimited: true,
  };
  return { projectPath, statePath, config };
}

function collect(orchestrator: { on(l: (e: HarnessEvent) => void): () => void }): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  orchestrator.on((e) => events.push(e));
  return events;
}

/** A plan truncated mid-write — the exact shape a crashed `writeFileSync` leaves. */
const TRUNCATED_PLAN = '{\n  "game": "PoF",\n  "iteration": 4,\n  "areas": [\n    { "id": "arpg-combat-1", "status": "comp';

describe('a truncated plan stops the run instead of restarting it', () => {
  it('refuses to run, reports CORRUPT, and spawns NOTHING', async () => {
    const { statePath, config } = seedRun();
    const planFile = path.join(statePath, 'game-plan.json');
    fs.writeFileSync(planFile, TRUNCATED_PLAN);

    const orch = createHarnessOrchestrator(config);

    await expect(orch.start()).rejects.toThrow(StateFileCorruptError);

    // The regression: it used to rebuild the plan and run as if nothing happened.
    expect(hooks.executions).toBe(0);
    // And the damaged file is left EXACTLY as found, for the operator to inspect —
    // never overwritten by a freshly built plan.
    expect(fs.readFileSync(planFile, 'utf-8')).toBe(TRUNCATED_PLAN);
  });

  it('emits a fatal harness:error naming the file and the reason', async () => {
    const { statePath, config } = seedRun();
    fs.writeFileSync(path.join(statePath, 'game-plan.json'), TRUNCATED_PLAN);

    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);
    await expect(orch.start()).rejects.toThrow();

    const errors = events.filter(
      (e): e is Extract<HarnessEvent, { type: 'harness:error' }> => e.type === 'harness:error',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(true);
    expect(errors[0].error).toContain('CORRUPT');
    expect(errors[0].error).toContain('game-plan.json');
    // It must say what it is refusing to do, not just that something is wrong.
    expect(errors[0].error).toContain('Refusing to continue');
  });
});

describe('a truncated cost ledger stops the run too', () => {
  it('refuses to run rather than reading spend as $0 and un-capping the budget', async () => {
    const { statePath, config } = seedRun();
    fs.writeFileSync(path.join(statePath, 'cost.json'), '{"spentUsd": 24.9, "sessi');

    const orch = createHarnessOrchestrator({ ...config, unlimited: false, budgetUsd: 25 });
    await expect(orch.start()).rejects.toThrow(/CORRUPT/);
    expect(hooks.executions).toBe(0);
  });
});

describe('a MISSING state file still means "first run"', () => {
  it('builds a plan and completes normally when no plan file exists', async () => {
    const { statePath, config } = seedRun();
    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);

    await expect(orch.start()).resolves.toBeDefined();

    expect(events.map((e) => e.type)).toContain('harness:completed');
    expect(events.filter((e) => e.type === 'harness:error')).toHaveLength(0);
    // The freshly built plan was persisted — the fallback path is untouched.
    expect(fs.existsSync(path.join(statePath, 'game-plan.json'))).toBe(true);
  });
});
