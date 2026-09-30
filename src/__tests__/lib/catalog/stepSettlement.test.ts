// scan-sweep --challenge catalog-core-infrastructure/B: every non-pass verdict names what settles it.
// `settlementOf` reads the declared contract (marker prefixes, tier, the packaging predicate), never free text.
import { describe, it, expect } from 'vitest';
import { settlementOf, entityNextStep } from '@/lib/catalog/stepSettlement';

const TEST_GATE = { archetype: 'checklist', label: 'Test Gate' };
const L3_DEFERRED = { status: 'deferred', tier: 'L3', reason: 'live-UE runner not yet run: VSItemsDefinitionsTest' };

describe('settlementOf — deferred verdicts name the pass that settles them', () => {
  it('an L3 deferral is settled by the gate drain, scoped to its tier', () => {
    expect(settlementOf(L3_DEFERRED, TEST_GATE)).toMatchObject({
      kind: 'drain', tool: 'pof_drain_gates', args: { tier: 'L3' }, actionable: true,
    });
  });

  it('a packaging step is settled by the settle route, not the drain', () => {
    expect(settlementOf(L3_DEFERRED, { archetype: 'manifest', label: 'UE Packaging' })).toMatchObject({
      kind: 'settle', route: 'POST /api/pipeline-artifacts/settle', actionable: true,
    });
  });

  it('an L2 deferral is settled by the settle route (verify-static), which no drain reaches', () => {
    expect(settlementOf({ ...L3_DEFERRED, tier: 'L2' }, TEST_GATE)).toMatchObject({
      kind: 'settle', route: 'POST /api/pipeline-artifacts/settle', actionable: true,
    });
  });
});

describe('settlementOf — pending/fail verdicts', () => {
  it('UNGRADED: nothing here can settle it', () => {
    const s = settlementOf({ status: 'pending', tier: 'L0', reason: 'UNGRADED: content invariant "proj-balance" is PoF law and is not law under canon profile diablo1' });
    expect(s).toMatchObject({ kind: 'none', actionable: false });
  });

  it('SOURCED: produce this entity\'s own content from the recipe', () => {
    const s = settlementOf({ status: 'pending', tier: 'L0', reason: 'SOURCED: seeded from Diablo I monstdat.cpp (row 3; …)' });
    expect(s).toMatchObject({ kind: 'produce', tool: 'pof_get_step', actionable: true });
  });

  it('TEMPLATE: produce this step live for the entity', () => {
    const s = settlementOf({ status: 'pending', tier: 'L0', reason: 'TEMPLATE: bestiary-melee-grunt template, not produced for this entity' });
    expect(s).toMatchObject({ kind: 'produce-live', actionable: true });
  });

  it('a declared reference gap: fill the gap', () => {
    const s = settlementOf({ status: 'pending', tier: 'L0', reason: 'field "stats" missing: moveSpeed (declared gap: moveSpeed — "not in the reference")' });
    expect(s).toMatchObject({ kind: 'fill-gap', actionable: true });
  });

  it('fail: fix the data and resubmit', () => {
    expect(settlementOf({ status: 'fail', tier: 'L0', reason: 'brief too short' })).toMatchObject({ kind: 'resubmit', actionable: true });
  });

  it('pass: nothing to settle', () => {
    expect(settlementOf({ status: 'pass', tier: 'L0' })).toBeNull();
  });
});

describe('entityNextStep — the lab coach ladder over persisted verdicts', () => {
  const steps = [{ label: 'A', archetype: 'brief' }, { label: 'B', archetype: 'rules' }, { label: 'C', archetype: 'rules' }];

  it('picks the most urgent rung, skipping rows nothing can settle', () => {
    const verdicts: Record<string, { status: string; tier?: string; reason?: string } | null> = {
      A: { status: 'fail', tier: 'L0', reason: 'UNGRADED: no server checker' },
      B: { status: 'pending', tier: 'L0', reason: 'x' },
      C: null,
    };
    expect(entityNextStep(steps, (l) => verdicts[l])).toEqual({ step: 'B', priority: 'pending' });
  });

  it('null when every step passes', () => {
    expect(entityNextStep(steps, () => ({ status: 'pass', tier: 'L0' }))).toBeNull();
  });
});
