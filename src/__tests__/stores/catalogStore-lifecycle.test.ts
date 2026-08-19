import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
// localStorage mock installed by src/__tests__/setup.ts

const SEED_ID = 'off-fire-01'; // 'Fireball' — present in SPELLBOOK_ABILITIES

function lifecycleOf(id: string) {
  return useCatalogStore.getState().entitiesByCatalog.spellbook[id].lifecycle;
}

describe('catalogStore lifecycle actions', () => {
  beforeEach(() => {
    // restore the seeded Fireball to 'planned' without disturbing other entries
    const s = useCatalogStore.getState();
    const e = s.entitiesByCatalog.spellbook[SEED_ID];
    s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
      x.id === SEED_ID ? { ...e, lifecycle: 'planned', ueAssets: undefined, lastTestResult: undefined } : x,
    ));
  });

  /**
   * `applyLifecycle` and its five cases were DELETED with the action (2026-08-19).
   *
   * It was a client-side lifecycle mutator with zero production callers — the transition gate
   * it re-implemented lives on the server (`POST /api/catalog` → `resolveTransition`, still
   * tested in `src/__tests__/lib/catalog/lifecycle.test.ts`), and what the lab renders is the
   * server's read-only derivation. Keeping a tested-but-uncalled mutator beside a display path
   * that must never move a verdict was the hazard, not the coverage.
   */
  it('exposes no client-side lifecycle mutator', () => {
    expect('applyLifecycle' in useCatalogStore.getState()).toBe(false);
    // …while the state the seed sets is still readable and untouched.
    expect(lifecycleOf(SEED_ID)).toBe('planned');
  });

  describe('loadLifecycle', () => {
    it('merges DB lifecycle records over seeded entities', () => {
      useCatalogStore.getState().loadLifecycle([
        { catalogId: 'spellbook', entityId: SEED_ID, lifecycle: 'generated', ueAssets: ['/x'] },
      ]);
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('generated');
      expect(e.ueAssets).toEqual(['/x']);
      expect(e.name).toBe('Fireball'); // design data preserved
    });

    it('ignores records for unknown entities', () => {
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().loadLifecycle([
        { catalogId: 'spellbook', entityId: 'ghost', lifecycle: 'wired', ueAssets: [] },
      ]);
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });
  });
});
