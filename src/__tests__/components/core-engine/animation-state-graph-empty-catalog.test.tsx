/**
 * AnimationStateGraph handed `primaryEntry!` to useGeneration. With an empty
 * state-graph catalog (before seeding / the fetch resolves) that is `undefined`,
 * and the real useGeneration dereferences `entity.catalogId` — a render-time
 * crash (fixed in 9178d243 with an EMPTY_MONTAGE_ENTRY placeholder). The mock
 * here dereferences its entity exactly like the real hook, so an undefined
 * entity throws; a no-op mock would hide the crash.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { AnimationEntry, StoredCatalogEntity } from '@/lib/catalog/types';
import { ALL_MONTAGES } from '@/components/modules/core-engine/sub_animation/_shared/data';

afterEach(cleanup);

const { entriesRef, seenEntities } = vi.hoisted(() => ({
  entriesRef: { current: [] as unknown[] },
  seenEntities: [] as StoredCatalogEntity[],
}));

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: (entity: StoredCatalogEntity) => {
    // Same first dereference as the real hook (useGeneration.ts: entity.catalogId).
    const catalogId = entity.catalogId;
    seenEntities.push(entity);
    // A state-graph entity has a recipe step, so a non-null nextStep is what the
    // real hook returns for the placeholder — the button must still be gated on
    // a real catalog entry.
    return { generate: () => {}, isRunning: false, nextStep: catalogId === 'state-graph' ? 'scaffold-cpp' : null };
  },
}));

vi.mock('@/stores/catalogStore', () => ({
  useCatalogEntities: () => entriesRef.current,
}));

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    features: [],
    defs: [],
    isLoading: false,
  }),
}));

vi.mock('@/components/modules/core-engine/sub_animation/AnimTabContent', () => ({
  StateGraphTabContent: () => null,
  CombosMontagesTabContent: () => null,
  RetargetingTabContent: () => null,
  BudgetTabContent: () => null,
}));
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({ default: () => null }));
vi.mock('@/components/modules/core-engine/unique-tabs/VisibleSection', () => ({
  VisibleSection: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AnimationStateGraph } from '@/components/modules/core-engine/sub_animation';

const makeEntry = (id: string, name: string): AnimationEntry => ({
  id, catalogId: 'state-graph', name, categoryPath: ['Attack'], tags: [], lifecycle: 'planned',
  data: {
    id, name, category: 'Attack', totalFrames: 30, fps: 30,
    memorySizeMB: 1, hasRootMotion: true, blendInTime: 0.05,
  },
});

/** The CatalogLifecycleCell run button reads Generate / Regenerate / Retry. */
const runButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button')).filter(
    (b) => /^(Generate|Regenerate|Retry)$/.test(b.textContent ?? ''),
  );

describe('AnimationStateGraph with an empty state-graph catalog', () => {
  beforeEach(() => {
    seenEntities.length = 0;
  });

  it('renders without throwing and hands useGeneration a defined state-graph placeholder', () => {
    entriesRef.current = [];
    expect(() => render(<AnimationStateGraph moduleId="animations" />)).not.toThrow();
    expect(seenEntities.length).toBeGreaterThan(0);
    for (const entity of seenEntities) {
      expect(entity).toBeDefined();
      expect(entity.catalogId).toBe('state-graph');
      expect(entity.id).toBe('');
    }
  });

  it('offers no run button for the placeholder even when nextStep is non-null', () => {
    entriesRef.current = [];
    const { container } = render(<AnimationStateGraph moduleId="animations" />);
    expect(runButtons(container)).toHaveLength(0);
  });

  it('hands useGeneration the real primary entry, not the placeholder, once one exists', () => {
    const primary = makeEntry(ALL_MONTAGES[0].id, 'Primary montage');
    entriesRef.current = [makeEntry('some-other-montage', 'Other'), primary];
    const { container } = render(<AnimationStateGraph moduleId="animations" />);
    expect(seenEntities.at(-1)).toBe(primary);
    expect(runButtons(container)).toHaveLength(1);
  });

  it('falls back to the first catalog entry when the primary montage is absent', () => {
    const first = makeEntry('some-other-montage', 'Other');
    entriesRef.current = [first];
    const { container } = render(<AnimationStateGraph moduleId="animations" />);
    expect(seenEntities.at(-1)).toBe(first);
    expect(runButtons(container)).toHaveLength(1);
  });
});
