/**
 * Sandbox run verdicts, derived from UE's automation report — never from the CLI.
 *
 * The CLI agent that built and ran the tests used to write its own grade into
 * `record-run-results`. Now each scenario of the run is matched in UE's
 * `index.json` by its `S<id>_` prefix (see `test-identity.ts`) through the same
 * `parseAutomationReport` the test-gate runner uses:
 *
 *   report pass          -> passed
 *   report fail          -> failed
 *   matched nothing/NotRun -> error ("no UE automation test matched <prefix>")
 *   no report at all     -> error ("no automation report ...")
 *
 * The CLI's claim survives only as a note appended to the output text. Every
 * scenario id of the run gets a verdict, so none is ever left 'running'. Pure.
 */
import { parseAutomationReport } from '@/lib/test-gate-runner/batchAutomation';
import type { TestSuite } from '@/types/ai-testing';
import { aiScenarioTestPrefix } from './test-identity';

export type RunVerdictStatus = 'passed' | 'failed' | 'error';

/** What the CLI said about a scenario — kept as a note, never as the grade. */
export interface RunClaim {
  scenarioId: number;
  status?: unknown;
  output?: unknown;
}

export interface ScenarioRunVerdict {
  scenarioId: number;
  status: RunVerdictStatus;
  output: string;
  testPrefix: string;
}

function claimNote(claim: RunClaim | undefined): string {
  if (!claim) return '';
  const status = typeof claim.status === 'string' ? claim.status : 'no status';
  const text = typeof claim.output === 'string' && claim.output.trim() ? `: ${claim.output.trim()}` : '';
  return `\n\nCLI note (claimed ${status})${text}`;
}

/** Normalize an untrusted `results` array into claims keyed by scenario id. */
export function claimsById(results: unknown): Map<number, RunClaim> {
  const out = new Map<number, RunClaim>();
  if (!Array.isArray(results)) return out;
  for (const r of results) {
    const id = Number((r as { scenarioId?: unknown } | null)?.scenarioId);
    if (Number.isInteger(id)) out.set(id, r as RunClaim);
  }
  return out;
}

export function deriveRunVerdicts(
  report: unknown | null,
  scenarioIds: readonly number[],
  claims: unknown,
  suite: Pick<TestSuite, 'targetClass'>,
): ScenarioRunVerdict[] {
  const byId = claimsById(claims);
  const prefixes = scenarioIds.map((id) => aiScenarioTestPrefix(suite, { id }));
  const parsed = report ? parseAutomationReport(report, prefixes) : null;

  return scenarioIds.map((scenarioId, i) => {
    const testPrefix = prefixes[i];
    const note = claimNote(byId.get(scenarioId));
    if (!parsed) {
      return {
        scenarioId,
        testPrefix,
        status: 'error',
        output: `no automation report - UE wrote no index.json for this run, so ${testPrefix}* was not graded${note}`,
      };
    }
    const r = parsed.get(testPrefix);
    if (r?.status === 'pass') return { scenarioId, testPrefix, status: 'passed', output: `${testPrefix}* ${r.detail}${note}` };
    if (r?.status === 'fail') return { scenarioId, testPrefix, status: 'failed', output: `${testPrefix}* ${r.detail}${note}` };
    return {
      scenarioId,
      testPrefix,
      status: 'error',
      output: `no UE automation test matched ${testPrefix} - generate the test (${r?.detail ?? 'absent from report'})${note}`,
    };
  });
}
