import { describe, it, expect } from 'vitest';
import { bindIconsAll, type BindIconsDeps } from '@/lib/catalog/acceptance/bindIconsAll';
import { buildIconList, iconFileBase, resolveIconFor } from '@/lib/visual-gen/generated-icons';

/**
 * The bind pass must honour the entity dimension with the SAME precedence every other read
 * site uses — an entity's own art wins, the step icon is the fallback — and every row must
 * say WHICH scope bound, so a step icon standing in for an entity is a declared state and
 * never reads as art made for that entity.
 */
const HISTORY = {
  genHistory: {
    batches: [{ id: 'b0', createdAt: 't', direction: 'd', candidates: [{ id: 'b0-c0', swatch: 'x', payload: {} }] }],
    selectedId: 'b0-c0',
  },
};

const LIBRARY = buildIconList([
  { name: 'items_icon_2d_art.jpg', mtimeMs: 10 },
  { name: `${iconFileBase('items', 'Icon 2D Art', 'item-1')}.jpg`, mtimeMs: 20 },
]);

function deps(rows: { entityId: string }[]): BindIconsDeps & { saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    listArtifacts: () =>
      rows.map((r) => ({ catalogId: 'items', entityId: r.entityId, step: 'Icon 2D Art', status: 'deferred', data: { ...HISTORY } })),
    iconFor: (catalogId, step, entityId) => resolveIconFor(LIBRARY, catalogId, step, entityId),
    grade: () => ({ status: 'pass', tier: 'L1', label: 'bound', detail: 'library art bound' }),
    save: (_c, entityId) => { saved.push(entityId); },
    now: () => 'now',
  };
}

describe('bindIconsAll — entity-scoped precedence', () => {
  it('binds an entity its OWN art and reports the entity scope', () => {
    const d = deps([{ entityId: 'item-1' }]);
    const out = bindIconsAll({}, d, { apply: true, library: LIBRARY.length });
    expect(out.bound).toBe(1);
    expect(out.results[0].scope).toBe('entity');
    expect(out.results[0].detail).toContain('items__item_1__icon_2d_art.jpg');
    expect(d.saved).toEqual(['item-1']);
  });

  it('falls back to the step icon for an entity with no art, and SAYS it is the step icon', () => {
    const out = bindIconsAll({}, deps([{ entityId: 'item-9' }]), { apply: false, library: LIBRARY.length });
    expect(out.bound).toBe(1);
    expect(out.results[0].scope).toBe('step');
    expect(out.results[0].detail).toContain('items_icon_2d_art.jpg');
  });

  it('a preview (apply:false) writes nothing', () => {
    const d = deps([{ entityId: 'item-1' }]);
    bindIconsAll({}, d, { apply: false });
    expect(d.saved).toEqual([]);
  });
});
