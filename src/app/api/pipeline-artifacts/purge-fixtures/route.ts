import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { inventorySyntheticFixtures, purgeSyntheticFixtures, totalPurged } from '@/lib/catalog/artifact-purge';

/**
 * The fixture purge — the operator's one action for getting the test harness's residue out of
 * their real database, and the report of exactly what it removed.
 *
 * Test suites have been POSTing synthetic entities (`test-headless*`, `item-mcp-smoke`) into
 * `~/.pof/pof.db` for months, and nothing ever removed them: measured 2026-08-19, 344 of 817
 * `pipeline_artifacts` (42%), 114 `judge_verdicts`, 255 `judge_verdict_history` rows and 383
 * `pipeline_artifact_revisions`. `vitest.config.ts` now redirects the suite to a throwaway DB
 * so the pile stops growing; this route is how the existing pile goes.
 *
 *   GET  → the DRY RUN. What WOULD be removed, per entity and per table. Writes nothing.
 *   POST → executes, and reports real `changes()` per entity and per table.
 *
 * POST requires `{ expectRows }` matching a freshly-measured total. That is not ceremony: it
 * makes the destructive call impossible to issue without having read the dry run, and it fails
 * loudly (409, both numbers named) if the DB moved between looking and deciding.
 *
 * Nothing here runs on a schedule or at boot. The rows are evidence of a real defect and an
 * operator may be mid-investigation with them on screen — the trigger is theirs to pull.
 */
export async function GET() {
  try {
    const inv = inventorySyntheticFixtures();
    return apiSuccess({ ...inv, totalRows: totalPurged(inv.total) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Fixture inventory failed', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { expectRows?: unknown } | null;
    const expectRows = typeof body?.expectRows === 'number' ? body.expectRows : null;
    if (expectRows === null) {
      return apiError('expectRows is required — POST the row total from GET so a purge can never run unseen', 400);
    }

    const preview = inventorySyntheticFixtures();
    const actualRows = totalPurged(preview.total);
    if (actualRows !== expectRows) {
      return apiError(
        `Fixture rows changed since you looked — you approved ${expectRows}, the database now holds ${actualRows}. Nothing was deleted; re-read the inventory and confirm again.`,
        409,
      );
    }

    const result = purgeSyntheticFixtures();
    return apiSuccess({ ...result, totalRows: totalPurged(result.total) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Fixture purge failed', 500);
  }
}
