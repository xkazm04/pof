import { describe, it, expect, beforeEach } from 'vitest';
import { resolveLayout } from '../resolver';
import { createRegistry } from '../../registry';
import type { PanelDefinition, PanelRegistry } from '../../registry/types';
import type { PanelDirective } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function mockPanelDef(overrides: Partial<PanelDefinition>): PanelDefinition {
  return {
    type: 'test',
    label: 'Test',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'medium',
    domains: ['test'],
    description: 'Test panel',
    capabilities: [],
    useCases: [],
    inputs: [],
    outputs: [],
    densityModes: {
      full: { minWidth: 400, minHeight: 300, description: 'full' },
      compact: { minWidth: 180, minHeight: 120, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    },
    component: () => null,
    ...overrides,
  } as unknown as PanelDefinition;
}

let registry: PanelRegistry;

beforeEach(() => {
  registry = createRegistry();

  registry.register(mockPanelDef({
    type: 'editor',
    label: 'Editor',
    defaultRole: 'primary',
    sizeClass: 'wide',
    complexity: 'high',
  }));

  registry.register(mockPanelDef({
    type: 'sidebar-panel',
    label: 'Sidebar',
    defaultRole: 'sidebar',
    sizeClass: 'compact',
    complexity: 'low',
  }));

  registry.register(mockPanelDef({
    type: 'detail',
    label: 'Detail',
    defaultRole: 'secondary',
    sizeClass: 'standard',
    complexity: 'medium',
  }));

  registry.register(mockPanelDef({
    type: 'aux',
    label: 'Aux',
    defaultRole: 'tertiary',
    sizeClass: 'compact',
    complexity: 'low',
  }));
});

const DESKTOP_VP = { width: 1920, height: 1080 };
const TABLET_VP = { width: 900, height: 700 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveLayout', () => {
  it('1 directive at 1920x1080 resolves to single template with 1 assignment', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.template).toBe('single');
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].panelType).toBe('editor');
  });

  it('2 directives (both wide) resolves to split-2', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'detail' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.template).toBe('split-2');
    expect(result.assignments).toHaveLength(2);
  });

  it('2 directives (1 primary wide + 1 sidebar compact) resolves to primary-sidebar', () => {
    const directives: PanelDirective[] = [
      { type: 'editor', role: 'primary' },
      { type: 'sidebar-panel', role: 'sidebar' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.template).toBe('primary-sidebar');
    expect(result.assignments).toHaveLength(2);
  });

  it('3 directives at desktop resolves to split-3 or triptych', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'detail' },
      { type: 'aux' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(['split-3', 'triptych']).toContain(result.template);
    expect(result.assignments).toHaveLength(3);
  });

  it('preferredTemplate option is honored if viewport allows it', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'detail' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP, {
      preferredTemplate: 'primary-sidebar',
    });

    expect(result.template).toBe('primary-sidebar');
  });

  it('preferredTemplate is downgraded if viewport too small', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'detail' },
    ];
    const result = resolveLayout(directives, registry, { width: 600, height: 800 }, {
      preferredTemplate: 'studio',
    });

    // studio not allowed at 600px, should downgrade
    expect(result.template).not.toBe('studio');
  });

  it('assignments include correct widthPx and heightPx', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.assignments[0].widthPx).toBeGreaterThan(0);
    expect(result.assignments[0].heightPx).toBeGreaterThan(0);
    // Single template at 1920x1080 => full viewport
    expect(result.assignments[0].widthPx).toBeCloseTo(1920, -1);
    expect(result.assignments[0].heightPx).toBeCloseTo(1080, -1);
  });

  it('assignments include density for each slot', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'detail' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    for (const assignment of result.assignments) {
      expect(['full', 'compact', 'micro']).toContain(assignment.density);
    }
  });

  it('explicit density in directive flows through to assignment', () => {
    const directives: PanelDirective[] = [
      { type: 'editor', density: 'micro' },
    ];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.assignments[0].density).toBe('micro');
  });

  it('includes gridTemplateRows and gridTemplateColumns', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];
    const result = resolveLayout(directives, registry, DESKTOP_VP);

    expect(result.gridTemplateRows).toBeDefined();
    expect(result.gridTemplateColumns).toBeDefined();
    expect(typeof result.gridTemplateRows).toBe('string');
    expect(typeof result.gridTemplateColumns).toBe('string');
  });

  it('returns empty assignments for empty directives', () => {
    const result = resolveLayout([], registry, DESKTOP_VP);
    expect(result.assignments).toHaveLength(0);
  });
});
