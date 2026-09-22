// /diablo W02a. Operator decisions: under a canon profile that has no such law, a canon-law invariant
// is explicitly UNGRADED (never a silent pass), and a step seeded from a reference is SOURCED (never
// pass). Both are MARKERS on a truthful status, not new status values (registry:
// ungraded-marker-doctrine). The strongest cases here run the REAL registered bestiary steps on the
// data their own produce stub writes — the same data that passes under PoF today.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { canonLawChecker, canonLawOf, lawInForce } from '@/lib/catalog/acceptance/canonLaw';
import { sourcedGuard, sourcedStampOf } from '@/lib/catalog/acceptance/sourced';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { componentsSumTo } from '@/lib/catalog/acceptance/invariants';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

const ctx = (canonProfile?: string): CheckerContext => ({ catalog: 'bestiary', siblings: {}, has: () => true, ...(canonProfile ? { canonProfile } : {}) });
const ENTITY = { id: 'bestiary-brute', name: 'Brute', lifecycle: 'planned' as const, data: {} };
const step = (label: string) => getCatalogPipeline('bestiary')!.steps.find((s) => s.label === label)!;
const STAMP = { sourceGame: 'Diablo I (1996)', sourceFile: 'monsters/monstdat.tsv', sourceRow: '_monster_id=MT_NZOMBIE', columns: ['resistance'] };

describe('lawInForce', () => {
  it('every PoF law is in force for pof; the diablo1 profile inherits no balance law', () => {
    expect(lawInForce('pof', 'arpg-monster-rarity')).toBe(true);
    expect(lawInForce('diablo1', 'arpg-monster-rarity')).toBe(false);
    expect(lawInForce('diablo1', 'proj-balance')).toBe(false);
  });
});

describe('canonLawChecker', () => {
  const inner = () => ({ label: 'x', tier: 'L0' as const, status: 'pass' as const, detail: 'ok' });
  const law = canonLawChecker('arpg-monster-rarity', 'x', inner);

  it('grades normally under pof (and when no profile is given)', () => {
    expect(law({}, ctx('pof')).status).toBe('pass');
    expect(law({}, ctx()).status).toBe('pass');
    expect(law({}).status).toBe('pass');
  });

  it('under diablo1 it is pending with a greppable UNGRADED reason naming the law — never a pass', () => {
    const r = law({}, ctx('diablo1'));
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/^UNGRADED: content invariant "arpg-monster-rarity" is PoF law/);
    expect(r.reason).toContain('"diablo1"');
  });

  it('keeps its tags: still a content invariant, and it names its law', () => {
    expect(isContentInvariant(law)).toBe(true);
    expect(canonLawOf(law)).toBe('arpg-monster-rarity');
  });

  it('a world-neutral invariant is NOT law-gated — arithmetic grades under every profile', () => {
    const sum = componentsSumTo('parts', ['a', 'b'], 10, 'sum');
    expect(sum({ parts: { a: 4, b: 6 } }, ctx('diablo1')).status).toBe('pass');
    expect(canonLawOf(sum)).toBeUndefined();
  });
});

describe('the REAL bestiary Monster Rarity step on its own produced data', () => {
  const s = step('Monster Rarity');
  // produce() returns an envelope ({ data, … }); the checker grades the inner data.
  const data = (s.produce(ENTITY) as { data: Record<string, unknown> }).data;

  it('passes under PoF exactly as before (control)', () => {
    expect(s.accept(data, ctx('pof')).status).toBe('pass');
  });

  it('is UNGRADED under diablo1 — the same data is not judged by PoF’s rarity bands', () => {
    const r = s.accept(data, ctx('diablo1'));
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/^UNGRADED: content invariant "arpg-monster-rarity"/);
  });
});

describe('SOURCED (D3) — registration-wrapped, so every grading path sees it', () => {
  const s = step('Resistances');
  // produce() returns an envelope ({ data, … }); the checker grades the inner data.
  const data = (s.produce(ENTITY) as { data: Record<string, unknown> }).data;

  it('control: the step passes its produced data', () => {
    expect(s.accept(data, ctx('pof')).status).toBe('pass');
  });

  it('the same data carrying a sourced stamp is held at pending with a SOURCED reason — never pass', () => {
    const r = s.accept({ ...data, sourced: STAMP }, ctx('diablo1'));
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/^SOURCED: seeded from Diablo I \(1996\) monsters\/monstdat\.tsv/);
    expect(r.reason).toContain('_monster_id=MT_NZOMBIE');
  });

  it('a seeded value that FAILS its checker stays fail — a real defect is not softened', () => {
    const r = s.accept({ sourced: STAMP }, ctx('diablo1'));
    expect(r.status).not.toBe('pass');
    expect(r.reason ?? '').not.toMatch(/^SOURCED/);
  });

  it('the guard preserves the content-invariant tag of the step it wraps', () => {
    expect(isContentInvariant(step('Monster Rarity').accept)).toBe(true);
    const guarded = sourcedGuard(canonLawChecker('proj-balance', 'p', () => ({ label: 'p', tier: 'L0', status: 'pass', detail: '' })));
    expect(canonLawOf(guarded)).toBe('proj-balance');
  });

  it('sourcedStampOf ignores malformed stamps (a string is not a provenance)', () => {
    expect(sourcedStampOf({ sourced: 'yes' })).toBeNull();
    expect(sourcedStampOf({ sourced: STAMP })).toEqual(STAMP);
  });
});
