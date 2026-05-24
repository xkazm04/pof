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

  describe('applyLifecycle', () => {
    it('advances one legal step and merges ueAssets', () => {
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'scaffolded',
        ueAssets: ['/Script/PoF.GA_Fireball'],
      });
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('scaffolded');
      expect(e.ueAssets).toContain('/Script/PoF.GA_Fireball');
    });

    it('does NOT promote to verified without a passing test', () => {
      const s = useCatalogStore.getState();
      s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
        x.id === SEED_ID ? { ...x, lifecycle: 'wired' } : x));
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'fail',
      });
      expect(lifecycleOf(SEED_ID)).toBe('wired');
    });

    it('promotes to verified with a pass and records the verdict', () => {
      const s = useCatalogStore.getState();
      s.setEntities('spellbook', Object.values(s.entitiesByCatalog.spellbook).map((x) =>
        x.id === SEED_ID ? { ...x, lifecycle: 'wired' } : x));
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'pass',
      });
      const e = useCatalogStore.getState().entitiesByCatalog.spellbook[SEED_ID];
      expect(e.lifecycle).toBe('verified');
      expect(e.lastTestResult).toBe('pass');
      expect(e.lastVerifiedAt).toBeTruthy();
    });

    it('rejects an illegal skip (state unchanged)', () => {
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: SEED_ID, nextLifecycle: 'verified', testResult: 'pass',
      });
      expect(lifecycleOf(SEED_ID)).toBe('planned');
    });

    it('is a no-op for an unknown entity', () => {
      const before = useCatalogStore.getState().entitiesByCatalog;
      useCatalogStore.getState().applyLifecycle({
        catalogId: 'spellbook', entityId: 'nope', nextLifecycle: 'scaffolded',
      });
      expect(useCatalogStore.getState().entitiesByCatalog).toBe(before);
    });
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
