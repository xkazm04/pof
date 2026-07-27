/**
 * Pause SURVIVES — the completion fall-through regression guard.
 *
 * The paused branch of the main loop used to `break` and then fall THROUGH to
 * the unconditional completion tail: `harness:completed` fired and the
 * `harness_runs` row was overwritten with the terminal 'completed'. Consequence
 * chain: `resolveRunIdentity` forked instead of resuming, and the API's event
 * wiring flipped the in-memory status to 'completed' so `action:'resume'` 409'd
 * with "Harness is not paused".
 *
 * These tests walk pause → resume for BOTH pause triggers (manual + budget cap),
 * in-process and across a simulated server restart (rehydrate from disk).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// In-memory DB, mocked before importing anything that touches harness-runs-db.
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

// Executor + verifier are stubbed: this suite exercises the LOOP's pause/resume
// bookkeeping, never a real Claude session or a real gate.
const hooks = vi.hoisted(() => ({ onExecute: null as null | (() => void) }));

vi.mock('@/lib/harness/executor', () => ({
  executeArea: async () => {
    hooks.onExecute?.();
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

import { getRun, listRuns } from '@/lib/harness-runs-db';
import {
  createHarnessOrchestrator,
  rehydrateHarnessOrchestrator,
  resolveRunIdentity,
  readRunMeta,
  readHarnessCost,
} from '@/lib/harness/orchestrator';
import type { GamePlan, HarnessConfig, HarnessEvent, ModuleArea } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
  hooks.onExecute = null;
});

// ── fixtures ────────────────────────────────────────────────────────────────

function area(id: string): ModuleArea {
  return {
    id,
    moduleId: 'arpg-combat' as never,
    label: id,
    description: '',
    checklistItemIds: [],
    featureNames: [],
    dependsOn: [],
    status: 'pending',
    features: [],
  };
}

/** A state dir carrying a ready-to-run plan, so plan-builder never runs. */
function seedRun(areaIds: string[], overrides: Partial<HarnessConfig> = {}) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-state-'));
  const plan: GamePlan = {
    game: 'PoF',
    projectPath,
    ueVersion: '5.8',
    areas: areaIds.map(area),
    iteration: 0,
    totalFeatures: 0,
    passingFeatures: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(statePath, 'game-plan.json'), JSON.stringify(plan));
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
    maxIterations: 10,
    generateGuide: false,
    updateAgentsMd: false,
    targetPassRate: 100,
    passRateBasis: 'self-reported',
    unlimited: true,
    ...overrides,
  };
  return { projectPath, statePath, config };
}

function collect(orchestrator: { on(l: (e: HarnessEvent) => void): () => void }): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  orchestrator.on((e) => events.push(e));
  return events;
}

const types = (events: HarnessEvent[]) => events.map((e) => e.type);

// ── manual pause ────────────────────────────────────────────────────────────

describe('manual pause survives the loop tail', () => {
  it('leaves the run paused (no completed event, no terminal overwrite) and resumes the SAME runId', async () => {
    const { statePath, config } = seedRun(['a', 'b']);
    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);

    // Pause from inside the first executor session — the realistic timing.
    let executions = 0;
    hooks.onExecute = () => {
      executions += 1;
      if (executions === 1) orch.pause();
    };

    await orch.start();
    const runId = orch.getRunId();

    expect(runId).not.toBeNull();
    expect(types(events)).toContain('harness:paused');
    // THE regression: the tail used to fire this on the pause path.
    expect(types(events)).not.toContain('harness:completed');
    expect(getRun(runId!)?.status).toBe('paused');
    expect(readRunMeta(statePath)?.runId).toBe(runId);

    // Resume IN-PROCESS on the same orchestrator.
    hooks.onExecute = null;
    await orch.resume();

    expect(getRun(runId!)?.status).toBe('completed');
    expect(listRuns()).toHaveLength(1); // one continuous run — never forked
  });

  it('resumes across a simulated server restart (rehydrate, same runId, no fork)', async () => {
    const { statePath, config } = seedRun(['a', 'b']);
    const orch = createHarnessOrchestrator(config);
    let executions = 0;
    hooks.onExecute = () => {
      executions += 1;
      if (executions === 1) orch.pause();
    };
    await orch.start();
    const runId = orch.getRunId()!;

    // "Restart": drop the in-memory orchestrator, resolve identity from disk.
    // With the fall-through bug the row was 'completed' → this said 'fork'.
    expect(resolveRunIdentity(statePath)).toEqual({ mode: 'resume', resumeRunId: runId });

    const rh = rehydrateHarnessOrchestrator(statePath);
    expect(rh?.runId).toBe(runId);

    hooks.onExecute = null;
    const events = collect(rh!.orchestrator);
    await rh!.orchestrator.resume();

    expect(types(events)).toContain('harness:completed');
    expect(getRun(runId)?.status).toBe('completed');
    expect(listRuns()).toHaveLength(1);
  });
});

// ── budget-cap pause ────────────────────────────────────────────────────────

describe('budget-cap pause survives the loop tail', () => {
  it('a cap hit leaves the run paused and resumable — never silently completed', async () => {
    // $0.90 cap vs a $0.50 stub session: the first area runs, the second launch
    // would project past the cap → the governor pauses.
    const { statePath, config } = seedRun(['a', 'b', 'c'], { unlimited: false, budgetUsd: 0.9 });
    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);

    await orch.start();
    const runId = orch.getRunId();

    expect(runId).not.toBeNull();
    const pauses = events.filter((e) => e.type === 'harness:paused');
    expect(pauses.length).toBeGreaterThan(0);
    expect(pauses.some((e) => 'reason' in e && /cost cap/i.test(e.reason))).toBe(true);
    expect(types(events)).not.toContain('harness:completed');
    expect(getRun(runId!)?.status).toBe('paused');
    expect(readHarnessCost(statePath)?.paused).toBe(true);

    // Restart + resume: the identity resolves to a RESUME of the same run. The
    // cap is still exceeded, so the loop honestly re-pauses rather than
    // completing — what must never happen is a terminal 'completed'.
    expect(resolveRunIdentity(statePath)).toEqual({ mode: 'resume', resumeRunId: runId! });
    const rh = rehydrateHarnessOrchestrator(statePath);
    const resumeEvents = collect(rh!.orchestrator);
    await rh!.orchestrator.resume();

    expect(types(resumeEvents)).not.toContain('harness:completed');
    expect(getRun(runId!)?.status).toBe('paused');
    expect(listRuns()).toHaveLength(1);
  });
});
