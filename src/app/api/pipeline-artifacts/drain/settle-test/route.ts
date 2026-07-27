/**
 * POST /api/pipeline-artifacts/drain/settle-test
 * Body: { testName, result, tier?, catalogId?, entityId?, entityIds? }
 *
 * Settle the deferred L3 gates waiting on `testName` from a UE automation payload the CALLER
 * already obtained (the body of `POST /pof/test/run-automation` or `GET /pof/test/results`).
 * This is what closes the agent loop: `pof_ue_run_tests` could run the exact test a gate was
 * waiting on and the gate stayed deferred, because only the drain ever wrote back.
 *
 * It runs NOTHING — no editor, no executor. It reuses the runner's per-test truth wholesale
 * (`settleGatesFromTestRun`): the same test-name recovery, the same payload→verdict mapping
 * (a plugin `not_found` is the same honest `deferred`, a non-terminal payload settles nothing),
 * and the same `applyVerdict` write-back the drain uses.
 *
 * **Lease.** It takes the SAME drain lease as `/api/pipeline-artifacts/drain` for the scope it
 * would write, and 409s when a drain holds it — so a settle can never clobber a drain that is
 * mid-flight against those rows. A no-match settle still reports success (it changed nothing)
 * and says so, rather than implying a flip.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseDrainFilter, type DrainFilter } from '@/lib/test-gate-runner';
import { settleGatesFromTestRun } from '@/lib/test-gate-runner/settleFromTest';
import { acquireLeases, releaseLeases, scopeFromKey, leaseKeysForFilter } from '@/lib/test-gate-runner/drain-lease';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      testName?: string; result?: unknown;
      tier?: string; catalogId?: string; entityId?: string; entityIds?: string[];
    };
    const testName = typeof body.testName === 'string' ? body.testName.trim() : '';
    if (!testName) return apiError('"testName" (non-empty string) is required', 400);
    if (body.result === undefined) {
      return apiError('"result" (the raw UE automation payload from the bridge) is required', 400);
    }
    // Same scope surface as the drain, so a settle can be narrowed exactly like a drain can.
    const filter: DrainFilter = parseDrainFilter((k) => body[k]);

    const keys = leaseKeysForFilter(filter);
    const acquired = acquireLeases(keys);
    if (!acquired.ok) {
      return apiError(`drain in flight for ${scopeFromKey(acquired.conflict)} — refusing to settle over it`, 409);
    }
    try {
      return apiSuccess(settleGatesFromTestRun(testName, body.result, filter));
    } finally {
      releaseLeases(keys);
    }
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'settle-test POST failed', 500);
  }
}
