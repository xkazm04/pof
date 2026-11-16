/**
 * scan-sweep night 2026-11-08 (module-evaluator): the review:module daily cap reads its
 * spend from the ledger's `count`. readLedger only checked `typeof count === 'number'`,
 * so a negative or fractional count, or a count lower than the runs the same file lists,
 * read as headroom (count -5 => 8 more paid reviews today). The cap fails closed:
 * a count that is not a non-negative integer is not a ledger, and the spend is never
 * read as less than the recorded runs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger } from '@/lib/evaluator/review-runner';

const TODAY = '2026-11-08';
const dirs: string[] = [];
function ledgerFile(body: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'pof-review-ledger-'));
  dirs.push(dir);
  const path = join(dir, 'ledger.json');
  writeFileSync(path, JSON.stringify(body));
  return path;
}
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const run = (n: number) => ({ moduleId: `m${n}`, batchId: `b${n}`, at: `${TODAY}T10:0${n}:00Z` });

describe('readLedger — the daily count fails closed', () => {
  it('a negative or fractional count is not a ledger', () => {
    expect(() => readLedger(ledgerFile({ date: TODAY, count: -5, runs: [] }), TODAY)).toThrow(/not a review-runner ledger/);
    expect(() => readLedger(ledgerFile({ date: TODAY, count: 1.5, runs: [] }), TODAY)).toThrow(/not a review-runner ledger/);
  });

  it('the count is never read as less than the runs recorded today', () => {
    const l = readLedger(ledgerFile({ date: TODAY, count: 0, runs: [run(1), run(2), run(3)] }), TODAY);
    expect(l.count).toBe(3);
  });

  it('a well-formed ledger reads unchanged', () => {
    const l = readLedger(ledgerFile({ date: TODAY, count: 2, runs: [run(1), run(2)] }), TODAY);
    expect(l).toEqual({ date: TODAY, count: 2, runs: [run(1), run(2)] });
  });
});
