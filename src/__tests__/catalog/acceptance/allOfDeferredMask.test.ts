import { describe, it, expect } from 'vitest';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { explainAcceptance } from '@/lib/catalog/acceptance/explainAcceptance';
import { linksResolve } from '@/lib/catalog/acceptance/linkCheckers';
import { wiringContractSound } from '@/lib/catalog/acceptance/wiringCheckers';
import type { AcceptanceResult, Checker, CheckerContext } from '@/lib/catalog/acceptance/types';

// `deferred` is a config-complete terminal status (Rule 5) and the server overlay may replace it
// with a drain pass — so a deferred member must never speak over a later member that FAILS or is
// still PENDING. Before this guard, an unresolved link (deferred) hid a stub wiring contract (fail)
// in 12 registered steps / 283 seeded entity-steps.

const r = (status: AcceptanceResult['status'], label: string): Checker => () => ({ label, tier: 'L0', status, detail: label });
const ctx: CheckerContext = { catalog: 'achievements', siblings: {}, has: () => false };

describe('allOf — a deferred member never masks a later fail/pending', () => {
  it('reports the later fail, not the earlier deferral', () => {
    expect(allOf(r('deferred', 'links'), r('fail', 'wiring'))({}).status).toBe('fail');
  });

  it('reports the later pending, not the earlier deferral', () => {
    expect(allOf(r('deferred', 'links'), r('pending', 'fields'))({}).label).toBe('fields');
  });

  it('keeps first-non-pass order among fail/pending (unchanged behaviour)', () => {
    expect(allOf(r('pending', 'a'), r('fail', 'b'))({}).label).toBe('a');
    expect(allOf(r('pass', 'a'), r('deferred', 'b'), r('deferred', 'c'))({}).label).toBe('b');
    expect(allOf(r('pass', 'a'), r('pass', 'b'))({}).label).toBe('a');
  });

  it('real composition: unresolved link + stub wiring contract grades fail', () => {
    const accept = allOf(linksResolve(), wiringContractSound());
    const data = { links: [{ catalogId: 'items', entityId: 'nope' }], wiringContract: { grantedBy: 'TBD' } };
    const out = accept(data, ctx);
    expect(out.status).toBe('fail');
    expect(out.label).toMatch(/Wiring contract/);
  });

  it('explainAcceptance names the member that actually spoke', () => {
    const checker = allOf(r('deferred', 'links'), r('fail', 'wiring'));
    const local = checker({});
    const ex = explainAcceptance({ step: 's', local, checker, data: {} });
    expect(ex.layers[0].members?.map((m) => m.spoke)).toEqual([false, true]);
    expect(ex.final.status).toBe('fail');
  });
});
