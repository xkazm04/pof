/**
 * The ONE parser for a UE automation `-abslog` — shared by BOTH consumers of the same
 * `Result={…}` truth:
 *  - the L3/L4 test-gate runner (`test-gate-runner/batchAutomation.ts`), and
 *  - the harness's own verification gates (`harness/ue-gates.ts`).
 *
 * Before this module each had its OWN hand-rolled regex block with a slightly different
 * vocabulary; drift between them was a latent honesty bug. The marker regexes now live
 * here ONCE. Judged by CONTENT markers, never exit code — headless `UnrealEditor-Cmd`
 * exits non-zero on the benign bridge-shutdown null-deref, so the process exit code is
 * not a reliable pass/fail signal.
 *
 * Deliberately dependency-free (imports nothing from `test-gate-runner` or `harness`) so
 * both siblings can import it without a cycle.
 */

// The automation controller emits `LogAutomationController: … Result={Success|Fail…}`;
// some project Python gates emit `[gate] RESULT=PASS/FAIL`. All four are the SAME truth.
const RESULT_PASS_RE = /Result=\{(?:Passed|Success)\}/gi;
const RESULT_FAIL_RE = /Result=\{(?:Failed|Fail(?:ure)?)\}/gi;
const GATE_PASS_RE = /\[gate\]\s*RESULT=PASS/i;
const GATE_FAIL_RE = /\[gate\]\s*RESULT=FAIL/i;
// The controller listed its test set but nothing matched the requested name → the test is
// PLANNED, not implemented (ground truth 2026-07 sweep: UE listed 8621 tests, matched zero
// for 29 planned VS*Test names). An honest deferred wait, NOT a red failure.
const LISTED_SET_RE = /\d+ tests available/i;
const COMPLETED_RE = /Test Completed/i;
const FATAL_RE = /Fatal error/i;
// Per-LINE variants (non-global — safe for repeated `.test()` in the per-test scoping loop).
const LINE_PASS_RE = /Result=\{(?:Passed|Success)\}|\[gate\]\s*RESULT=PASS/i;
const LINE_FAIL_RE = /Result=\{(?:Failed|Fail(?:ure)?)\}|\[gate\]\s*RESULT=FAIL/i;
const NAME_RE = /Name=\{([^}]*)\}/i;

/**
 * Zero-match vocabulary — ONE fact ("the run matched no test result marker"), two surfaced
 * words kept distinct for UI reasons (documented mapping, not accidental drift):
 *  - test-gate-runner surfaces `unregistered` → persisted as a `deferred` gate (an honest wait).
 *  - harness ue-gates surfaces `unverifiable` → the gate is honestly gapped, never a silent pass.
 * Each consumer maps from the neutral facts below to its own vocabulary.
 */
export const ZERO_MATCH_DETAIL =
  'no test matched the requested name (planned, not registered in UE)';

/** Neutral, counted facts read from a combined abslog — the single source both consumers map. */
export interface AbslogFacts {
  /** `Result={Passed|Success}` occurrences. */
  resultPass: number;
  /** `Result={Failed|Fail|Failure}` occurrences. */
  resultFail: number;
  /** `[gate] RESULT=PASS` present. */
  gatePass: boolean;
  /** `[gate] RESULT=FAIL` present. */
  gateFail: boolean;
  /** pass markers total (`resultPass` + gate pass). */
  passed: number;
  /** fail markers total (`resultFail` + gate fail). */
  failed: number;
  /** `passed + failed`. */
  total: number;
  /** The controller listed a test set ("N tests available") — the zero-match signal. */
  listedTestSet: boolean;
  /** A test ran to completion ("Test Completed"). */
  completed: boolean;
  /** A fatal/crash marker appeared. */
  fatal: boolean;
  /** The log is blank. */
  empty: boolean;
}

/** Read the marker facts from a whole abslog. Pure. */
export function readAbslogFacts(log: string): AbslogFacts {
  const s = log ?? '';
  const resultPass = (s.match(RESULT_PASS_RE) ?? []).length;
  const resultFail = (s.match(RESULT_FAIL_RE) ?? []).length;
  const gatePass = GATE_PASS_RE.test(s);
  const gateFail = GATE_FAIL_RE.test(s);
  const passed = resultPass + (gatePass ? 1 : 0);
  const failed = resultFail + (gateFail ? 1 : 0);
  return {
    resultPass,
    resultFail,
    gatePass,
    gateFail,
    passed,
    failed,
    total: passed + failed,
    listedTestSet: LISTED_SET_RE.test(s),
    completed: COMPLETED_RE.test(s),
    fatal: FATAL_RE.test(s),
    empty: !s.trim(),
  };
}

/** A per-test verdict scoped from a combined abslog. `none` = no per-test observation. */
export type PerTestStatus = 'pass' | 'fail' | 'none';
export interface PerTestAbslog {
  status: PerTestStatus;
  detail: string;
}

/**
 * Scope a COMBINED abslog (from `Automation RunTests A+B+C`) to a per-test verdict, so a
 * broken/missing structured report never smears ONE whole-batch verdict across every test.
 *
 * For each requested name we look ONLY at the log lines that belong to it and read that
 * test's OWN markers: a fail marker → fail; a pass marker and no fail → pass. A test whose
 * name is mentioned but carries no result marker, or is absent entirely, is `none` — it has
 * NO per-test observation and must NEVER inherit another test's pass (the exact A-passed +
 * B-crashed smear this replaces).
 *
 * Attribution is precise where UE gives it: a marker line almost always carries `Name={…}`,
 * so a line that names a DIFFERENT test is never mis-credited. Only marker lines with no
 * `Name={…}` (e.g. a project `[gate] RESULT=…` line) fall back to a raw substring mention.
 * Pure.
 */
export function scopeAbslogPerTest(
  log: string,
  testNames: readonly string[],
): Map<string, PerTestAbslog> {
  const lines = (log ?? '').split(/\r?\n/);
  const scored = lines.map((line) => {
    const nameMatch = line.match(NAME_RE);
    return {
      lower: line.toLowerCase(),
      pass: LINE_PASS_RE.test(line),
      fail: LINE_FAIL_RE.test(line),
      name: nameMatch ? nameMatch[1].toLowerCase() : null,
    };
  });

  // UE marker lines often carry only the LEAF test name (`Name={NPCConfig}`) while artifacts
  // declare the full dotted spec (`PoF.CharacterVael.NPCConfig`). A leaf may attribute to its
  // dotted owner ONLY when that leaf is unique within the requested batch — two tests sharing
  // a leaf stay unobserved (deferred) rather than risk mis-crediting either.
  const leafOf = (n: string) => n.slice(n.lastIndexOf('.') + 1);
  const leafCounts = new Map<string, number>();
  for (const n of testNames) {
    const leaf = leafOf(n.toLowerCase());
    leafCounts.set(leaf, (leafCounts.get(leaf) ?? 0) + 1);
  }

  const out = new Map<string, PerTestAbslog>();
  for (const name of testNames) {
    const lc = name.toLowerCase();
    const leaf = leafOf(lc);
    const leafUnique = leafCounts.get(leaf) === 1;
    let sawPass = false;
    let sawFail = false;
    let mentioned = false;
    for (const s of scored) {
      // A line that names a test owns ONLY that test; an unnamed line falls back to a mention.
      const belongs =
        s.name !== null
          ? s.name.includes(lc) || (leafUnique && (s.name === leaf || s.name.endsWith(`.${leaf}`)))
          : s.lower.includes(lc);
      if (!belongs) continue;
      mentioned = true;
      if (s.fail) sawFail = true;
      if (s.pass) sawPass = true;
    }
    if (sawFail) out.set(name, { status: 'fail', detail: `abslog(scoped): ${name} Result={Failure}` });
    else if (sawPass) out.set(name, { status: 'pass', detail: `abslog(scoped): ${name} Result={Success}` });
    else
      out.set(name, {
        status: 'none',
        detail: mentioned
          ? `abslog(scoped): ${name} mentioned but no per-test result marker (unobserved)`
          : `abslog(scoped): ${name} not observed in combined log`,
      });
  }
  return out;
}
