import { describe, it, expect } from 'vitest';
import { scorePanelForSlot, scoreTemplateForDirectives } from '../scoring';
import { getTemplate } from '../templates';
import type { PanelDefinition, PanelRegistry } from '../../registry/types';
import type { PanelDirective, SlotSpec } from '../types';

// ---------------------------------------------------------------------------
// Test helpers: minimal mock registry
// ---------------------------------------------------------------------------

function makeDef(overrides: Partial<PanelDefinition>): PanelDefinition {
  return {
    type: 'test-panel',
    label: 'Test',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'medium',
    domains: [],
    description: '',
    capabilities: [],
    useCases: [],
    inputs: [],
    outputs: [],
    densityModes: {},
    component: (() => null) as unknown as PanelDefinition['component'],
    ...overrides,
  };
}

function makeRegistry(defs: PanelDefinition[]): PanelRegistry {
  const map = new Map(defs.map((d) => [d.type, d]));
  return {
    register: () => {},
    get: (type: string) => map.get(type),
    getByDomain: () => [],
    getAll: () => defs,
    has: (type: string) => map.has(type),
  };
}

function makeSlot(overrides: Partial<SlotSpec> = {}): SlotSpec {
  return {
    style: {},
    acceptsSizes: ['compact', 'standard', 'wide'],
    preferredRole: 'primary',
    isNarrow: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scorePanelForSlot
// ---------------------------------------------------------------------------

describe('scorePanelForSlot', () => {
  it('returns lower cost when role matches', () => {
    const panel = makeDef({ defaultRole: 'primary', sizeClass: 'standard' });
    const matchingSlot = makeSlot({ preferredRole: 'primary' });
    const mismatchSlot = makeSlot({ preferredRole: 'sidebar' });

    const matchCost = scorePanelForSlot(panel, 'primary', matchingSlot);
    const mismatchCost = scorePanelForSlot(panel, 'primary', mismatchSlot);
    expect(matchCost).toBeLessThan(mismatchCost);
  });

  it('returns lower cost when size is compatible', () => {
    const panel = makeDef({ sizeClass: 'wide' });
    const compatSlot = makeSlot({ acceptsSizes: ['wide', 'standard'] });
    const incompatSlot = makeSlot({ acceptsSizes: ['compact'] });

    const compatCost = scorePanelForSlot(panel, 'primary', compatSlot);
    const incompatCost = scorePanelForSlot(panel, 'primary', incompatSlot);
    expect(compatCost).toBeLessThan(incompatCost);
  });

  it('penalizes high-complexity panels in narrow slots', () => {
    const highPanel = makeDef({ complexity: 'high', sizeClass: 'compact' });
    const lowPanel = makeDef({ complexity: 'low', sizeClass: 'compact' });
    const narrowSlot = makeSlot({ isNarrow: true, acceptsSizes: ['compact'] });

    const highCost = scorePanelForSlot(highPanel, 'primary', narrowSlot);
    const lowCost = scorePanelForSlot(lowPanel, 'primary', narrowSlot);
    expect(highCost).toBeGreaterThan(lowCost);
  });

  it('gives bonus for compact panel in narrow slot', () => {
    const compactPanel = makeDef({ sizeClass: 'compact' });
    const narrowSlot = makeSlot({ isNarrow: true, acceptsSizes: ['compact'] });
    const wideSlot = makeSlot({ isNarrow: false, acceptsSizes: ['compact', 'standard', 'wide'] });

    const narrowCost = scorePanelForSlot(compactPanel, 'sidebar', narrowSlot);
    const wideCost = scorePanelForSlot(compactPanel, 'sidebar', wideSlot);
    expect(narrowCost).toBeLessThan(wideCost);
  });
});

// ---------------------------------------------------------------------------
// scoreTemplateForDirectives
// ---------------------------------------------------------------------------

describe('scoreTemplateForDirectives', () => {
  it('2 wide panels score higher for split-2 than primary-sidebar', () => {
    const widePanel1 = makeDef({ type: 'wide-a', sizeClass: 'wide', defaultRole: 'primary' });
    const widePanel2 = makeDef({ type: 'wide-b', sizeClass: 'wide', defaultRole: 'secondary' });
    const registry = makeRegistry([widePanel1, widePanel2]);

    const directives: PanelDirective[] = [
      { type: 'wide-a' },
      { type: 'wide-b' },
    ];

    const split2 = getTemplate('split-2')!;
    const primarySidebar = getTemplate('primary-sidebar')!;

    const split2Score = scoreTemplateForDirectives(split2, directives, registry);
    const sidebarScore = scoreTemplateForDirectives(primarySidebar, directives, registry);

    // split-2 accepts all sizes in both slots, primary-sidebar has narrow compact-only second slot
    expect(split2Score).toBeGreaterThan(sidebarScore);
  });

  it('1 primary + 1 sidebar role scores higher for primary-sidebar than split-2', () => {
    const mainPanel = makeDef({ type: 'main', sizeClass: 'wide', defaultRole: 'primary' });
    const sidePanel = makeDef({ type: 'side', sizeClass: 'compact', defaultRole: 'sidebar', complexity: 'low' });
    const registry = makeRegistry([mainPanel, sidePanel]);

    const directives: PanelDirective[] = [
      { type: 'main', role: 'primary' },
      { type: 'side', role: 'sidebar' },
    ];

    const primarySidebar = getTemplate('primary-sidebar')!;
    const split2 = getTemplate('split-2')!;

    const sidebarScore = scoreTemplateForDirectives(primarySidebar, directives, registry);
    const split2Score = scoreTemplateForDirectives(split2, directives, registry);

    expect(sidebarScore).toBeGreaterThan(split2Score);
  });

  it('exact slot count match gets bonus over mismatch', () => {
    const panel = makeDef({ type: 'p1', defaultRole: 'primary' });
    const registry = makeRegistry([panel]);

    const directives: PanelDirective[] = [{ type: 'p1' }];

    const single = getTemplate('single')!;    // 1 slot, 1 directive = match
    const split2 = getTemplate('split-2')!;   // 2 slots, 1 directive = mismatch

    const singleScore = scoreTemplateForDirectives(single, directives, registry);
    const split2Score = scoreTemplateForDirectives(split2, directives, registry);

    expect(singleScore).toBeGreaterThan(split2Score);
  });

  it('handles empty directives gracefully', () => {
    const registry = makeRegistry([]);
    const template = getTemplate('single')!;
    const score = scoreTemplateForDirectives(template, [], registry);
    // With 0 panels vs 1 slot, should get a count mismatch penalty
    expect(score).toBeLessThan(0);
  });

  it('handles unknown panel types gracefully', () => {
    const registry = makeRegistry([]);
    const template = getTemplate('single')!;
    const directives: PanelDirective[] = [{ type: 'nonexistent' }];
    // Should not throw
    const score = scoreTemplateForDirectives(template, directives, registry);
    expect(typeof score).toBe('number');
  });
});
