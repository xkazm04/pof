/**
 * Self-heal spend is COUNTED — the budget-ceiling hole.
 *
 * `attemptSelfHeal` spawns a FULL second `claude -p` session whenever a required
 * gate fails, but `SelfHealResult` used to discard its `costUsd`, so heal spend
 * never reached the cost totals the governor compares to `budgetUsd`. A run
 * configured with a $25 ceiling could therefore spend past $25, one gate failure
 * at a time — and gate failures are exactly when a run heals repeatedly.
 *
 * These tests drive the real orchestrator loop over a failing required gate with
 * self-heal enabled (executor / verifier / CLI session stubbed) and assert that
 * the heal's dollars land in the recorded totals, that an UNMEASURED heal is
 * booked at the estimate rather than as free, and that the ceiling actually
 * blocks a heal instead of merely observing it afterwards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// In-memory DB, mocked before importing anything that touches harness-runs-db.
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

const hooks = vi.hoisted(() => ({
  /** What the stubbed `claude -p` heal session reports back. */
  healCostUsd: undefined as number | undefined,
  /** How many heal sessions were spawned. */
  healSpawns: 0,
}));

vi.mock('@/lib/harness/executor', () => ({
  executeArea: async () => ({
    completed: true, assistantOutput: 'ok', costUsd: 0.5, durationMs: 1, errors: [],
  }),
  parseAreaResult: () => ({ features: [], learnings: [], summary: 'stub area done' }),
  readAgentsMd: () => '',
  appendAgentsMd: () => {},
}));

// The self-heal path is the ONLY consumer of this module inside the orchestrator.
vi.mock('@/lib/harness/claude-session', () => ({
  spawnClaudeSession: async () => {
    hooks.healSpawns += 1;
    return {
      output: 'fixed',
      exitCode: 0,
      errors: [],
      ...(hooks.healCostUsd != null ? { costUsd: hooks.healCostUsd } : {}),
    };
  },
  wrapHarnessResult: (body: string) => `@@HARNESS_RESULT\n${body}\n@@END_HARNESS_RESULT`,
}));

// A required gate that FAILS with a code error — the self-heal trigger.
vi.mock('@/lib/harness/verifier', () => ({
  verify: async (area: { id: string }, iteration: number) => ({
    iteration,
    areaId: area.id,
    timestamp: new Date().toISOString(),
    gates: [{
      gate: 'typecheck',
      passed: false,
      output: 'error TS2322: Type mismatch',
      errors: [{ message: 'error TS2322: Type mismatch' }],
    }],
    allPassed: false,
    requiredFailures: 1,
  }),
  formatVerificationSummary: () => 'Verification FAILED — 1 required gate red',
  detectGates: () => [],
  checkSuccessReachable: () => ({ reachable: true, blockingGates: [] }),
}));

import {
  createHarnessOrchestrator,
  readHarnessCost,
  formatHealSpendLine,
  emptyCost,
} from '@/lib/harness/orchestrator';
import type { GamePlan, HarnessConfig, HarnessEvent, ModuleArea } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
  hooks.healCostUsd = undefined;
  hooks.healSpawns = 0;
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

/**
 * A one-area run whose single required gate always fails, so exactly one
 * execute → verify → self-heal cycle happens before the area is promoted.
 * The heal's verify command exits non-zero, so the heal never "holds" — the
 * accounting must still book what the fix session spent.
 */
function seedRun(overrides: Partial<HarnessConfig> = {}) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-state-'));
  const plan: GamePlan = {
    game: 'PoF',
    projectPath,
    ueVersion: '5.8',
    areas: [area('a')],
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
      maxRetriesPerArea: 0,
      allowedTools: [],
      skipPermissions: true,
      bareMode: true,
      maxConcurrent: 1,
    },
    gates: [{
      name: 'typecheck',
      type: 'typecheck',
      required: true,
      command: 'node -e "process.exit(1)"',
    }],
    maxIterations: 1,
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

const learnings = (events: HarnessEvent[]) =>
  events.filter((e): e is Extract<HarnessEvent, { type: 'harness:learning' }> => e.type === 'harness:learning')
    .map((e) => e.learning);

// ── the regression: heal spend reaches the totals ────────────────────────────

describe('self-heal spend is folded into the run totals', () => {
  it('records the heal session cost on top of the executor session cost', async () => {
    hooks.healCostUsd = 2;
    const { statePath, config } = seedRun();

    await createHarnessOrchestrator(config).start();

    expect(hooks.healSpawns).toBe(1); // the heal really did spawn a session
    const cost = readHarnessCost(statePath)!;
    // $0.50 executor + $2.00 heal. Before the fix this read $0.50 — the heal was free.
    expect(cost.spentUsd).toBeCloseTo(2.5, 5);
    expect(cost.healUsd).toBeCloseTo(2, 5);
    expect(cost.healSessions).toBe(1);
    expect(cost.healUnmeasuredSessions).toBe(0);
    // Attributed to the area that triggered it, so per-area spend is honest too.
    expect(cost.byArea['a']).toBeCloseTo(2.5, 5);
    // `sessions` stays the EXECUTOR denominator (the next-session estimate).
    expect(cost.sessions).toBe(1);
  });

  it('books an UNMEASURED heal at the estimate — never as free', async () => {
    hooks.healCostUsd = undefined; // CLI reported no cost
    const { statePath, config } = seedRun();

    await createHarnessOrchestrator(config).start();

    const cost = readHarnessCost(statePath)!;
    expect(cost.healSessions).toBe(1);
    expect(cost.healUnmeasuredSessions).toBe(1);
    expect(cost.healUsd).toBeGreaterThan(0);          // the whole point: not $0
    expect(cost.spentUsd).toBeGreaterThan(0.5);        // more than the executor session alone
  });

  it('reports heal spend as its own line in the run summary', async () => {
    hooks.healCostUsd = 2;
    const { config } = seedRun();
    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);

    await orch.start();

    const line = learnings(events).find((l) => l.startsWith('Self-heal spend:'));
    expect(line).toBeDefined();
    expect(line).toContain('$2.00');
    expect(line).toContain('1 heal session');
  });
});

// ── the ceiling actually holds ───────────────────────────────────────────────

describe('the budget governor counts heal spend when deciding to stop', () => {
  it('refuses to launch a heal once the cap is reached', async () => {
    hooks.healCostUsd = 2;
    // $0.60 cap vs a $0.50 executor session: after the session books, committed
    // ($0.50) + the next-session estimate ($0.50) already crosses the cap, so the
    // heal — a full session of its own — must not fire.
    const { statePath, config } = seedRun({ unlimited: false, budgetUsd: 0.6 });
    const orch = createHarnessOrchestrator(config);
    const events = collect(orch);

    await orch.start();

    expect(hooks.healSpawns).toBe(0);
    expect(learnings(events).some((l) => l.includes('Skipping self-heal'))).toBe(true);
    const cost = readHarnessCost(statePath)!;
    expect(cost.healSessions).toBe(0);
    expect(cost.spentUsd).toBeCloseTo(0.5, 5); // ceiling held: no unbounded heal spend
  });
});

// ── the summary line itself ──────────────────────────────────────────────────

describe('formatHealSpendLine', () => {
  it('says $0.00 and names the reason when nothing healed', () => {
    expect(formatHealSpendLine(emptyCost(10))).toBe('Self-heal spend: $0.00 — no self-heal sessions ran.');
  });

  it('states the heal total, the session count and the share of total spend', () => {
    const line = formatHealSpendLine({
      ...emptyCost(null), spentUsd: 10, healUsd: 4, healSessions: 2,
    });
    expect(line).toContain('$4.00');
    expect(line).toContain('2 heal sessions');
    expect(line).toContain('40% of total spend');
  });

  it('flags unmeasured heals as booked-at-estimate, not free', () => {
    const line = formatHealSpendLine({
      ...emptyCost(null), spentUsd: 1, healUsd: 0.5, healSessions: 1, healUnmeasuredSessions: 1,
    });
    expect(line).toContain('reported no cost');
    expect(line).toContain('NOT free');
  });
});
