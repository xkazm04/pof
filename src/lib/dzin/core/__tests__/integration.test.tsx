import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createRegistry } from '../registry';
import { serializeRegistry } from '../registry';
import {
  dataListDefinition,
  detailDefinition,
  mediaGridDefinition,
  DataListPanel,
} from '../demo';
import { DensityProvider } from '../density';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// End-to-end integration: registry + density + demo panel rendering
// ---------------------------------------------------------------------------

describe('Integration: Registry + Density + Demo Panels', () => {
  it('registry registers all 3 demo panels and getAll() returns 3', () => {
    const registry = createRegistry();
    registry.register(dataListDefinition);
    registry.register(detailDefinition);
    registry.register(mediaGridDefinition);

    expect(registry.getAll()).toHaveLength(3);
  });

  it('registry getByDomain("demo") returns all 3 panels', () => {
    const registry = createRegistry();
    registry.register(dataListDefinition);
    registry.register(detailDefinition);
    registry.register(mediaGridDefinition);

    const demoPanels = registry.getByDomain('demo');
    expect(demoPanels).toHaveLength(3);

    const types = demoPanels.map((p) => p.type).sort();
    expect(types).toEqual(['demo-data-list', 'demo-detail', 'demo-media-grid']);
  });

  it('DataListPanel inside DensityProvider at micro has data-dzin-density="micro"', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <DataListPanel />
      </DensityProvider>,
    );

    const panel = container.querySelector('[data-dzin-panel]');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute('data-dzin-density')).toBe('micro');
  });

  it('DataListPanel inside DensityProvider at full renders list items', () => {
    const { container } = render(
      <DensityProvider density="full">
        <DataListPanel />
      </DensityProvider>,
    );

    const items = container.querySelectorAll('[data-dzin-list-item]');
    expect(items.length).toBeGreaterThan(0);
    // Verify actual content is rendered
    expect(container.textContent).toContain('Aurora Campaign');
  });

  it('serializeRegistry() after registering demo panels returns 3 panels without component field', () => {
    const registry = createRegistry();
    registry.register(dataListDefinition);
    registry.register(detailDefinition);
    registry.register(mediaGridDefinition);

    const serialized = serializeRegistry(registry);

    expect(serialized.count).toBe(3);
    expect(serialized.panels).toHaveLength(3);

    // Verify no component field in serialized output
    for (const panel of serialized.panels) {
      expect(panel).not.toHaveProperty('component');
      // Verify essential fields ARE present
      expect(panel.type).toBeDefined();
      expect(panel.label).toBeDefined();
      expect(panel.domains).toContain('demo');
      expect(panel.densityModes).toBeDefined();
    }
  });
});
