/**
 * The calibration history reader promises that "one bad append cannot make the whole guard
 * unreadable". A line that is valid JSON but not a whole run (a hand edit, a partial record from
 * another tool) used to be admitted on `overall` alone; as the LATEST run it then crashed
 * `evaluateCalibration` (`run.confirmed.scored` on undefined) — the guard test threw instead of
 * reporting a standing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCalibrationRun, evaluateCalibration, latestCalibrationRun, readCalibrationHistory } from '@/lib/judge/calibration';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function historyFile(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'jcq-cal-'));
  dirs.push(dir);
  const path = join(dir, 'judge-calibration.jsonl');
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return path;
}

const good = buildCalibrationRun({
  targets: [{ catalogId: 'c', entityId: 'e', step: 'S', label: 'fail', provisional: true }],
  scores: { 'c::e::S': 40 }, rubricVersion: RUBRIC_VERSION, model: 'm', effort: 'high',
  spend: { costUsd: 0, spawns: 1, unknownCost: 0 }, ranAt: '2026-11-01T00:00:00.000Z',
});

describe('readCalibrationHistory — only whole runs are runs', () => {
  it('skips a JSON line missing the confirmed agreement, so the latest WHOLE run is evaluated', () => {
    const partial = { ranAt: '2026-11-02T00:00:00.000Z', rubricVersion: RUBRIC_VERSION, overall: { total: 1, scored: 1, agreed: 1, rate: 1, disagreements: [] } };
    const path = historyFile([good, partial]);
    expect(readCalibrationHistory(path)).toHaveLength(1);
    const latest = latestCalibrationRun(path);
    expect(latest?.ranAt).toBe(good.ranAt);
    expect(() => evaluateCalibration(latest, RUBRIC_VERSION)).not.toThrow();
  });

  it('skips a line whose agreement blocks are not numeric', () => {
    const bad = { ...good, ranAt: '2026-11-03T00:00:00.000Z', confirmed: { scored: 'two' } };
    expect(readCalibrationHistory(historyFile([good, bad]))).toHaveLength(1);
  });

  it('keeps a whole run', () => {
    expect(readCalibrationHistory(historyFile([good]))).toHaveLength(1);
  });
});
