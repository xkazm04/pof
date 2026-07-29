import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { budgetWithinCap, valueWithinDeclaredBand, descendingSeries } from '@/lib/catalog/acceptance/invariants';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const ENTITY: LabEntity = { id: 'inv-entity', name: 'Invariant Probe', lifecycle: 'planned', data: {} };

describe('self-consistency invariants', () => {
  it('budgetWithinCap grades the artifact against its OWN declared cap', () => {
    const c = budgetWithinCap('perfBudget', 'instructionCount', 'target', 'within budget');
    expect(c({ perfBudget: { instructionCount: 180, target: 200 } }).status).toBe('pass');
    const bad = c({ perfBudget: { instructionCount: 240, target: 200 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('exceeds the declared cap');
    expect(c({ perfBudget: {} }).status).toBe('pending');
  });

  it('valueWithinDeclaredBand rejects a value outside the artifact-declared band', () => {
    const c = valueWithinDeclaredBand('feel.deadzone', 'default', 'min', 'max', 'in band');
    expect(c({ feel: { deadzone: { default: 0.15, min: 0.1, max: 0.25 } } }).status).toBe('pass');
    expect(c({ feel: { deadzone: { default: 0.4, min: 0.1, max: 0.25 } } }).status).toBe('fail');
    // an inverted band is itself a content error, not a pass
    expect(c({ feel: { deadzone: { default: 0.15, min: 0.3, max: 0.1 } } }).status).toBe('fail');
  });

  it('descendingSeries enforces a ladder that actually gets cheaper', () => {
    const c = descendingSeries('triBudget', ['LOD0', 'LOD1', 'LOD2'], 'ladder descends', 'tris');
    expect(c({ triBudget: { LOD0: { tris: 1200 }, LOD1: { tris: 600 }, LOD2: { tris: 200 } } }).status).toBe('pass');
    const bad = c({ triBudget: { LOD0: { tris: 1200 }, LOD1: { tris: 1200 }, LOD2: { tris: 200 } } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('must descend');
  });

  it('marks itself as a content invariant, and allOf propagates the mark', () => {
    expect(isContentInvariant(budgetWithinCap('a', 'b', 'c', 'l'))).toBe(true);
    expect(isContentInvariant(fieldsPopulated('a', 'l', ['b']))).toBe(false);
    expect(isContentInvariant(allOf(fieldsPopulated('a', 'l', ['b']), budgetWithinCap('a', 'b', 'c', 'l')))).toBe(true);
    expect(isContentInvariant(allOf(fieldsPopulated('a', 'l', ['b'])))).toBe(false);
  });
});

/**
 * The point of the whole direction: a WRONG NUMBER must now FAIL. Each case takes the step's
 * real produce output, corrupts exactly one graded value, and asserts the verdict flips —
 * proving the checker reads content, not shape. (Rule 5 — the CLEAN produce still passes —
 * is covered by the fleet spec linter's seed-backed terminal-status walk.)
 */
const CORRUPTIONS: { catalogId: string; step: string; corrupt: (d: Record<string, unknown>) => void }[] = [
  { catalogId: 'ambient', step: 'Memory Budget', corrupt: (d) => { (d.memoryBudget as Record<string, unknown>).totalDecodedMb = 99; d.totalDecodedMb = 99; } },
  { catalogId: 'materials', step: 'LOD/Perf Budget', corrupt: (d) => { (d.perfBudget as Record<string, unknown>).instructionCount = 999; d.instructionCount = 999; } },
  { catalogId: 'save-points', step: 'Load-Time Budget', corrupt: (d) => { (d.loadBudget as Record<string, unknown>).measuredMs = 400; d.measuredMs = 400; } },
  { catalogId: 'vfx', step: 'GPU / LOD Budget', corrupt: (d) => { (d.gpuBudget as Record<string, unknown>).gpuMs = 4; } },
  { catalogId: 'music', step: 'Mix & Loudness', corrupt: (d) => { (d.loudness as Record<string, unknown>).displayMagnitude = 30; } },
  { catalogId: 'combat-map', step: 'Balance', corrupt: (d) => { (d.balance as Record<string, unknown>).rawThreat = 5; } },
  { catalogId: 'spellbook', step: 'Balance', corrupt: (d) => { (d.balance as Record<string, unknown>).hitDPS = 2; } },
  { catalogId: 'items', step: 'Economy', corrupt: (d) => { (d.economy as Record<string, unknown>).powerScore = 55; } },
  { catalogId: 'vendors', step: 'Economy Sim', corrupt: (d) => { (d.economySim as Record<string, unknown>).marginPct = 5; } },
  { catalogId: 'character-pipeline', step: 'Game-Tier Convert', corrupt: (d) => { (d.gameTier as Record<string, unknown>).sizeMB = 40; } },
  { catalogId: 'props', step: '3D & LODs', corrupt: (d) => { ((d.triBudget as Record<string, Record<string, unknown>>).LOD1).tris = 5000; } },
  { catalogId: 'hud-elements', step: 'State Logic', corrupt: (d) => { (d.stateLogic as Record<string, unknown>).criticalThreshold = 0.9; } },
  { catalogId: 'input-schemes', step: 'Deadzone & Haptics', corrupt: (d) => { ((d.feel as Record<string, Record<string, unknown>>).deadzone).default = 0.9; } },
];

describe('wired content invariants actually bite', () => {
  for (const { catalogId, step, corrupt } of CORRUPTIONS) {
    it(`${catalogId} · ${step}: a wrong number fails acceptance`, () => {
      const pipeline = allCatalogPipelines().find((p) => p.catalogId === catalogId);
      const spec = pipeline?.steps.find((s) => s.label === step);
      expect(spec, `${catalogId} / ${step} not registered`).toBeTruthy();
      const data = structuredClone((spec!.produce(ENTITY).data ?? {}) as Record<string, unknown>);
      corrupt(data);
      const r = spec!.accept(data);
      expect(r.status, `expected a fail after corrupting ${catalogId} / ${step}`).toBe('fail');
      expect(r.reason, 'a failing invariant must name the law + actual-vs-allowed').toBeTruthy();
    });
  }
});
