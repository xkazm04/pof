/**
 * Icon set planning — which entities of a (catalog, step) lack art of their OWN, and the
 * sheets that fill exactly those. Pure: no request, no generation, no disk.
 *
 * The grid-fill rule is not restated here: every planned sheet is handed to the route's own
 * prompt builder (`buildContactSheetPrompt`), so a plan the route would refuse with
 * "cast does not fill the grid" cannot exist.
 */
import { describe, it, expect } from 'vitest';
import { buildContactSheetPrompt } from '@/lib/visual-gen/contact-sheet';
import { buildIconList, iconFileBase } from '@/lib/visual-gen/generated-icons';
import { planIconSet, sheetSpec, type IconSetEntity, type IconSetPlan } from '@/lib/visual-gen/icon-set-plan';

const CAT = 'bestiary';
const STEP = 'Concept 2D Art';

const ent = (id: string, canonProfile?: string): IconSetEntity => ({
  id,
  name: `${id.toUpperCase()} name`,
  ...(canonProfile ? { canonProfile } : {}),
});
const entityIcon = (id: string) => ({ name: `${iconFileBase(CAT, STEP, id)}.png`, mtimeMs: 2 });
const stepIcon = { name: `${iconFileBase(CAT, STEP)}.png`, mtimeMs: 1 };

function planned(input: Parameters<typeof planIconSet>[0]): IconSetPlan {
  const r = planIconSet(input);
  if (!r.ok) throw new Error(`plan refused: ${r.error}`);
  return r.data;
}

describe('planIconSet — coverage and sheets', () => {
  it('case 1: entity art counts, the step-scoped fallback does not; 3 missing -> 2x1 + 1x1', () => {
    const plan = planned({
      catalogId: CAT,
      step: STEP,
      entities: ['a', 'b', 'c', 'd', 'e'].map((id) => ent(id)),
      icons: buildIconList([entityIcon('a'), entityIcon('b'), stepIcon]),
    });
    expect(plan.covered).toEqual(['a', 'b']);
    expect(plan.missing).toEqual(['c', 'd', 'e']);
    expect(plan.sheets).toHaveLength(2);
    expect(plan.sheets[0]).toMatchObject({ cols: 2, rows: 1 });
    expect(plan.sheets[0].cast.map((c) => c.entityId)).toEqual(['c', 'd']);
    expect(plan.sheets[1]).toMatchObject({ cols: 1, rows: 1 });
    expect(plan.sheets[1].cast.map((c) => c.entityId)).toEqual(['e']);
    expect(plan.generations).toBe(2);
    expect(plan.perEntityCalls).toBe(3);
  });

  it('case 2: 18 missing -> 16 (4x4) + 2 (2x1); every sheet passes the route prompt builder', () => {
    const ids = Array.from({ length: 18 }, (_, i) => `m${i + 1}`);
    const plan = planned({ catalogId: CAT, step: STEP, entities: ids.map((id) => ent(id)), icons: [] });
    expect(plan.sheets.map((s) => [s.cols, s.rows, s.cast.length])).toEqual([[4, 4, 16], [2, 1, 2]]);
    expect(plan.generations).toBe(2);
    expect(plan.perEntityCalls).toBe(18);
    for (const s of plan.sheets) expect(buildContactSheetPrompt(sheetSpec(s)).ok).toBe(true);
    // Order is preserved across sheets: the cast is the entity list, split, never reshuffled.
    expect(plan.sheets.flatMap((s) => s.cast.map((c) => c.entityId))).toEqual(ids);
  });

  it('case 2b: for every N in 1..40 the plan fills exact grids of at most 16 cells the route accepts', () => {
    for (let n = 1; n <= 40; n++) {
      const plan = planned({
        catalogId: CAT, step: STEP, entities: Array.from({ length: n }, (_, i) => ent(`e${i}`)), icons: [],
      });
      expect(plan.sheets.reduce((t, s) => t + s.cast.length, 0)).toBe(n);
      expect(plan.generations).toBe(plan.sheets.length);
      expect(plan.generations).toBeLessThanOrEqual(Math.ceil(n / 16) + 1);
      for (const s of plan.sheets) {
        expect(s.cols * s.rows).toBe(s.cast.length);
        expect(s.cols).toBeGreaterThanOrEqual(s.rows);
        expect(s.cols / s.rows).toBeLessThanOrEqual(2);
        expect(s.cast.length).toBeLessThanOrEqual(16);
        expect(buildContactSheetPrompt(sheetSpec(s)).ok).toBe(true);
      }
    }
  });

  it('case 3: reroll casts covered + missing; briefs default to the name, an edit overrides, a blank edit is refused', () => {
    const base = {
      catalogId: CAT,
      step: STEP,
      entities: ['a', 'b', 'c'].map((id) => ent(id)),
      icons: buildIconList([entityIcon('a')]),
    };
    const plan = planned({ ...base, reroll: true, briefs: { b: '  a hunched grave-robber with a lantern ' } });
    const cast = plan.sheets.flatMap((s) => s.cast);
    expect(cast.map((c) => c.entityId)).toEqual(['a', 'b', 'c']);
    expect(cast.find((c) => c.entityId === 'a')?.brief).toBe('A name');
    expect(cast.find((c) => c.entityId === 'b')?.brief).toBe('a hunched grave-robber with a lantern');
    expect(plan.perEntityCalls).toBe(3);

    const blank = planIconSet({ ...base, briefs: { c: '   ' } });
    expect(blank.ok).toBe(false);
    if (!blank.ok) {
      expect(blank.error).toContain('"c"');
      expect(blank.error).toContain('blank brief');
    }
    // A blank brief on an entity that is NOT in the cast (covered, no reroll) is not a refusal.
    expect(planIconSet({ ...base, briefs: { a: '' } }).ok).toBe(true);
  });

  it('entities of different canon profiles never share a sheet, and each sheet names its profile', () => {
    const plan = planned({
      catalogId: CAT,
      step: STEP,
      entities: [ent('p1', 'pof'), ent('d1', 'diablo1'), ent('p2', 'pof'), ent('d2', 'diablo1')],
      icons: [],
    });
    expect(plan.sheets.map((s) => [s.canonProfile, s.cast.map((c) => c.entityId)])).toEqual([
      ['pof', ['p1', 'p2']],
      ['diablo1', ['d1', 'd2']],
    ]);
  });
});
