import { describe, it, expect } from 'vitest';
import { assignPanelsToSlots } from '../assignment';
import { getTemplate } from '../templates';
import type { PanelDefinition, PanelRegistry } from '../../registry/types';
import type { PanelDirective } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
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

// ---------------------------------------------------------------------------
// assignPanelsToSlots
// ---------------------------------------------------------------------------

describe('assignPanelsToSlots', () => {
  it('returns empty array for empty directives', () => {
    const template = getTemplate('split-2')!;
    const registry = makeRegistry([]);
    const result = assignPanelsToSlots(template, [], registry);
    expect(result).toEqual([]);
  });

  it('assigns a single panel to a single-slot template', () => {
    const panel = makeDef({ type: 'editor', defaultRole: 'primary' });
    const registry = makeRegistry([panel]);
    const template = getTemplate('single')!;

    const result = assignPanelsToSlots(
      template,
      [{ type: 'editor' }],
      registry,
    );

    expect(result).toHaveLength(1);
    expect(result[0].panelType).toBe('editor');
    expect(result[0].slotIndex).toBe(0);
    expect(result[0].role).toBe('primary');
    expect(result[0].density).toBe('full');
  });

  it('correctly maps panels to best-fit slots', () => {
    const mainPanel = makeDef({ type: 'main', sizeClass: 'wide', defaultRole: 'primary' });
    const sidePanel = makeDef({ type: 'side', sizeClass: 'compact', defaultRole: 'sidebar', complexity: 'low' });
    const registry = makeRegistry([mainPanel, sidePanel]);

    const template = getTemplate('primary-sidebar')!;
    const directives: PanelDirective[] = [
      { type: 'main' },
      { type: 'side' },
    ];

    const result = assignPanelsToSlots(template, directives, registry);

    expect(result).toHaveLength(2);
    // main (wide, primary) should go to slot 0 (primary, all sizes)
    // side (compact, sidebar) should go to slot 1 (sidebar, compact only, narrow)
    const mainAssignment = result.find((a) => a.panelType === 'main');
    const sideAssignment = result.find((a) => a.panelType === 'side');
    expect(mainAssignment?.slotIndex).toBe(0);
    expect(sideAssignment?.slotIndex).toBe(1);
  });

  it('handles more panels than slots (drops extras)', () => {
    const p1 = makeDef({ type: 'p1', defaultRole: 'primary', sizeClass: 'wide' });
    const p2 = makeDef({ type: 'p2', defaultRole: 'secondary', sizeClass: 'standard' });
    const p3 = makeDef({ type: 'p3', defaultRole: 'tertiary', sizeClass: 'compact' });
    const registry = makeRegistry([p1, p2, p3]);

    const template = getTemplate('split-2')!; // Only 2 slots
    const directives: PanelDirective[] = [
      { type: 'p1' },
      { type: 'p2' },
      { type: 'p3' },
    ];

    const result = assignPanelsToSlots(template, directives, registry);

    // Should only have at most 2 assignments (number of real slots)
    expect(result.length).toBeLessThanOrEqual(2);
    // All assigned slot indices should be valid
    for (const a of result) {
      expect(a.slotIndex).toBeLessThan(template.slots.length);
    }
  });

  it('handles more slots than panels (leaves empty slots)', () => {
    const p1 = makeDef({ type: 'p1', defaultRole: 'primary' });
    const registry = makeRegistry([p1]);

    const template = getTemplate('split-3')!; // 3 slots
    const directives: PanelDirective[] = [{ type: 'p1' }];

    const result = assignPanelsToSlots(template, directives, registry);

    // Only 1 panel assigned to one of 3 slots
    expect(result).toHaveLength(1);
    expect(result[0].panelType).toBe('p1');
    expect(result[0].slotIndex).toBeLessThan(3);
  });

  it('preserves directive overrides (role, density, dataSlice)', () => {
    const panel = makeDef({ type: 'editor', defaultRole: 'primary' });
    const registry = makeRegistry([panel]);
    const template = getTemplate('single')!;

    const result = assignPanelsToSlots(
      template,
      [{ type: 'editor', role: 'secondary', density: 'compact', dataSlice: { entityId: '42' } }],
      registry,
    );

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('secondary');
    expect(result[0].density).toBe('compact');
    expect(result[0].dataSlice?.entityId).toBe('42');
  });

  it('skips unknown panel types without crashing', () => {
    const known = makeDef({ type: 'known' });
    const registry = makeRegistry([known]);
    const template = getTemplate('split-2')!;

    const result = assignPanelsToSlots(
      template,
      [{ type: 'known' }, { type: 'unknown' }],
      registry,
    );

    // Only the known panel gets assigned
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((a) => a.panelType === 'known')).toBe(true);
    expect(result.some((a) => a.panelType === 'unknown')).toBe(false);
  });

  it('assigns 4 panels to grid-4 template', () => {
    const panels = ['a', 'b', 'c', 'd'].map((id) =>
      makeDef({ type: id, defaultRole: id === 'a' ? 'primary' : id === 'b' ? 'secondary' : id === 'c' ? 'tertiary' : 'sidebar' }),
    );
    const registry = makeRegistry(panels);
    const template = getTemplate('grid-4')!;

    const directives: PanelDirective[] = panels.map((p) => ({ type: p.type }));
    const result = assignPanelsToSlots(template, directives, registry);

    expect(result).toHaveLength(4);
    // All slot indices should be unique
    const slotIndices = result.map((a) => a.slotIndex);
    expect(new Set(slotIndices).size).toBe(4);
  });
});
