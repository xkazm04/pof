/**
 * A fatal marker outranks a pass marker in the same abslog (engine-integration-safety,
 * judge-by-log-markers-not-exit-code): a run that passed and then crashed did not cleanly pass.
 *
 * `parseAutomationLog` judges the harness's opt-in `ue-test` gate. It used to read the pass/fail
 * counts and never `fatal`, so two `Result={Success}` markers followed by a crash read as
 * "2 automation test(s) passed" while the rest of the suite was never observed. The runner's batch
 * path was fixed for the same family in 9a64fd4b; this is the harness path.
 *
 * The logs below are SYNTHETIC - built from the markers the shared parser reads, in the vocabulary
 * the runner's own crash tests use. No real UE crash log exists in the tree, so what is proven is
 * the classification, not UE's real log format. Nothing here launches an engine.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// `verify()` shells out through child_process.exec; replace ONLY that so the ue-test gate can be
// driven end to end on a pre-written abslog without any process being spawned.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: (_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
      cb(null, '', '');
      return { kill: () => undefined };
    },
  };
});

import { parseAutomationLog, type AutomationVerdict } from '@/lib/harness/ue-gates';
import { readAbslogFacts } from '@/lib/ue-automation/abslog';
import { verify } from '@/lib/harness/verifier';
import { tallyGateVerdicts, formatGateCoverageLines, type GateVerdictTally } from '@/lib/harness/orchestrator';
import type { ModuleArea, VerificationGate } from '@/lib/harness/types';

// ── the five paired logs ─────────────────────────────────────────────────────

const LOGS = {
  twoSuccessThenFatal: [
    'LogAutomationController: 3 tests available',
    'LogAutomationController: Test Completed. Result={Success} Name={Project.PoF.A}',
    'LogAutomationController: Test Completed. Result={Success} Name={Project.PoF.B}',
    'LogAutomationController: Beginning test Project.PoF.C',
    'Fatal error! [File:Engine] crash',
  ].join('\n'),
  twoCleanSuccesses: [
    'LogAutomationController: 2 tests available',
    'LogAutomationController: Test Completed. Result={Success} Name={Project.PoF.A}',
    'LogAutomationController: Test Completed. Result={Success} Name={Project.PoF.B}',
  ].join('\n'),
  oneFailureThenFatal: [
    'LogAutomationController: 3 tests available',
    'LogAutomationController: Test Completed. Result={Failed} Name={Project.PoF.A}',
    'LogAutomationController: Beginning test Project.PoF.B',
    'Fatal error! [File:Engine] crash',
  ].join('\n'),
  empty: '',
  zeroMatch: [
    'LogAutomationController: 8621 tests available',
    'LogAutomationController: Automation Test Queue Empty',
  ].join('\n'),
} as const;
type LogName = keyof typeof LOGS;
const NAMES = Object.keys(LOGS) as LogName[];

/**
 * ARM A - the control. Master's `parseAutomationLog` as it stood at 5bfca4c8, carried inline so the
 * comparison stays reproducible after the fix lands: it reads the same shared facts and never
 * reads `fatal`.
 */
function armA(log: string): AutomationVerdict {
  const f = readAbslogFacts(log);
  const { passed, failed, total } = f;
  if (f.empty) {
    return { verdict: 'unverifiable', total: 0, passed: 0, failed: 0, reason: 'Empty automation log — nothing to verify' };
  }
  if (total === 0) {
    return { verdict: 'unverifiable', total, passed, failed, reason: 'Automation filter matched 0 tests — cannot verify (not a failure)' };
  }
  if (failed > 0) {
    return { verdict: 'fail', total, passed, failed, reason: `${failed} of ${total} automation test(s) failed` };
  }
  return { verdict: 'pass', total, passed, failed, reason: `${passed} automation test(s) passed` };
}

/**
 * What the UNCHANGED function on master returned for the five logs, recorded before the edit by
 * running `parseAutomationLog` itself. Pinning the inline control to these is what makes `armA`
 * a faithful stand-in for master rather than a re-statement of the fix.
 */
const RECORDED_MASTER: Record<LogName, AutomationVerdict> = {
  twoSuccessThenFatal: { verdict: 'pass', total: 2, passed: 2, failed: 0, reason: '2 automation test(s) passed' },
  twoCleanSuccesses: { verdict: 'pass', total: 2, passed: 2, failed: 0, reason: '2 automation test(s) passed' },
  oneFailureThenFatal: { verdict: 'fail', total: 1, passed: 0, failed: 1, reason: '1 of 1 automation test(s) failed' },
  empty: { verdict: 'unverifiable', total: 0, passed: 0, failed: 0, reason: 'Empty automation log — nothing to verify' },
  zeroMatch: { verdict: 'unverifiable', total: 0, passed: 0, failed: 0, reason: 'Automation filter matched 0 tests — cannot verify (not a failure)' },
};

const CRASH_REASON = '2 automation test(s) passed, then the run crashed (fatal error in the log) - the rest of the suite was never observed';

describe('paired A/B on the same five logs (arm A = master, arm B = the change)', () => {
  it('the inline control reproduces what master actually returned', () => {
    for (const n of NAMES) expect(armA(LOGS[n]), n).toEqual(RECORDED_MASTER[n]);
  });

  it('arm B moves exactly one row: [two successes then fatal] pass -> unverifiable', () => {
    const moved = NAMES.filter((n) => JSON.stringify(parseAutomationLog(LOGS[n])) !== JSON.stringify(armA(LOGS[n])));
    expect(moved).toEqual(['twoSuccessThenFatal']);
    expect(armA(LOGS.twoSuccessThenFatal).verdict).toBe('pass');
    expect(parseAutomationLog(LOGS.twoSuccessThenFatal)).toEqual({
      verdict: 'unverifiable', total: 2, passed: 2, failed: 0, reason: CRASH_REASON,
    });
  });

  it.each(['twoCleanSuccesses', 'oneFailureThenFatal', 'empty', 'zeroMatch'] as const)(
    'floor: %s keeps its verdict AND its reason string, byte for byte',
    (n) => {
      expect(parseAutomationLog(LOGS[n])).toEqual(RECORDED_MASTER[n]);
    },
  );
});

describe('parseAutomationLog - a fatal marker outranks a pass marker', () => {
  it('passes then crashes: unverifiable, naming the counts and the crash (not pass, not fail)', () => {
    const v = parseAutomationLog(LOGS.twoSuccessThenFatal);
    expect(v.verdict).toBe('unverifiable');
    expect(v.passed).toBe(2);
    expect(v.failed).toBe(0);
    expect(v.reason).toMatch(/2 automation test\(s\) passed/);
    expect(v.reason).toMatch(/crashed/);
    expect(v.reason).toMatch(/never observed/);
  });

  it('a failure observed before the crash stays a fail: something WAS seen failing', () => {
    const v = parseAutomationLog(LOGS.oneFailureThenFatal);
    expect(v.verdict).toBe('fail');
    expect(v.reason).toBe('1 of 1 automation test(s) failed');
  });

  it('a pass, a failure and then a crash is a fail, not unverifiable', () => {
    const log = [LOGS.twoSuccessThenFatal.split('\n')[1], 'Result={Failed} Name={Project.PoF.B}', 'Fatal error! [File:Engine] crash'].join('\n');
    const v = parseAutomationLog(log);
    expect(v.verdict).toBe('fail');
    expect(v.reason).toBe('1 of 2 automation test(s) failed');
  });

  it('the project [gate] RESULT=PASS marker counts as a pass and is outranked the same way', () => {
    const v = parseAutomationLog('[gate] RESULT=PASS\nFatal error! [File:Engine] crash');
    expect(v.verdict).toBe('unverifiable');
    expect(v.reason).toBe('1 automation test(s) passed, then the run crashed (fatal error in the log) - the rest of the suite was never observed');
  });

  it('a crash before any test result keeps the zero-match reading (the change does not reach it)', () => {
    const v = parseAutomationLog('LogAutomationController: 3 tests available\nFatal error! [File:Startup] crash');
    expect(v).toEqual({
      verdict: 'unverifiable', total: 0, passed: 0, failed: 0,
      reason: 'Automation filter matched 0 tests — cannot verify (not a failure)',
    });
  });
});

describe('CONSCIOUS TRADE-OFF: a benign teardown fault after a clean run reads unverifiable', () => {
  // The project's own notes say a headless editor can exit non-zero on a benign shutdown
  // null-deref after a clean run (abslog.ts, ue-gates.ts header). Whether that fault prints
  // `Fatal error` into the abslog is UNMEASURED: no real log is in the tree. If it does, every
  // clean run that hits it flips from `pass` to `unverifiable`, which is the price of refusing
  // to read a crash-truncated suite as a pass: a log alone cannot tell the two apart (the runner's
  // own crash tests model the same ambiguity, `teardownFatalNoReport`). The teardown line below is
  // that simulation, NOT a captured log.
  //
  // The gate is advisory and an `unverifiable` blocks nothing, so the cost is a missing green
  // tick on a run that was in fact clean. The instrument that settles it: ONE captured clean-run
  // abslog with its teardown tail (and its exit status) from a real headless run; if the benign
  // fault leaves no `Fatal error` line this risk is empty, and if it does the marker needs a
  // narrower pattern (see abslog.ts, owned by the shared parser, not changed here).
  const cleanThenBenignTeardown = [
    LOGS.twoCleanSuccesses,
    'LogAutomationController: Test Queue Empty',
    'Fatal error! [File:Teardown] null deref during shutdown',
  ].join('\n');

  it('flips from pass (master) to unverifiable (the change): documented, not accidental', () => {
    expect(armA(cleanThenBenignTeardown).verdict).toBe('pass');
    const v = parseAutomationLog(cleanThenBenignTeardown);
    expect(v.verdict).toBe('unverifiable');
    expect(v.passed).toBe(2);
    expect(v.reason).toBe(CRASH_REASON);
  });
});

// ── what a consumer does with the new verdict ────────────────────────────────

describe('the ue-test gate through verify(): an unverifiable is not a pass, and not a blocker when advisory', () => {
  const area: ModuleArea = {
    id: 'a', moduleId: 'arpg-combat' as never, label: 'A', description: '',
    checklistItemIds: [], featureNames: [], dependsOn: [], status: 'in-progress', features: [],
  };

  async function runGate(log: string, required: boolean) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-gates-fatal-'));
    const file = path.join(dir, 'ue-tests-1.log');
    fs.writeFileSync(file, log, 'utf-8');
    const saved = { cmd: process.env.POF_UE_EDITOR_CMD, proj: process.env.POF_UE_UPROJECT };
    process.env.POF_UE_EDITOR_CMD = 'C:/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
    process.env.POF_UE_UPROJECT = 'C:/Unreal Projects/PoF/PoF.uproject';
    try {
      const gates: VerificationGate[] = [{ name: 'ue-tests', type: 'ue-test', required, filter: 'Project' }];
      return await verify(area, 1, os.tmpdir(), gates, dir);
    } finally {
      if (saved.cmd === undefined) delete process.env.POF_UE_EDITOR_CMD; else process.env.POF_UE_EDITOR_CMD = saved.cmd;
      if (saved.proj === undefined) delete process.env.POF_UE_UPROJECT; else process.env.POF_UE_UPROJECT = saved.proj;
      fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  }

  it('advisory: the crash-truncated run is unverifiable, requiredFailures stays 0, nothing is healed or blocked', async () => {
    const report = await runGate(LOGS.twoSuccessThenFatal, false);
    const g = report.gates[0];
    expect(g.passed).toBe(false);
    expect(g.unverifiable).toBe(true);
    expect(g.errors).toBeUndefined(); // not a fail: no error to heal
    expect(g.output).toContain('then the run crashed');
    expect(report.requiredFailures).toBe(0);
  });

  it('the run-end coverage line names the gate as returning NO real verdict (it was a "pass" before)', async () => {
    const report = await runGate(LOGS.twoSuccessThenFatal, false);
    const tally: Record<string, GateVerdictTally> = {};
    tallyGateVerdicts(tally, report);
    expect(tally['ue-tests']).toEqual({ pass: 0, fail: 0, unverifiable: 1 });
    const [line] = formatGateCoverageLines(tally, [{ name: 'ue-tests', required: false }]);
    expect(line).toContain('returned NO verdict this run (1 unverifiable, 0 real verdicts)');
  });

  it('floor: a clean log still passes the gate', async () => {
    const report = await runGate(LOGS.twoCleanSuccesses, false);
    expect(report.gates[0].passed).toBe(true);
    expect(report.gates[0].unverifiable).toBe(false);
    expect(report.allPassed).toBe(true);
  });

  it('a hand-built REQUIRED ue-test gate does count it as a required failure (detectUeGates never builds one)', async () => {
    const report = await runGate(LOGS.twoSuccessThenFatal, true);
    expect(report.gates[0].unverifiable).toBe(true);
    expect(report.requiredFailures).toBe(1);
  });
});
