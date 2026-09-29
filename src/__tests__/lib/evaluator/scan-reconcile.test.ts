/**
 * `reconcileScan` — the pure core of a Re-Scan: which earlier findings the new
 * scan still sees, which it no longer finds, and which it could not judge
 * because their pass did not run.
 */
import { describe, it, expect } from 'vitest';
import { reconcileScan } from '@/lib/evaluator/scan-reconcile';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('reconcileScan', () => {
  it('matches file and category case/whitespace-insensitively: persisting=[a], cleared=[b], new=[]', () => {
    const prior = [
      { id: 'a', pass: 'structure', file: 'Source/A.cpp', category: 'Null check', description: 'x' },
      { id: 'b', pass: 'quality', file: 'Source/B.cpp', category: 'Tick cost', description: 'y' },
    ];
    const r = reconcileScan(prior, {
      passes: ['structure', 'quality'],
      findings: [{ pass: 'structure', file: 'source/a.cpp', category: 'null check ', description: 'reworded' }],
    });
    expect(ids(r.persisting)).toEqual(['a']);
    expect(ids(r.cleared)).toEqual(['b']);
    expect(r.new).toEqual([]);
    expect(r.notRescanned).toEqual([]);
  });

  it('a pass that did not run clears nothing: its prior finding is notRescanned, never cleared', () => {
    const prior = [
      { id: 'p', pass: 'performance', file: 'Source/P.cpp', category: 'Tick cost', description: 'ticks every frame' },
    ];
    const r = reconcileScan(prior, { passes: ['structure'], findings: [] });
    expect(ids(r.notRescanned)).toEqual(['p']);
    expect(r.cleared).toEqual([]);
    expect(r.persisting).toEqual([]);
  });
});
