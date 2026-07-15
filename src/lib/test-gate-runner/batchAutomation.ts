/**
 * One boot, many gates — batch UE automation execution.
 *
 * The spawn executor used to boot a fresh `UnrealEditor-Cmd` for EVERY automation gate
 * (one `Automation RunTests <name>;Quit` boot each). With dozens of planned VS*Test /
 * ue-test steps, a full drain was dozens of multi-minute boots. UE automation runs many
 * filters in ONE session (`Automation RunTests A+B+C`) and emits a machine-readable
 * per-test report via `-ReportOutputPath=<dir>` (`index.json`). This module groups a
 * drain pass's automation jobs into ONE boot and recovers a per-test verdict from that
 * report — falling back to the combined `-abslog` marker parse when the report is missing
 * or unparseable (judged by log content, not exit code, per project convention).
 *
 * Pure parsers (`buildBatchAutomationArgs`, `parseAutomationReport`, `parseAbslogVerdict`)
 * are unit-tested; `runBatchAutomation` takes an injectable `spawn` so the boot-count is
 * asserted without ever launching a real editor.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from '@/lib/logger';
import type { GateEvidence } from '@/types/observation';
import { readAbslogFacts, scopeAbslogPerTest, ZERO_MATCH_DETAIL } from '@/lib/ue-automation/abslog';
import { annotateZeroMatchDetail } from '@/lib/ue-test-scaffold/generate';
import type { GateVerdict } from './types';

/** The watchdog-protected spawn seam (`spawnAndWait` in the executor); injectable for tests. */
export type SpawnFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ timedOut: boolean }>;

/**
 * Read a SINGLE whole-log verdict from an abslog — the marker vocabulary the runner uses
 * (`unregistered` → later mapped to a `deferred` gate). Delegates the marker truth to the
 * ONE shared parser (`@/lib/ue-automation/abslog`, also consumed by `harness/ue-gates`) —
 * no hand-rolled regex here anymore. Judged by markers, not exit code.
 *
 * Used by the single-boot `runAutomation` (ONE test per boot, so a whole-log verdict IS the
 * per-test verdict). The grouped-boot fallback below does NOT use this — it scopes the
 * combined log per test so a partial run can't smear one verdict across every test.
 * `spawnExecutor` re-exports it for API stability. Pure (tested).
 */
export function parseAbslogVerdict(log: string): { status: 'pass' | 'fail' | 'unregistered'; detail: string } {
  const f = readAbslogFacts(log);
  if (f.gatePass) return { status: 'pass', detail: '[gate] RESULT=PASS' };
  if (f.gateFail) return { status: 'fail', detail: '[gate] RESULT=FAIL' };
  if (f.resultPass > 0) return { status: 'pass', detail: 'Result={Success}' };
  if (f.resultFail > 0) return { status: 'fail', detail: 'Result={Failure}' };
  // Controller listed its set but nothing matched (and it neither completed a test nor crashed)
  // → PLANNED, not implemented: an honest deferred wait, NOT a red failure.
  if (f.listedTestSet && !f.completed && !f.fatal) {
    return { status: 'unregistered', detail: ZERO_MATCH_DETAIL };
  }
  // No success marker found → treat as failure (a crashed/aborted run never passed).
  return { status: 'fail', detail: 'no success marker in abslog' };
}

/**
 * Args for `UnrealEditor-Cmd` to run MANY automation tests in ONE headless boot:
 * `Automation RunTests A+B+C;Quit`, with `-ReportOutputPath=<dir>` so a machine-readable
 * per-test report (`index.json`) is written, plus the same `-abslog` fallback the single
 * path uses. Pure (tested).
 */
export function buildBatchAutomationArgs(
  testNames: readonly string[],
  uproject: string,
  abslog: string,
  reportDir: string,
): string[] {
  const filter = testNames.join('+');
  return [
    uproject,
    `-ExecCmds=Automation RunTests ${filter};Quit`,
    '-unattended',
    '-nopause',
    '-nosplash',
    '-nullrhi',
    '-log',
    `-abslog=${abslog}`,
    `-ReportOutputPath=${reportDir}`,
  ];
}

interface ReportEntry {
  fullTestPath?: string;
  testDisplayName?: string;
  state?: string;
  errors?: number;
}

/** A per-test result parsed from the automation report (before deferred mapping). */
export type ReportVerdict = { status: 'pass' | 'fail' | 'unregistered'; detail: string };

/**
 * Recover a per-test verdict for each requested name from the UE automation report JSON
 * (`index.json` written to `-ReportOutputPath`). Shape (ground truth):
 * `{ tests: [{ fullTestPath, testDisplayName, state:"Success"|"Fail"|"NotRun"|…, errors }] }`.
 * A name matched by path/display name that FAILED → fail; that succeeded → pass; matched but
 * never ran (NotRun/Skipped) or matched NOTHING → unregistered (an honest planned-wait, mapped
 * to `deferred` by the caller, never a red fail). Pure (tested).
 */
export function parseAutomationReport(
  report: unknown,
  testNames: readonly string[],
): Map<string, ReportVerdict> {
  const tests: ReportEntry[] =
    report && typeof report === 'object' && Array.isArray((report as { tests?: unknown }).tests)
      ? ((report as { tests: ReportEntry[] }).tests)
      : [];
  const out = new Map<string, ReportVerdict>();
  for (const name of testNames) {
    const lc = name.toLowerCase();
    const matched = tests.filter(
      (t) =>
        (typeof t.fullTestPath === 'string' && t.fullTestPath.toLowerCase().includes(lc)) ||
        (typeof t.testDisplayName === 'string' && t.testDisplayName.toLowerCase().includes(lc)),
    );
    if (!matched.length) {
      out.set(name, { status: 'unregistered', detail: 'no test matched the requested name (planned, not registered in UE)' });
      continue;
    }
    const anyFail = matched.some(entryFailed);
    const anySuccess = matched.some((t) => (t.state ?? '').toLowerCase().includes('success'));
    if (anyFail) {
      const n = matched.filter(entryFailed).length;
      out.set(name, { status: 'fail', detail: `report: ${n} failed / ${matched.length}` });
    } else if (anySuccess) {
      out.set(name, { status: 'pass', detail: `report: ${matched.length} passed` });
    } else {
      // Matched by name but never actually ran (NotRun/Skipped) — an honest wait, not a fail.
      out.set(name, { status: 'unregistered', detail: 'test matched but did not run (planned / not registered)' });
    }
  }
  return out;
}

function entryFailed(t: ReportEntry): boolean {
  const s = (t.state ?? '').toLowerCase();
  if (s.includes('fail')) return true;
  return typeof t.errors === 'number' && t.errors > 0;
}

/** Map a report/abslog `ReportVerdict` to a persisted `GateVerdict` (unregistered → deferred). */
function toVerdict(testName: string, r: ReportVerdict, source: 'report' | 'abslog'): GateVerdict {
  const status = r.status === 'unregistered' ? 'deferred' : r.status;
  const evidence: GateEvidence = { kind: 'automation', at: new Date().toISOString(), markers: [r.detail] };
  // A zero-match deferred is a PLANNED test — annotate that a scaffold can be generated for it, so
  // /status + the drain distinguish "planned, scaffold available" from an opaque deferred wait.
  const detail = r.status === 'unregistered'
    ? annotateZeroMatchDetail(`${testName}: ${r.detail}`)
    : `${testName}: ${r.detail}`;
  return { status, detail, evidence, raw: { source } };
}

export interface BatchAutomationOptions {
  editor: string;
  uproject: string;
  testNames: readonly string[];
  /** Injectable watchdog spawn (the boot). ONE call per batch — the whole point. */
  spawn: SpawnFn;
  timeoutMs: number;
}

/**
 * Run MANY automation gates in ONE `UnrealEditor-Cmd` boot and return a per-test verdict
 * map (keyed by the requested test name). Prefers the `-ReportOutputPath` report JSON for
 * per-test verdicts; falls back to scoping the combined `-abslog` PER TEST when the report
 * is missing/unparseable — so a partial run (A completed, B crashed) never smears one
 * whole-batch verdict across every test. A test with no per-test observation in the combined
 * log stays `deferred`, never inheriting a sibling's pass. Never spawns more than once; the
 * caller (spawn executor `prepareBatch`) invokes this once per drain pass. `testNames` are
 * de-duplicated by the caller.
 */
export async function runBatchAutomation(o: BatchAutomationOptions): Promise<Map<string, GateVerdict>> {
  const out = new Map<string, GateVerdict>();
  if (o.testNames.length === 0) return out;

  const reportDir = join(tmpdir(), `pof-batch-${Date.now()}`);
  await mkdir(reportDir, { recursive: true });
  const reportDirFwd = reportDir.replace(/\\/g, '/');
  const abslog = join(reportDir, 'batch.log');
  const abslogFwd = abslog.replace(/\\/g, '/');
  const args = buildBatchAutomationArgs(o.testNames, o.uproject, abslogFwd, reportDirFwd);

  const { timedOut } = await o.spawn(o.editor, args, o.timeoutMs);

  // Prefer the structured per-test report.
  const report = await readReport(reportDir);
  if (report) {
    const parsed = parseAutomationReport(report, o.testNames);
    for (const name of o.testNames) {
      const r = parsed.get(name) ?? { status: 'unregistered' as const, detail: 'absent from report (planned / not registered)' };
      out.set(name, toVerdict(name, r, 'report'));
    }
    return out;
  }

  // Fallback: no structured report. Scope the combined abslog PER TEST (judged by markers, not
  // exit code) so a partial run never smears one whole-batch verdict across every test — a test
  // with no per-test observation stays deferred, never inheriting a sibling's pass.
  const log = await readFile(abslog, 'utf-8').catch((e) => {
    logger.warn(`[test-gate-runner] batch automation: no report and no abslog at ${reportDir} (${e instanceof Error ? e.message : String(e)})`);
    return '';
  });
  if (!log) {
    // Nothing to judge from — every test stays an honest deferred wait (never a fabricated pass/fail).
    const detail = `no report and no abslog${timedOut ? ' (watchdog timeout)' : ''}`;
    for (const name of o.testNames) out.set(name, toVerdict(name, { status: 'unregistered', detail }, 'abslog'));
    return out;
  }
  const perTest = scopeAbslogPerTest(log, o.testNames);
  for (const name of o.testNames) {
    const r = perTest.get(name)!;
    // `none` (no per-test observation in the combined log) → unregistered → deferred (honest wait).
    const rv: ReportVerdict =
      r.status === 'none' ? { status: 'unregistered', detail: r.detail } : { status: r.status, detail: r.detail };
    out.set(name, toVerdict(name, rv, 'abslog'));
  }
  return out;
}

/** Read + parse the automation report `index.json`; null on miss/unparseable. */
async function readReport(reportDir: string): Promise<unknown | null> {
  const raw = await readFile(join(reportDir, 'index.json'), 'utf-8').catch(() => '');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    logger.warn(`[test-gate-runner] batch automation: unparseable report index.json (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}
