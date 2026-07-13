import { describe, it, expect, vi, beforeEach } from 'vitest';

// The batch runner reads its report/abslog from disk — mock the fs layer so no real files
// (and no real editor) are ever touched. `spawn` is injected per-test to count boots.
const { fsState, fsMock } = vi.hoisted(() => {
  const state = { files: new Map<string, string>() }; // path -> contents; miss → ENOENT
  const mock = {
    mkdir: async () => undefined,
    writeFile: async () => undefined,
    readFile: async (p: string) => {
      const key = String(p).replace(/\\/g, '/'); // normalise separators
      for (const [k, v] of state.files) if (key.endsWith(k)) return v;
      throw Object.assign(new Error(`ENOENT: ${key}`), { code: 'ENOENT' });
    },
  };
  return { fsState: state, fsMock: mock };
});
vi.mock('node:fs/promises', () => ({ ...fsMock, default: fsMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import {
  buildBatchAutomationArgs,
  parseAutomationReport,
  runBatchAutomation,
  type SpawnFn,
} from '@/lib/test-gate-runner/batchAutomation';
import { makeSpawnExecutor } from '@/lib/test-gate-runner/spawnExecutor';
import type { GateJob } from '@/lib/test-gate-runner/types';

beforeEach(() => fsState.files.clear());

describe('buildBatchAutomationArgs', () => {
  it('combines many tests into ONE RunTests exec + wires a report path (per-test JSON)', () => {
    const args = buildBatchAutomationArgs(['A', 'B', 'C'], 'C:/p/PoF.uproject', 'C:/tmp/b.log', 'C:/tmp/rep');
    expect(args[0]).toBe('C:/p/PoF.uproject');
    expect(args).toContain('-ExecCmds=Automation RunTests A+B+C;Quit');
    expect(args).toContain('-nullrhi');
    expect(args).toContain('-abslog=C:/tmp/b.log');
    expect(args).toContain('-ReportOutputPath=C:/tmp/rep');
  });
});

describe('parseAutomationReport', () => {
  const report = {
    tests: [
      { fullTestPath: 'Project.Functional Tests.Maps.Arena.VSItemsTest', testDisplayName: 'VSItemsTest', state: 'Success', errors: 0 },
      { fullTestPath: 'Project.PoF.Currency.WalletRules', testDisplayName: 'WalletRules', state: 'Fail', errors: 2 },
      { fullTestPath: 'Project.PoF.Skipped.Thing', testDisplayName: 'SkippedThing', state: 'NotRun', errors: 0 },
    ],
  };

  it('maps success→pass, fail→fail per requested name', () => {
    const m = parseAutomationReport(report, ['VSItemsTest', 'WalletRules']);
    expect(m.get('VSItemsTest')!.status).toBe('pass');
    expect(m.get('WalletRules')!.status).toBe('fail');
    expect(m.get('WalletRules')!.detail).toMatch(/failed/);
  });
  it('a name matched by nothing is unregistered (planned), NOT a failure', () => {
    const m = parseAutomationReport(report, ['VSNeverRegisteredTest']);
    expect(m.get('VSNeverRegisteredTest')!.status).toBe('unregistered');
    expect(m.get('VSNeverRegisteredTest')!.detail).toMatch(/planned, not registered/);
  });
  it('a name matched but never run (NotRun/Skipped) is unregistered, not a pass', () => {
    const m = parseAutomationReport(report, ['SkippedThing']);
    expect(m.get('SkippedThing')!.status).toBe('unregistered');
  });
  it('tolerates a missing/garbage report (no tests array) → all unregistered', () => {
    expect(parseAutomationReport(null, ['A']).get('A')!.status).toBe('unregistered');
    expect(parseAutomationReport({}, ['A']).get('A')!.status).toBe('unregistered');
  });
});

/** A spawn stub that records every invocation (to assert boot count) and resolves cleanly. */
function countingSpawn(): { fn: SpawnFn; calls: Array<{ cmd: string; args: string[] }> } {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  const fn: SpawnFn = async (cmd, args) => {
    calls.push({ cmd, args });
    return { timedOut: false };
  };
  return { fn, calls };
}

describe('runBatchAutomation — ONE boot, per-test verdicts from the report', () => {
  it('boots exactly once and derives a verdict per test from index.json', async () => {
    fsState.files.set('index.json', JSON.stringify({
      tests: [
        { fullTestPath: 'x.VSItemsTest', testDisplayName: 'VSItemsTest', state: 'Success' },
        { fullTestPath: 'x.VSLootTest', testDisplayName: 'VSLootTest', state: 'Fail', errors: 1 },
      ],
    }));
    const { fn, calls } = countingSpawn();
    const verdicts = await runBatchAutomation({
      editor: 'ue', uproject: 'p.uproject', testNames: ['VSItemsTest', 'VSLootTest', 'VSPlannedTest'],
      spawn: fn, timeoutMs: 1000,
    });
    expect(calls).toHaveLength(1); // ONE boot for three tests
    expect(verdicts.get('VSItemsTest')!.status).toBe('pass');
    expect(verdicts.get('VSLootTest')!.status).toBe('fail');
    expect(verdicts.get('VSPlannedTest')!.status).toBe('deferred'); // unregistered → deferred
    // Evidence carries the deciding marker.
    expect(verdicts.get('VSItemsTest')!.evidence!.kind).toBe('automation');
    expect(verdicts.get('VSItemsTest')!.raw).toMatchObject({ source: 'report' });
  });

  it('falls back to the combined abslog markers when the report is missing (one whole-batch verdict)', async () => {
    // No index.json seeded → report miss; provide an abslog with a success marker instead.
    fsState.files.set('batch.log', 'LogAutomationController: ... Test Completed. Result={Success}');
    const { fn, calls } = countingSpawn();
    const verdicts = await runBatchAutomation({
      editor: 'ue', uproject: 'p.uproject', testNames: ['A', 'B'], spawn: fn, timeoutMs: 1000,
    });
    expect(calls).toHaveLength(1);
    expect(verdicts.get('A')!.status).toBe('pass');
    expect(verdicts.get('B')!.status).toBe('pass');
    expect(verdicts.get('A')!.raw).toMatchObject({ source: 'abslog' });
  });

  it('a zero-match abslog fallback defers every test (planned, not a red fail)', async () => {
    fsState.files.set('batch.log', 'LogAutomationController: 8621 tests available\nLogExit: Exiting.');
    const { fn } = countingSpawn();
    const verdicts = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ['A'], spawn: fn, timeoutMs: 1000 });
    expect(verdicts.get('A')!.status).toBe('deferred');
  });

  it('no report AND no abslog → every test stays deferred (never a fabricated verdict)', async () => {
    const { fn } = countingSpawn();
    const verdicts = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ['A', 'B'], spawn: fn, timeoutMs: 1000 });
    expect(verdicts.get('A')!.status).toBe('deferred');
    expect(verdicts.get('B')!.status).toBe('deferred');
  });
});

describe('makeSpawnExecutor — prepareBatch groups N automation gates into ONE boot', () => {
  const jobs: GateJob[] = [
    { catalogId: 'items', entityId: 'i1', step: 'Test Gate', tier: 'L3', testName: 'VSItemsTest' },
    { catalogId: 'loot', entityId: 'l1', step: 'Test Gate', tier: 'L3', testName: 'VSLootTest' },
    { catalogId: 'hud', entityId: 'h1', step: 'Test Gate', tier: 'L3', testName: 'VSHUDTest' },
  ];

  it('one spawn invocation for three automation gates; run() serves cached per-test verdicts', async () => {
    fsState.files.set('index.json', JSON.stringify({
      tests: [
        { testDisplayName: 'VSItemsTest', state: 'Success' },
        { testDisplayName: 'VSLootTest', state: 'Success' },
        { testDisplayName: 'VSHUDTest', state: 'Fail', errors: 1 },
      ],
    }));
    const { fn, calls } = countingSpawn();
    const ex = makeSpawnExecutor({ allowSpawn: true, editorCmd: 'ue', uproject: 'p.uproject', spawnImpl: fn });

    await ex.prepareBatch!(jobs);
    expect(calls).toHaveLength(1); // exactly ONE UnrealEditor-Cmd boot for all three gates

    const v1 = await ex.run(jobs[0]);
    const v2 = await ex.run(jobs[1]);
    const v3 = await ex.run(jobs[2]);
    expect(calls).toHaveLength(1); // run() consumed the cache — still no extra boots
    expect(v1.status).toBe('pass');
    expect(v2.status).toBe('pass');
    expect(v3.status).toBe('fail');
    expect(v1.detail).toMatch(/^VSItemsTest:/);
  });

  it('abslog fallback also served from the one batch boot (report absent)', async () => {
    fsState.files.set('batch.log', 'Result={Success}');
    const { fn, calls } = countingSpawn();
    const ex = makeSpawnExecutor({ allowSpawn: true, editorCmd: 'ue', uproject: 'p.uproject', spawnImpl: fn });
    await ex.prepareBatch!(jobs);
    expect(calls).toHaveLength(1);
    expect((await ex.run(jobs[0])).status).toBe('pass');
    expect((await ex.run(jobs[2])).status).toBe('pass');
    expect(calls).toHaveLength(1);
  });

  it('de-duplicates repeated test names into the single combined filter', async () => {
    fsState.files.set('index.json', JSON.stringify({ tests: [{ testDisplayName: 'Dup', state: 'Success' }] }));
    const dup: GateJob[] = [
      { catalogId: 'a', entityId: 'x', step: 's', tier: 'L3', testName: 'Dup' },
      { catalogId: 'b', entityId: 'y', step: 's', tier: 'L3', testName: 'Dup' },
    ];
    const { fn, calls } = countingSpawn();
    const ex = makeSpawnExecutor({ allowSpawn: true, editorCmd: 'ue', uproject: 'p', spawnImpl: fn });
    await ex.prepareBatch!(dup);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain('-ExecCmds=Automation RunTests Dup;Quit'); // deduped
    expect((await ex.run(dup[0])).status).toBe('pass');
    expect((await ex.run(dup[1])).status).toBe('pass');
  });

  it('scenario jobs are NOT batched (they need distinct boot args) and prepareBatch skips them', async () => {
    const { fn, calls } = countingSpawn();
    const ex = makeSpawnExecutor({ allowSpawn: true, editorCmd: 'ue', uproject: 'p', spawnImpl: fn });
    const scenarioJob: GateJob = {
      catalogId: 'ab', entityId: 'fire', step: 'Test Gate', tier: 'L3',
      scenario: { map: '/Game/M', totalSeconds: 2, numSamples: 4, inputs: [], assert: [{ kind: 'moved' }] },
    };
    await ex.prepareBatch!([scenarioJob]);
    expect(calls).toHaveLength(0); // nothing batchable → no boot
  });

  it('prepareBatch is a no-op when spawning is disabled (no boot, no throw)', async () => {
    const { fn, calls } = countingSpawn();
    const ex = makeSpawnExecutor({ allowSpawn: false, editorCmd: 'ue', uproject: 'p', spawnImpl: fn });
    await ex.prepareBatch!(jobs);
    expect(calls).toHaveLength(0);
  });
});
