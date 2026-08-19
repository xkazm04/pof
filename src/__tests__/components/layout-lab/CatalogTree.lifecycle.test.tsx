/**
 * The lab tree paints each entity's dot from its lifecycle — and every seed hardcodes
 * `'planned'`, so before the derivation every entity in the product rendered the
 * `pending ○` glyph regardless of what the pipeline had proven.
 *
 * These assert the DISPLAY contract: derived state wins over the seed, a config-complete
 * `wired` entity is NOT painted as a pass, and the tooltip names the evidence (a tree that
 * showed `wired` without saying "runtime UNPROVEN" would just be a nicer-looking lie).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import type { DerivedLifecycleMap } from '@/components/layout-lab/useDerivedLifecycle';

afterEach(cleanup);

const groups = [{ category: 'Core', catalogs: [
  { catalogId: 'items', label: 'Items', description: '', verified: 0, total: 3 },
] }];

const entities = [
  { id: 'e-shape', name: 'Shape Only', lifecycle: 'planned' as const, data: {} },
  { id: 'e-gated', name: 'Gate Drained', lifecycle: 'planned' as const, data: {} },
  { id: 'e-none', name: 'Nothing Produced', lifecycle: 'planned' as const, data: {} },
];

const derived: DerivedLifecycleMap = new Map([
  ['e-shape', { lifecycle: 'wired' as const, summary: 'config-complete (3/3 step(s) pass) on shape/static checks only — no L3/L4 gate has been drained, so runtime is UNPROVEN.', gatePasses: 0 }],
  ['e-gated', { lifecycle: 'verified' as const, summary: 'config-complete (3/3 step(s) pass) AND 1 drained L3/L4 gate(s) pass — runtime proven.', gatePasses: 1 }],
]);

function renderTree(map?: DerivedLifecycleMap) {
  render(
    <CatalogTree
      t={LIGHT} groups={groups} selectedCatalogId="items"
      entities={entities} selectedEntityId={null}
      onSelectCatalog={() => {}} onSelectEntity={() => {}}
      derivedLifecycle={map}
    />,
  );
}

describe('CatalogTree — derived lifecycle dots', () => {
  it('paints the DERIVED state, not the seed default', () => {
    renderTree(derived);
    expect(screen.getByTestId('entity-lifecycle-e-shape').getAttribute('data-lifecycle')).toBe('wired');
    expect(screen.getByTestId('entity-lifecycle-e-gated').getAttribute('data-lifecycle')).toBe('verified');
  });

  it('a shape-only config-complete entity is NOT announced as passed', () => {
    renderTree(derived);
    // `verified` is the only lifecycle that collapses onto the pass axis…
    expect(screen.getByRole('button', { name: /Gate Drained: passed/i })).toBeTruthy();
    // …a `wired` (shape-only) entity announces as pending, never passed.
    expect(screen.getByRole('button', { name: /Shape Only: pending/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Shape Only: passed/i })).toBeNull();
  });

  it('the dot tooltip names the evidence, and says when runtime is unproven', () => {
    renderTree(derived);
    expect(screen.getByTestId('entity-lifecycle-e-shape').getAttribute('title')).toMatch(/UNPROVEN/);
    expect(screen.getByTestId('entity-lifecycle-e-gated').getAttribute('title')).toMatch(/drained L3\/L4 gate/);
  });

  it('falls back to the seed lifecycle — and SAYS it is the seeded default — when nothing was derived', () => {
    renderTree(derived);
    const none = screen.getByTestId('entity-lifecycle-e-none');
    expect(none.getAttribute('data-lifecycle')).toBe('planned');
    expect(none.getAttribute('title')).toMatch(/seeded default/i);
  });

  it('renders unchanged when no derivation is supplied at all', () => {
    renderTree(undefined);
    for (const e of entities) {
      expect(screen.getByTestId(`entity-lifecycle-${e.id}`).getAttribute('data-lifecycle')).toBe('planned');
    }
  });
});
