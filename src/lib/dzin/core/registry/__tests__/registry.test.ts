import { describe, it, expect } from 'vitest';
import { createRegistry } from '../registry';
import { serializeRegistry } from '../serialize';
import type { PanelDefinition } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid PanelDefinition for testing. */
function makePanel(overrides: Partial<PanelDefinition> = {}): PanelDefinition {
  return {
    type: 'test-panel',
    label: 'Test Panel',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'medium',
    domains: ['story'],
    description: 'A test panel',
    capabilities: ['editing', 'viewing'],
    useCases: ['View story content'],
    inputs: [
      {
        name: 'storyId',
        type: 'string',
        description: 'The story to display',
        required: true,
      },
    ],
    outputs: [
      {
        name: 'selectedBeat',
        type: 'string',
        description: 'Currently selected beat ID',
      },
    ],
    densityModes: {
      full: { minWidth: 400, minHeight: 300, description: 'Full story view' },
      compact: { minWidth: 200, minHeight: 150, description: 'Compact story list' },
    },
    component: () => null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PanelRegistry', () => {
  it('registerPanel() stores a panel definition and getPanel(type) retrieves it', () => {
    const registry = createRegistry();
    const panel = makePanel();

    registry.register(panel);

    const retrieved = registry.get('test-panel');
    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe('test-panel');
    expect(retrieved!.label).toBe('Test Panel');
    expect(retrieved!.domains).toEqual(['story']);
  });

  it('registerPanel() with duplicate type throws an error', () => {
    const registry = createRegistry();
    const panel = makePanel();

    registry.register(panel);

    expect(() => registry.register(panel)).toThrow();
    expect(() => registry.register(makePanel({ label: 'Different Label' }))).toThrow();
  });

  it('getPanelsByDomain("story") returns only panels with "story" in their domains', () => {
    const registry = createRegistry();

    registry.register(makePanel({ type: 'story-editor', domains: ['story'] }));
    registry.register(makePanel({ type: 'char-card', domains: ['character'] }));
    registry.register(makePanel({ type: 'story-graph', domains: ['story', 'scene'] }));

    const storyPanels = registry.getByDomain('story');
    expect(storyPanels).toHaveLength(2);

    const types = storyPanels.map((p) => p.type);
    expect(types).toContain('story-editor');
    expect(types).toContain('story-graph');
    expect(types).not.toContain('char-card');
  });

  it('getAllPanels() returns all registered panels', () => {
    const registry = createRegistry();

    registry.register(makePanel({ type: 'a' }));
    registry.register(makePanel({ type: 'b' }));
    registry.register(makePanel({ type: 'c' }));

    const all = registry.getAll();
    expect(all).toHaveLength(3);
  });

  it('has() returns correct boolean for existence check', () => {
    const registry = createRegistry();
    expect(registry.has('test-panel')).toBe(false);

    registry.register(makePanel());
    expect(registry.has('test-panel')).toBe(true);
  });
});

describe('serializeRegistry', () => {
  it('returns structured object with all panel metadata', () => {
    const registry = createRegistry();
    registry.register(makePanel({ type: 'alpha', label: 'Alpha' }));
    registry.register(makePanel({ type: 'beta', label: 'Beta' }));

    const serialized = serializeRegistry(registry);

    expect(serialized.count).toBe(2);
    expect(serialized.panels).toHaveLength(2);

    const alpha = serialized.panels.find((p) => p.type === 'alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.label).toBe('Alpha');
    expect(alpha!.description).toBe('A test panel');
    expect(alpha!.capabilities).toEqual(['editing', 'viewing']);
    expect(alpha!.inputs).toHaveLength(1);
    expect(alpha!.outputs).toHaveLength(1);
    expect(alpha!.densityModes).toBeDefined();
    expect(alpha!.defaultRole).toBe('primary');
    expect(alpha!.sizeClass).toBe('standard');
    expect(alpha!.complexity).toBe('medium');
    expect(alpha!.domains).toEqual(['story']);
    expect(alpha!.useCases).toEqual(['View story content']);
  });

  it('serialized output does NOT include the component reference', () => {
    const registry = createRegistry();
    registry.register(makePanel());

    const serialized = serializeRegistry(registry);
    const panel = serialized.panels[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((panel as any).component).toBeUndefined();
  });
});

describe('Registry isolation', () => {
  it('createRegistry() returns isolated instances (two registries do not share state)', () => {
    const registryA = createRegistry();
    const registryB = createRegistry();

    registryA.register(makePanel({ type: 'only-in-a' }));

    expect(registryA.has('only-in-a')).toBe(true);
    expect(registryB.has('only-in-a')).toBe(false);
    expect(registryB.getAll()).toHaveLength(0);
  });
});
