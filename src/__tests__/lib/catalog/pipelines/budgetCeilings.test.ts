import { describe, it, expect, beforeAll } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

/**
 * A budget step grades a CEILING: every artifact under it passes, every artifact over it fails.
 * A two-sided band (withinPercent) failed a cheaper-than-exemplar artifact and coached the
 * producer to spend more. Each case scales the produced value (and its top-level mirror).
 */
interface Case {
  catalogId: string;
  step: string;
  entity: { id: string; name: string };
  /** dotted paths that carry the graded number (nested datum and its mirror) */
  paths: string[];
  /** the ceiling the step's own copy declares */
  declaredCap: number;
}

const CASES: Case[] = [
  { catalogId: 'save-points', step: 'Load-Time Budget', entity: { id: 'save-bonfire', name: 'Bonfire' }, paths: ['measuredMs', 'loadBudget.measuredMs'], declaredCap: 30 },
  { catalogId: 'ambient', step: 'Memory Budget', entity: { id: 'ambient-forest-day', name: 'Forest Day' }, paths: ['totalDecodedMb', 'memoryBudget.totalDecodedMb'], declaredCap: 8 },
  { catalogId: 'vfx', step: 'GPU / LOD Budget', entity: { id: 'vfx-fire-impact', name: 'Fire Impact' }, paths: ['gpuBudget.gpuMs'], declaredCap: 0.48 },
  { catalogId: 'materials', step: 'LOD/Perf Budget', entity: { id: 'mat-weathered-stone', name: 'Weathered Stone' }, paths: ['instructionCount', 'perfBudget.instructionCount'], declaredCap: 200 },
];

function setPath(data: Record<string, unknown>, path: string, value: number): void {
  const keys = path.split('.');
  let cur = data;
  for (const k of keys.slice(0, -1)) {
    const next = cur[k];
    if (typeof next !== 'object' || next == null) return;
    cur = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (typeof cur[last] === 'number') cur[last] = value;
}

function getPath(data: Record<string, unknown>, path: string): number | undefined {
  let cur: unknown = data;
  for (const k of path.split('.')) {
    if (typeof cur !== 'object' || cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === 'number' ? cur : undefined;
}

describe('budget steps grade a ceiling, not a band', () => {
  beforeAll(async () => {
    _resetRegistry();
    for (const c of CASES) await import(`@/lib/catalog/pipelines/${c.catalogId}`);
  });

  for (const c of CASES) {
    it(`${c.catalogId} / ${c.step}: under-budget passes, over-budget fails`, () => {
      const step = getCatalogPipeline(c.catalogId)!.steps.find((s) => s.label === c.step)!;
      const entity = { ...c.entity, lifecycle: 'planned' as const, data: {} };
      const base = step.produce(entity).data as Record<string, unknown>;
      const produced = getPath(base, c.paths[c.paths.length - 1])!;
      expect(typeof produced).toBe('number');

      const grade = (value: number) => {
        const data = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
        for (const p of c.paths) setPath(data, p, value);
        return step.accept(data);
      };

      expect(grade(produced).status).toBe('pass');
      const under = grade(produced * 0.5);
      expect(under.status, under.reason).toBe('pass');
      const over = grade(c.declaredCap * 1.6);
      expect(over.status).toBe('fail');
    });
  }
});
