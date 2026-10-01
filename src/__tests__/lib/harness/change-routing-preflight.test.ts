/**
 * The change-routing preflight is wired next to `checkSuccessReachable` and is
 * ADVISORY: it emits a non-fatal warning, and the run it precedes schedules, scores
 * and completes exactly as it did without it.
 *
 * Executor + verifier are stubbed (this exercises the loop's preflight, never a real
 * Claude session or gate). The gate set deliberately has no `visual` gate, so the
 * orchestrator never starts a dev server here.
 */

import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

vi.mock('@/lib/harness/executor', () => ({
  executeArea: async () => ({ completed: true, assistantOutput: 'ok', costUsd: 0.1, durationMs: 1, errors: [] }),
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
  formatVerificationSummary: () => 'Verification PASSED - all 0 gates green',
  detectGates: () => [],
  checkSuccessReachable: () => ({ reachable: true, blockingGates: [] }),
}));

import { createHarnessOrchestrator } from '@/lib/harness/orchestrator';
import type { GamePlan, HarnessConfig, HarnessEvent, ModuleArea, VerificationGate } from '@/lib/harness/types';

// A UE compile gate with a command: reachable for checkSuccessReachable, but it reads C++.
const GATES: VerificationGate[] = [{ name: 'ue-compile', type: 'ue-compile', required: true, command: 'build-it' }];

function area(id: string, description: string): ModuleArea {
  return {
    id,
    moduleId: 'arpg-combat' as never,
    label: id,
    description,
    checklistItemIds: [],
    featureNames: [],
    dependsOn: [],
    status: 'pending',
    features: [],
  };
}

async function runWith(areas: ModuleArea[]): Promise<HarnessEvent[]> {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-state-'));
  const plan: GamePlan = {
    game: 'PoF',
    projectPath,
    ueVersion: '5.8',
    areas,
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
    executor: { sessionTimeoutMs: 1000, maxRetriesPerArea: 1, allowedTools: [], skipPermissions: true, bareMode: true, maxConcurrent: 1 },
    gates: GATES,
    maxIterations: 10,
    generateGuide: false,
    updateAgentsMd: false,
    targetPassRate: 100,
    passRateBasis: 'self-reported',
    unlimited: true,
  };
  const orch = createHarnessOrchestrator(config);
  const events: HarnessEvent[] = [];
  orch.on((e) => events.push(e));
  await orch.start();
  return events;
}

const routingWarnings = (events: HarnessEvent[]) => events.filter(
  (e): e is Extract<HarnessEvent, { type: 'harness:error' }> =>
    e.type === 'harness:error' && e.error.startsWith('Change routing (advisory):'),
);

describe('change-routing preflight wiring', () => {
  it('warns (non-fatal) that the compile gate reads no planned change, then runs and completes as usual', async () => {
    const events = await runWith([area('ui-a', 'Edit src/components/modules/x/View.tsx'), area('ui-b', 'Edit src/lib/y.ts')]);
    const warnings = routingWarnings(events);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.fatal === false)).toBe(true);
    expect(warnings.map((w) => w.error).join('\n')).toContain('ue-compile (required) cannot return a verdict for any planned change (web-source)');
    // Advisory: it precedes the loop, and the loop is untouched.
    const types = events.map((e) => e.type);
    expect(types.indexOf('harness:error')).toBeLessThan(types.indexOf('harness:iteration'));
    expect(events.filter((e) => e.type === 'harness:area-completed')).toHaveLength(2);
    expect(types).toContain('harness:completed');
    expect(events.some((e) => e.type === 'harness:error' && e.fatal)).toBe(false);
  });

  it('is silent when the gate set can judge what the plan names', async () => {
    const events = await runWith([area('ue-a', 'Edit Source/PoF/Combat/Damage.cpp')]);
    expect(routingWarnings(events)).toEqual([]);
    expect(events.map((e) => e.type)).toContain('harness:completed');
  });

  it('is silent for areas that name no path - no claim without evidence', async () => {
    const events = await runWith([area('vague', 'Polish the flow')]);
    expect(routingWarnings(events)).toEqual([]);
  });
});
