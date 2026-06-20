import { describe, it, expect, vi } from 'vitest';
import { aggregateStatic, verifyStaticAll, type StaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { UeChecker } from '@/lib/catalog/acceptance/ueStaticCheckers';

const pass = (l: string): AcceptanceResult => ({ label: l, tier: 'L2', status: 'pass', detail: 'present' });
const defer = (l: string): AcceptanceResult => ({ label: l, tier: 'L2', status: 'deferred', detail: 'absent', reason: `${l} not in Source` });
const fail = (l: string): AcceptanceResult => ({ label: l, tier: 'L2', status: 'fail', detail: 'bad check', reason: 'bad' });

describe('aggregateStatic', () => {
  it('returns null when the step declares no checks', () => {
    expect(aggregateStatic([], 'Step')).toBeNull();
  });
  it('all present → pass', () => {
    const r = aggregateStatic([pass('A'), pass('B')], 'Step');
    expect(r?.status).toBe('pass');
    expect(r?.tier).toBe('L2');
    expect(r?.detail).toMatch(/2\/2/);
  });
  it('any missing → deferred, surfacing what is not in UE yet', () => {
    const r = aggregateStatic([pass('A'), defer('B')], 'Step');
    expect(r?.status).toBe('deferred');
    expect(r?.reason).toMatch(/B not in Source/);
  });
  it('any fail → fail', () => {
    expect(aggregateStatic([pass('A'), fail('B')], 'Step')?.status).toBe('fail');
  });
});

describe('verifyStaticAll', () => {
  const ck = (res: AcceptanceResult): UeChecker => () => res;
  function deps(over: Partial<StaticVerifyDeps> = {}): StaticVerifyDeps {
    return {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [
        { catalogId: 'items', entityId: 'e1', step: 'UE Integration', status: 'pass' },         // symbol present → pass (no move)
        { catalogId: 'crafting-recipes', entityId: 'e2', step: 'Integration', status: 'pass' },  // symbol absent → pass→deferred (move)
        { catalogId: 'items', entityId: 'e1', step: 'Concept Brief', status: 'pass' },           // no static checks → skipped
      ],
      getStaticChecks: (c, _e, step) => {
        if (step === 'Concept Brief') return null;
        return c === 'items' ? [ck(pass('UARPGItemDefinition'))] : [ck(defer('UARPGCraftingComponent'))];
      },
      upsertStatus: vi.fn(),
      ...over,
    };
  }

  it('grades only the artifacts whose step declares static checks', () => {
    const s = verifyStaticAll({}, deps());
    expect(s.verified).toBe(2);
    expect(s.passed).toBe(1);
    expect(s.deferred).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.ueRoot).toBe('C:/ue');
  });

  it('writes back only the verdicts that moved', () => {
    const upsert = vi.fn();
    const s = verifyStaticAll({}, deps({ upsertStatus: upsert }));
    expect(s.changed).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith('crafting-recipes', 'e2', 'Integration', expect.objectContaining({ status: 'deferred', tier: 'L2' }));
  });

  it('apply:false is a dry run — reports the move but writes nothing', () => {
    const upsert = vi.fn();
    const s = verifyStaticAll({}, deps({ upsertStatus: upsert }), { apply: false });
    expect(upsert).not.toHaveBeenCalled();
    expect(s.changed).toBe(0);
    expect(s.results.find((r) => r.catalogId === 'crafting-recipes')?.changed).toBe(true);
  });
});
