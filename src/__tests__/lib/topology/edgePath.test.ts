/**
 * scan-sweep night 2026-11-08 (module-topology-graph): GraphCanvas and NexusGraph each
 * hand-computed the same shortened quadratic edge path, and neither guarded dist=0
 * (two modules on one centre, a self-edge), which gave `MNaN,NaN Q...`. One pure
 * edgePath() now owns the derivation; the pinned strings below are the pre-extraction
 * output of the hand-rolled formula, so the extraction cannot drift pixels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { edgePath } from '@/lib/topology/moduleGraph';

const PINNED = [
  { from: { x: 100, y: 100 }, to: { x: 400, y: 100 }, w: 140, h: 72, d: 'M174,100 Q247,120 320,100' },
  {
    from: { x: 100, y: 100 }, to: { x: 300, y: 340 }, w: 160, h: 80,
    d: 'M153.7754895718163,133.80173630228455 Q182.71502120905905,230.49902415449748 242.3834040301968,301.5889360201312',
  },
  {
    from: { x: 500, y: 60 }, to: { x: 120, y: 260 }, w: 140, h: 72,
    d: 'M434.5160515437333,78.6298573133049 Q303.3398260104935,140.9043962538625 190.7934577905586,238.5756640896994',
  },
];

describe('edgePath', () => {
  it.each(PINNED)('keeps the pre-extraction path for %#', ({ from, to, w, h, d }) => {
    expect(edgePath(from, to, w, h).d).toBe(d);
  });

  it('exposes the control point as the label anchor', () => {
    const g = edgePath({ x: 100, y: 100 }, { x: 400, y: 100 }, 140, 72);
    expect([g.labelX, g.labelY]).toEqual([247, 120]);
  });

  it('coincident centres (and a self-edge) yield finite path data', () => {
    for (const g of [edgePath({ x: 50, y: 50 }, { x: 50, y: 50 }, 140, 72), edgePath({ x: 0, y: 0 }, { x: 0, y: 0 }, 160, 80)]) {
      expect(g.d).not.toMatch(/NaN/);
      expect(Number.isFinite(g.labelX) && Number.isFinite(g.labelY)).toBe(true);
    }
  });

  it('neither canvas keeps its own copy of the derivation', () => {
    for (const f of [
      'src/components/modules/evaluator/DependencyGraph/GraphCanvas.tsx',
      'src/components/modules/evaluator/NexusView/NexusGraph.tsx',
    ]) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
      expect(src, f).toMatch(/edgePath\(/);
      expect(src, f).not.toMatch(/Math\.sqrt\(dx \* dx/);
    }
  });
});
