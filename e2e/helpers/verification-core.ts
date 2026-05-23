// Pure, side-effect-free verification helpers — unit-testable without UE or a
// browser. The shell-wrapping async helpers (runFunctionalTest,
// launchAndScreenshot, geminiCheck) live in ue-verification.ts and call these.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface FunctionalCriterion {
  /** The assertion message (the text inside `Assertion passed (...)`). */
  message: string;
  passed: boolean;
}

export interface FunctionalResult {
  /** True only if the engine reported success AND every parsed assertion passed. */
  success: boolean;
  criteria: FunctionalCriterion[];
  /** The last ~40 log lines, for findings docs / debugging. */
  rawTail: string;
}

/**
 * Parse a UE automation-test log into a structured result.
 *
 * Recognises the two shapes the vertical-slice functional tests emit:
 *   `... Assertion passed (#2 movement: ...)`
 *   `... Assertion failed (...)`
 * plus the framework summary `Result={Success}` / `Result={Failed}`.
 *
 * Success requires BOTH a `Result={Success}` line AND no failed assertion —
 * this guards the "the report said success but an assert was gamed/failed"
 * class the SP-B spec reviewer caught.
 */
export function parseAutomationLog(log: string): FunctionalResult {
  const criteria: FunctionalCriterion[] = [];
  for (const raw of log.split(/\r?\n/)) {
    const passed = /Assertion passed\s*\((.+)\)\s*$/i.exec(raw);
    if (passed) {
      criteria.push({ message: passed[1].trim(), passed: true });
      continue;
    }
    const failed = /Assertion failed\s*\((.+)\)\s*$/i.exec(raw);
    if (failed) {
      criteria.push({ message: failed[1].trim(), passed: false });
    }
  }
  const reportedSuccess = /Result=\{?\s*Success\s*\}?/i.test(log);
  const reportedFailure = /Result=\{?\s*(Fail|Failure|Error)/i.test(log);
  const anyFailed = criteria.some((c) => !c.passed);
  const success = reportedSuccess && !reportedFailure && !anyFailed;
  const lines = log.split(/\r?\n/);
  return { success, criteria, rawTail: lines.slice(-40).join('\n') };
}

/** Return the newest `*.png` in `dir` by mtime, or null if none / dir absent. */
export function pickNewestScreenshot(dir: string): string | null {
  if (!existsSync(dir)) return null;
  let newest: { path: string; mtimeMs: number } | null = null;
  for (const name of readdirSync(dir)) {
    if (!/\.png$/i.test(name)) continue;
    const path = join(dir, name);
    const mtimeMs = statSync(path).mtimeMs;
    if (!newest || mtimeMs > newest.mtimeMs) newest = { path, mtimeMs };
  }
  return newest ? newest.path : null;
}

/**
 * Resolve a Gemini prompt: if `promptOrName` matches a fixture file
 * `<fixturesDir>/<name>.txt`, return its contents; otherwise treat
 * `promptOrName` as a literal prompt. A fixture name is a short token with no
 * spaces (e.g. `hud-check`).
 */
export function resolveGeminiPrompt(promptOrName: string, fixturesDir: string): string {
  const looksLikeName = /^[\w-]+$/.test(promptOrName);
  if (looksLikeName) {
    const candidate = join(fixturesDir, `${promptOrName}.txt`);
    if (existsSync(candidate)) return readFileSync(candidate, 'utf-8').trim();
  }
  return promptOrName;
}

/** Build the argv for the gemini-recognize.mjs CLI. */
export function buildGeminiArgs(scriptPath: string, screenshotPath: string, prompt: string): string[] {
  return [scriptPath, '--input', screenshotPath, '--prompt', prompt];
}

export interface VerifyResult {
  /** A `ARPG.Verify.<system>:` line was found in the log. */
  found: boolean;
  /** The verdict, when found (`PASS` → true). */
  passed: boolean;
}

/**
 * Parse an `ARPG.Verify.<system>: PASS|FAIL (...)` line out of an engine log.
 * Used by the cooked smoke-pak / live PIE self-check on Development builds
 * (where logging is on). On Shipping builds logging is compiled out, so the
 * exit code is the signal instead — see runCookedVerifySlice.
 */
export function parseVerifyResult(log: string, system: string): VerifyResult {
  const re = new RegExp(`ARPG\\.Verify\\.${system}:\\s*(PASS|FAIL)`, 'i');
  const m = re.exec(log);
  if (!m) return { found: false, passed: false };
  return { found: true, passed: /pass/i.test(m[1]) };
}
