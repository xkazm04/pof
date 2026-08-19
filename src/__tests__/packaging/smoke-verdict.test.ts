/**
 * The smoke test is the ONLY thing that proves the packaged `.exe` actually runs —
 * so its verdict must land on the build it verified, must not destroy what else is
 * recorded there, and must be able to CONDEMN that build.
 *
 * On the interactive path it did none of the three:
 *   • it chose the build with an UNSCOPED query, so with the live DB's two candidate
 *     legacy rows (ids 5 and 6, Win64/Shipping/success, 2026-05-21) the next cook's
 *     verdict would be UPDATEd onto build #6 from May;
 *   • it `UPDATE`d `notes` WHOLESALE, destroying the `[SIZE_BUDGET]` note
 *     `execute/route.ts` had written moments earlier;
 *   • it never touched `status`, so a build whose exe died in 25 s stayed
 *     `status='success'` in history forever.
 *
 * The SCHEDULED runner already classifies correctly (`smokeFailed ? 'failed' :
 * 'success'`). These tests converge the interactive path onto it — the runner itself
 * is deliberately unchanged.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-smoke-verdict-${process.pid}.db`;
});

import { getDb } from '@/lib/db';
import {
  insertBuild,
  getBuild,
  updateBuildNotes,
  appendBuildNote,
  attachSmokeResultToLatestBuild,
} from '@/lib/packaging/build-history-store';
import { extractRegressionNote, SIZE_REGRESSION_NOTE_PREFIX } from '@/lib/packaging/size-budgets';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';
const SIZE_NOTE = `${SIZE_REGRESSION_NOTE_PREFIX} package grew 14% over build #12 (2.1 GB → 2.4 GB)`;
const FAIL_NOTE = 'smoke-test: fail (PoF-Win64-Shipping.exe not alive after 25s)';
const PASS_NOTE = 'smoke-test: pass (PoF-Win64-Shipping.exe survived 25s)';

beforeEach(() => {
  getDb().prepare('DELETE FROM build_history').run();
});

function greenBuild(projectId?: string | null) {
  return insertBuild({
    projectId, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 2 * 1024 ** 3,
  });
}

describe('a failed smoke test condemns the build it verified', () => {
  it('flips status to failed — the same classification the scheduled runner makes', () => {
    const rec = greenBuild(PROJECT_A);
    expect(rec.status).toBe('success');

    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', FAIL_NOTE, PROJECT_A, 'fail');

    expect(out.build?.id).toBe(rec.id);
    expect(getBuild(rec.id)!.status).toBe('failed');
    expect(out.previousStatus).toBe('success');
    expect(out.statusChanged).toBe(true);
  });

  it('records WHY it failed, so history is not a bare status flip', () => {
    const rec = greenBuild(PROJECT_A);
    attachSmokeResultToLatestBuild('Win64', 'Shipping', FAIL_NOTE, PROJECT_A, 'fail');
    expect(getBuild(rec.id)!.errorSummary).toBe(FAIL_NOTE);
  });

  it('a PASSING smoke leaves the build green and reports no change', () => {
    const rec = greenBuild(PROJECT_A);
    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', PASS_NOTE, PROJECT_A, 'pass');

    expect(getBuild(rec.id)!.status).toBe('success');
    expect(out.statusChanged).toBe(false);
    expect(out.previousStatus).toBe('success');
  });
});

describe('the smoke note is APPENDED, never a wholesale replace', () => {
  it('a [SIZE_BUDGET] note written moments earlier survives the smoke verdict', () => {
    const rec = greenBuild(PROJECT_A);
    // Exactly what execute/route.ts does after measuring the cook.
    updateBuildNotes(rec.id, SIZE_NOTE);

    attachSmokeResultToLatestBuild('Win64', 'Shipping', FAIL_NOTE, PROJECT_A, 'fail');

    const notes = getBuild(rec.id)!.notes!;
    expect(extractRegressionNote(notes)).toBe(SIZE_NOTE);
    expect(notes).toContain(FAIL_NOTE);
  });

  it('appendBuildNote is a no-op-safe append on an empty notes column', () => {
    const rec = greenBuild(PROJECT_A);
    appendBuildNote(rec.id, 'first');
    appendBuildNote(rec.id, 'second');
    expect(getBuild(rec.id)!.notes).toBe('first\nsecond');
  });
});

describe('the verdict lands on THIS project\'s build, not the newest one anywhere', () => {
  it('does not touch another project\'s build', () => {
    const theirs = greenBuild(PROJECT_B);
    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', FAIL_NOTE, PROJECT_A, 'fail');

    expect(out.build).toBeNull();
    expect(getBuild(theirs.id)!.status).toBe('success');
    expect(getBuild(theirs.id)!.notes).toBeNull();
  });

  it('an unscoped verdict cannot reach a project-owned build', () => {
    const owned = greenBuild(PROJECT_A);
    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', FAIL_NOTE, null, 'fail');

    expect(out.build).toBeNull();
    expect(getBuild(owned.id)!.status).toBe('success');
  });
});

describe('nothing to record is REPORTED, never a silent null beside a pass', () => {
  it('names why no build received the verdict', () => {
    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', PASS_NOTE, PROJECT_A, 'pass');

    expect(out.build).toBeNull();
    expect(out.unrecordedReason).toBeTruthy();
    expect(out.unrecordedReason).toContain('Win64');
    expect(out.unrecordedReason).toContain('Shipping');
  });

  it('a recorded verdict carries no reason', () => {
    greenBuild(PROJECT_A);
    const out = attachSmokeResultToLatestBuild('Win64', 'Shipping', PASS_NOTE, PROJECT_A, 'pass');
    expect(out.unrecordedReason).toBeNull();
  });
});
