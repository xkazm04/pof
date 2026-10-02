/**
 * A smoke verdict must land on the build that was cooked — by id, never by "the newest
 * green row of this project". `build_history.created_at` is whole seconds, so two
 * builds recorded in one second tie, and a nightly run can insert a newer row while an
 * interactive smoke is still observing. Either way the latest-row query took the
 * verdict onto a build nobody smoke-tested.
 *
 * Run 4's rule holds on the by-id path too: a condemned build KEEPS its version and the
 * number is burned — the next green cook never reissues it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-smoke-build-identity-${process.pid}.db`;
});

vi.mock('@/lib/packaging/smoke-test', async (orig) => {
  const actual = await orig<typeof import('@/lib/packaging/smoke-test')>();
  return { ...actual, runSmokeTest: vi.fn() };
});

import { getDb } from '@/lib/db';
import { getBuild, attachSmokeResultToBuild } from '@/lib/packaging/build-history-store';
import { finalizeCook, type CookFinalOutcome } from '@/lib/packaging/finalize-build';
import { defaultRunnerDeps } from '@/lib/packaging/scheduled-build-runner';
import { runSmokeTest } from '@/lib/packaging/smoke-test';
import { POST } from '@/app/api/packaging/smoke-test/route';

const PROJECT = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const DONE: CookFinalOutcome = { kind: 'done', exePath: 'C:\\out\\PoF.exe', durationMs: 1000, sizeBytes: null };

function cook() {
  return finalizeCook(DONE, { projectPath: PROJECT, platform: 'Win64', config: 'Shipping' }, defaultRunnerDeps());
}

function smoke(buildId: number) {
  return POST(new Request('http://localhost/api/packaging/smoke-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buildId }),
  }));
}

beforeEach(() => {
  getDb().prepare('DELETE FROM build_history').run();
  vi.mocked(runSmokeTest).mockResolvedValue({
    status: 'fail', gameAlive: false, bootstrapExitCode: 1, spawnError: null,
    observedMs: 25_000, gameImage: 'PoF-Win64-Shipping.exe', bootstrapExe: 'C:\\out\\PoF.exe',
  });
});

describe('a failing smoke condemns the NAMED build, not the newest one', () => {
  it('an older green row is condemned and keeps its version; the newer row is untouched; no number is reissued', async () => {
    cook();
    cook();
    const target = cook();
    const newer = cook();
    expect(target.version).toBe('0.1.3');
    expect(newer.version).toBe('0.1.4');

    const res = await smoke(target.buildId!);
    const json = await res.json();
    expect(json.data.recordedToBuildId).toBe(target.buildId);

    const t = getBuild(target.buildId!)!;
    expect(t.status).toBe('failed');
    expect(t.notes).toContain('smoke-test: fail');
    expect(t.errorSummary).toContain('smoke-test: fail');
    expect(t.version).toBe('0.1.3');

    const n = getBuild(newer.buildId!)!;
    expect(n.status).toBe('success');
    expect(n.notes).toBeNull();
    expect(n.version).toBe('0.1.4');

    expect(cook().version).toBe('0.1.5');
    const holders = getDb().prepare("SELECT COUNT(*) AS c FROM build_history WHERE version = '0.1.3'").get() as { c: number };
    expect(holders.c).toBe(1);
  });

  it('condemning the project\'s newest 0.1.3 by id burns it: the next green cook is 0.1.4', () => {
    cook();
    cook();
    const third = cook();
    const att = attachSmokeResultToBuild(third.buildId!, '[SMOKE] exe died', 'fail');
    expect(att.build?.id).toBe(third.buildId);
    expect(att.build?.status).toBe('failed');
    expect(getBuild(third.buildId!)?.version).toBe('0.1.3');
    expect(cook().version).toBe('0.1.4');
  });

  it('an unknown id records nothing and says so', () => {
    const att = attachSmokeResultToBuild(123456, 'smoke-test: pass', 'pass');
    expect(att.build).toBeNull();
    expect(att.unrecordedReason).toMatch(/build #\d+ no longer exists/);
    expect(att.unrecordedReason).toContain(String(123456));
  });
});
