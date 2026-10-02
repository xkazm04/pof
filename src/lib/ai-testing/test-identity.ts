/**
 * The ONE scenario <-> UE automation test identity for the AI Testing Sandbox.
 *
 * Generate All, Generate Single and Run all name a scenario's test through here,
 * and `record-run-results` grades each scenario from UE's automation report by the
 * same prefix — so a green pill means UE ran THAT scenario's test and it passed.
 *
 *   test path   AI.BehaviorTests.<Class>.S<id>_<Slug>
 *   test prefix AI.BehaviorTests.<Class>.S<id>_        (rename-proof: keyed by id)
 *
 * The prefix is prefix-free by id: `S1_` never matches `S12_...` (UE's RunTests
 * filter and `parseAutomationReport` both match by substring). The slug keeps only
 * `[A-Za-z0-9_]`, so a scenario name can never inject a `.` hierarchy level.
 */
import type { TestScenario, TestSuite } from '@/types/ai-testing';

export const AI_TEST_ROOT = 'AI.BehaviorTests';

/** Where a sandbox run's UE report lives, relative to the project root. */
export const AI_TEST_REPORT_SUBDIR = 'Saved/Automation/PoF-AITests';

const RUN_ID_RE = /^r-[a-z0-9]{8}$/;

/** Reduce any text to a UE-test-path-safe identifier segment (`[A-Za-z0-9_]`, never empty). */
export function aiTestSlug(text: string, fallback = 'Scenario'): string {
  const slug = text.replace(/[^A-Za-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return slug || fallback;
}

/** `AI.BehaviorTests.<Class>.S<id>_` — the per-scenario RunTests filter and report match key. */
export function aiScenarioTestPrefix(
  suite: Pick<TestSuite, 'targetClass'>,
  scenario: Pick<TestScenario, 'id'>,
): string {
  return `${AI_TEST_ROOT}.${aiTestSlug(suite.targetClass, 'Target')}.S${scenario.id}_`;
}

/** `AI.BehaviorTests.<Class>.S<id>_<Slug>` — the exact name a generated test registers under. */
export function aiScenarioTestPath(
  suite: Pick<TestSuite, 'targetClass'>,
  scenario: Pick<TestScenario, 'id' | 'name'>,
): string {
  return `${aiScenarioTestPrefix(suite, scenario)}${aiTestSlug(scenario.name)}`;
}

/** A fresh run id (`r-` + 8 lowercase base-36 chars) naming one Run Tests dispatch. */
export function newAiTestRunId(): string {
  let id = '';
  while (id.length < 8) id += Math.random().toString(36).slice(2);
  return `r-${id.slice(0, 8)}`;
}

export function isAiTestRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID_RE.test(value);
}

/** `<projectPath>/Saved/Automation/PoF-AITests/<runId>`, forward slashes (UE accepts them on Windows). */
export function aiTestReportDir(projectPath: string, runId: string): string {
  const root = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return `${root}/${AI_TEST_REPORT_SUBDIR}/${runId}`;
}

/**
 * The server reads ONLY `index.json` under a directory this accepts: absolute, no
 * `..`, and ending in exactly `Saved/Automation/PoF-AITests/<runId>` for this run.
 */
export function isAiTestReportDir(dir: unknown, runId: string): dir is string {
  if (typeof dir !== 'string' || !isAiTestRunId(runId)) return false;
  const norm = dir.replace(/\\/g, '/');
  if (norm.includes('..')) return false;
  if (!/^([A-Za-z]:\/|\/)/.test(norm)) return false;
  return norm.endsWith(`/${AI_TEST_REPORT_SUBDIR}/${runId}`);
}
