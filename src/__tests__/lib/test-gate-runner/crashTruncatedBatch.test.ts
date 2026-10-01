import { describe, it, expect, vi, beforeEach } from 'vitest';

// A crash-truncated grouped boot. The editor is SIMULATED (an injected spawn that writes the
// log/report an editor would leave) - no real editor is ever launched. The log vocabulary is
// the one the existing batchAutomation tests already use ("Beginning test", "Fatal error",
// `Result={Success} Name={...}`), so what is modelled is the harness's classification and
// resume logic, not UE's real log format.
const { fsState, fsMock } = vi.hoisted(() => {
  const state = { files: new Map<string, string>() };
  const mock = {
    mkdir: async () => undefined,
    writeFile: async () => undefined,
    readFile: async (p: string) => {
      const key = String(p).replace(/\\/g, '/');
      for (const [k, v] of state.files) if (key.endsWith(k)) return v;
      throw Object.assign(new Error(`ENOENT: ${key}`), { code: 'ENOENT' });
    },
  };
  return { fsState: state, fsMock: mock };
});
vi.mock('node:fs/promises', () => ({ ...fsMock, default: fsMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { runBatchAutomation, type SpawnFn } from '@/lib/test-gate-runner/batchAutomation';
import type { GateVerdict } from '@/lib/test-gate-runner/types';

beforeEach(() => fsState.files.clear());

interface Sim {
  /** Names the simulated editor knows (a requested name outside this list matches nothing). */
  known: string[];
  /** Deterministic crasher: logs its start, then a fatal error, then the editor is gone. */
  crasher?: string;
  /** Hung test: logs its start and never finishes; the watchdog fires (timedOut). */
  hang?: string;
  /** Fatal error before any test starts. */
  startupCrash?: boolean;
  /** First boot only: every known test completes, then a teardown fault is logged and no report
   *  is written (the ambiguous case a log alone cannot tell from a crash). */
  teardownFatalNoReport?: boolean;
}

function simulatedEditor(sim: Sim): { spawn: SpawnFn; boots: string[][] } {
  const boots: string[][] = [];
  const spawn: SpawnFn = async (_cmd, args) => {
    const exec = args.find((a) => a.startsWith('-ExecCmds='))!;
    const filter = exec.replace('-ExecCmds=Automation RunTests ', '').replace(';Quit', '');
    const requested = filter.split('+');
    boots.push(requested);
    fsState.files.clear();
    const log: string[] = [`LogAutomationController: ${requested.length} tests available`, `Cmd: Automation RunTests ${filter}`];
    const report: Array<{ fullTestPath: string; testDisplayName: string; state: string; errors: number }> = [];
    const write = () => fsState.files.set('batch.log', log.join('\n'));
    if (sim.startupCrash) {
      log.push('Fatal error! [File:Startup] crash');
      write();
      return { timedOut: false };
    }
    for (const name of requested) {
      if (!sim.known.includes(name)) continue;
      if (name === sim.crasher) {
        log.push(`LogAutomationController: Beginning test Project.PoF.${name}`, 'Fatal error! [File:Engine] crash');
        write();
        return { timedOut: false };
      }
      if (name === sim.hang) {
        log.push(`LogAutomationController: Beginning test Project.PoF.${name}`);
        write();
        return { timedOut: true };
      }
      log.push(`LogAutomationController: Test Completed. Result={Success} Name={Project.PoF.${name}}`);
      report.push({ fullTestPath: `Project.PoF.${name}`, testDisplayName: name, state: 'Success', errors: 0 });
    }
    if (sim.teardownFatalNoReport && boots.length === 1) {
      log.push('Fatal error! [File:Teardown] null deref during shutdown');
      write();
      return { timedOut: false };
    }
    write();
    // A boot that reached its own end writes the structured report.
    fsState.files.set('index.json', JSON.stringify({ tests: report }));
    return { timedOut: false };
  };
  return { spawn, boots };
}

// The zero-match label as it reaches an operator: "planned, not registered in UE" from the
// report path, "... planned - scaffold available" once the scaffold note is appended.
const PLANNED = /planned/i;
const ALL = ['VSAlphaTest', 'VSBetaTest', 'VSCrashTest', 'VSGammaTest', 'VSDeltaTest', 'VSEpsilonTest'];

/** Model the drain: every pass re-runs, in one grouped boot, whatever is still `deferred`. */
async function drain(sim: Sim, names: string[], passes: number) {
  const { spawn, boots } = simulatedEditor(sim);
  const settled = new Map<string, GateVerdict>();
  let pending = [...names];
  let last = new Map<string, GateVerdict>();
  for (let i = 0; i < passes && pending.length; i++) {
    last = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: pending, spawn, timeoutMs: 1000 });
    for (const [n, v] of last) if (v.status !== 'deferred') settled.set(n, v);
    pending = pending.filter((n) => !settled.has(n));
  }
  const stillDeferred = pending.map((n) => ({ name: n, verdict: last.get(n)! }));
  return { settled, stillDeferred, boots };
}

describe('crash-truncated grouped boot (deterministic crasher at position 3 of 6, three drain passes)', () => {
  it('measures: tests with a real verdict, existing tests mislabelled "planned", boots spent', async () => {
    const sim: Sim = { known: ALL, crasher: 'VSCrashTest' };
    const { settled, stillDeferred, boots } = await drain(sim, ALL, 3);
    const mislabelled = stillDeferred.filter((d) => sim.known.includes(d.name) && PLANNED.test(d.verdict.detail));
    // The A/B record. Before resume existed the same input gave
    // { withRealVerdict: 2, existingButLabelledPlanned: 4, boots: 3 }: every test behind the
    // crasher was starved on every pass and labelled "planned - scaffold available".
    expect({
      testsTotal: ALL.length,
      withRealVerdict: settled.size,
      existingButLabelledPlanned: mislabelled.length,
      boots: boots.length,
    }).toEqual({ testsTotal: 6, withRealVerdict: 5, existingButLabelledPlanned: 0, boots: 4 });
    const crasher = stillDeferred.find((d) => d.name === 'VSCrashTest')!;
    expect(crasher.verdict.status).toBe('deferred');
    expect(crasher.verdict.detail).toMatch(/crash/i);
    expect(crasher.verdict.detail).not.toMatch(PLANNED);
  });

  it('the first pass already settles the tests behind the crasher (one extra boot, not starvation)', async () => {
    const sim: Sim = { known: ALL, crasher: 'VSCrashTest' };
    const { spawn, boots } = simulatedEditor(sim);
    const v = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ALL, spawn, timeoutMs: 1000 });
    expect(boots).toHaveLength(2);
    expect(boots[1]).not.toContain('VSCrashTest'); // the resume boot excludes the crasher
    for (const n of ['VSAlphaTest', 'VSBetaTest', 'VSGammaTest', 'VSDeltaTest', 'VSEpsilonTest']) {
      expect(v.get(n)!.status).toBe('pass');
    }
  });

  it('a hung test (watchdog fired, no fatal marker) is a hang suspect and is excluded from the resume', async () => {
    const sim: Sim = { known: ALL, hang: 'VSBetaTest' };
    const { spawn, boots } = simulatedEditor(sim);
    const v = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ALL, spawn, timeoutMs: 1000 });
    expect(v.get('VSAlphaTest')!.status).toBe('pass');
    expect(v.get('VSBetaTest')!.status).toBe('deferred');
    expect(v.get('VSBetaTest')!.detail).toMatch(/hung|watchdog/i);
    expect(v.get('VSBetaTest')!.detail).not.toMatch(PLANNED);
    expect(v.get('VSEpsilonTest')!.status).toBe('pass');
    expect(boots).toHaveLength(2);
  });

  it('a crash before any test starts makes no progress: bounded boots, honest interrupted detail', async () => {
    const sim: Sim = { known: ALL, startupCrash: true };
    const { spawn, boots } = simulatedEditor(sim);
    const v = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ALL, spawn, timeoutMs: 1000 });
    expect(boots.length).toBeLessThanOrEqual(2);
    for (const n of ALL) {
      expect(v.get(n)!.status).toBe('deferred');
      expect(v.get(n)!.detail).not.toMatch(PLANNED);
      expect(v.get(n)!.detail).toMatch(/interrupted|cut short/i);
    }
  });
});

describe('floor: the paths the change must not touch', () => {
  it('a teardown fault after every test completed, with no report: the real tests keep their verdicts; the one unregistered name costs one bounded resume and ends "planned"', async () => {
    const { spawn, boots } = simulatedEditor({ known: ['VSAlphaTest'], teardownFatalNoReport: true });
    const v = await runBatchAutomation({
      editor: 'ue', uproject: 'p', testNames: ['VSAlphaTest', 'VSPlannedTest'], spawn, timeoutMs: 1000,
    });
    expect(v.get('VSAlphaTest')!.status).toBe('pass');
    // Boot 1 cannot tell a teardown fault from a crash, so the unobserved name is "not reached";
    // the resume boot ends cleanly, writes its report, and settles it as genuinely planned.
    expect(boots).toHaveLength(2);
    expect(boots[1]).toEqual(['VSPlannedTest']);
    expect(v.get('VSPlannedTest')!.detail).toMatch(/planned/);
  });

  it('a clean batch still costs exactly one boot and no resume', async () => {
    const { spawn, boots } = simulatedEditor({ known: ALL });
    const v = await runBatchAutomation({ editor: 'ue', uproject: 'p', testNames: ALL, spawn, timeoutMs: 1000 });
    expect(boots).toHaveLength(1);
    for (const n of ALL) expect(v.get(n)!.status).toBe('pass');
  });

  it('a genuinely unregistered test still reads "planned" with the scaffold note, on one boot', async () => {
    const { spawn, boots } = simulatedEditor({ known: ['VSAlphaTest'] });
    const v = await runBatchAutomation({
      editor: 'ue', uproject: 'p', testNames: ['VSAlphaTest', 'VSPlannedTest'], spawn, timeoutMs: 1000,
    });
    expect(boots).toHaveLength(1);
    expect(v.get('VSAlphaTest')!.status).toBe('pass');
    expect(v.get('VSPlannedTest')!.status).toBe('deferred');
    expect(v.get('VSPlannedTest')!.detail).toMatch(PLANNED);
    expect(v.get('VSPlannedTest')!.detail).toMatch(/scaffold available/);
  });
});
