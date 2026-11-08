import {
  FlaskConical, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { ok, err, type Result } from '@/types/result';
import type { PofTestResult, PofTestSpec } from '@/types/pof-bridge';
import type { SuiteRunResult } from './types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A suite's verdict over what actually ran. `passed` needs every expected scenario back and
 * passing and every configured snapshot compared; a run that observed nothing is `error`.
 */
export function deriveSuiteStatus(run: {
  results: readonly PofTestResult[];
  expectedCount: number;
  /** Presets were captured and the read-back report did not pass (or never came). */
  snapshotsFailed: boolean;
  /** Presets are configured but the run stopped before capturing them. */
  snapshotsSkipped: boolean;
}): SuiteRunResult['status'] {
  const { results, expectedCount, snapshotsFailed, snapshotsSkipped } = run;
  if (snapshotsFailed || results.some((r) => r.status === 'failed' || r.status === 'error' || r.status === 'timeout')) {
    return 'failed';
  }
  if (results.length === 0) return 'error';
  const complete = results.length >= expectedCount && !snapshotsSkipped;
  return complete && results.every((r) => r.status === 'passed') ? 'passed' : 'partial';
}

// ── Scenarios JSON draft ─────────────────────────────────────────────────────

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isVector = (x: unknown) => Array.isArray(x) && x.length === 3 && x.every((n) => typeof n === 'number');
const hasStrings = (x: Record<string, unknown>, keys: readonly string[]) => keys.every((k) => typeof x[k] === 'string');

/** What is wrong with one scenario, or null when it has the PofTestSpec shape. */
function scenarioProblem(s: unknown): string | null {
  if (!isObject(s)) return 'must be an object';
  if (typeof s.testId !== 'string' || s.testId === '') return 'testId must be a non-empty string';
  if (typeof s.description !== 'string') return 'description must be a string';
  if (typeof s.timeout !== 'number' || !Number.isFinite(s.timeout)) return 'timeout must be a number';
  if (s.cleanup !== 'destroyAll' && s.cleanup !== 'none') return 'cleanup must be "destroyAll" or "none"';
  const spawnOk = (e: unknown) => isObject(e) && hasStrings(e, ['spawn', 'tag']) && isVector(e.location) && isVector(e.rotation);
  if (!Array.isArray(s.setup) || !s.setup.every(spawnOk)) return 'setup entries need spawn, tag, location [x,y,z] and rotation [x,y,z]';
  const actionOk = (e: unknown) => isObject(e) && (e.type === 'call' || e.type === 'wait');
  if (!Array.isArray(s.actions) || !s.actions.every(actionOk)) return 'actions entries need a type of "call" or "wait"';
  const assertionOk = (e: unknown) => isObject(e) && hasStrings(e, ['id', 'target', 'property', 'operator', 'description']);
  if (!Array.isArray(s.assertions) || !s.assertions.every(assertionOk)) return 'assertions entries need id, target, property, operator and description';
  return null;
}

/** The one reading of the JSON editor's text: Apply's enablement and the apply itself both use it. */
export function parseScenariosDraft(draft: string): Result<PofTestSpec[], string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft);
  } catch (e) {
    return err(e instanceof SyntaxError ? e.message : 'Invalid JSON');
  }
  if (!Array.isArray(parsed)) return err('Scenarios must be a JSON array, e.g. [ { … } ]');
  const seen = new Set<string>();
  for (const [i, s] of parsed.entries()) {
    const problem = scenarioProblem(s);
    if (problem) return err(`Scenario #${i + 1}: ${problem}`);
    const { testId } = s as PofTestSpec;
    if (seen.has(testId)) return err(`Scenario #${i + 1}: duplicate testId "${testId}"`);
    seen.add(testId);
  }
  return ok(parsed as PofTestSpec[]);
}

// ── Status helpers ───────────────────────────────────────────────────────────

export function testStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'error': return STATUS_ERROR;
    case 'timeout': return STATUS_WARNING;
    case 'running': return ACCENT_CYAN;
    default: return STATUS_NEUTRAL;
  }
}

export function testStatusIcon(status: string) {
  switch (status) {
    case 'passed': return CheckCircle2;
    case 'failed': return XCircle;
    case 'error': return AlertTriangle;
    case 'timeout': return Clock;
    case 'running': return Loader2;
    default: return FlaskConical;
  }
}

export function snapshotStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'no-baseline': return STATUS_WARNING;
    case 'resolution-mismatch': return ACCENT_ORANGE;
    default: return STATUS_NEUTRAL;
  }
}
