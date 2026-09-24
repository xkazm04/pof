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

describe('verifyStaticAll — packaging steps belong to the packaging sweep', () => {
  it('delegates a packaging step instead of writing its status (no last-writer-wins)', () => {
    const upsertStatus = vi.fn();
    const s = verifyStaticAll({}, {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [
        { catalogId: 'bestiary', entityId: 'g', step: 'UE Packaging', status: 'deferred' },
        { catalogId: 'bestiary', entityId: 'g', step: 'Stat Block', status: 'deferred' },
      ],
      getStaticChecks: () => [() => pass('Row')],
      upsertStatus,
      isPackaging: (_c, step) => step === 'UE Packaging',
    });
    expect(s).toMatchObject({ delegated: 1, verified: 1, changed: 1 });
    expect(upsertStatus).toHaveBeenCalledTimes(1);
    expect(upsertStatus.mock.calls[0][2]).toBe('Stat Block');
  });
});

describe('verifyStaticAll — a symbol in UE never lifts incomplete content', () => {
  const run = (contentStatus: AcceptanceResult['status'] | null, stat: AcceptanceResult) => {
    const upsertStatus = vi.fn();
    const s = verifyStaticAll({}, {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [{ catalogId: 'bestiary', entityId: 'd1', step: 'Stat Block', status: 'pending' }],
      getStaticChecks: () => [() => stat],
      upsertStatus,
      getContentVerdict: () => (contentStatus
        ? { label: 'Stat Block', tier: 'L0', status: contentStatus, detail: 'checker', reason: 'declared gap: moveSpeed' }
        : null),
    });
    return { s, written: upsertStatus.mock.calls[0]?.[3] as AcceptanceResult | undefined };
  };

  it('content pending + static pass stays pending, naming the content gap (no write: unchanged)', () => {
    const { s } = run('pending', pass('FARPGMonsterRow'));
    expect(s.results[0]).toMatchObject({ from: 'pending', to: 'pending', changed: false });
    expect(s.results[0].reason).toContain('moveSpeed');
  });

  it('content fail + static pass stays fail', () => {
    const { written } = run('fail', pass('FARPGMonsterRow'));
    expect(written?.status).toBe('fail');
  });

  it('content pass or deferred leaves the static verdict standing (L3-gated steps untouched)', () => {
    expect(run('pass', pass('Row')).written?.status).toBe('pass');
    expect(run('deferred', pass('Row')).written?.status).toBe('pass');
    expect(run(null, defer('Row')).written?.status).toBe('deferred');
  });
});
