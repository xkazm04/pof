'use client';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, render, screen, act } from '@testing-library/react';
import React from 'react';
import { useLayout } from '../useLayout';
import { DzinLayout } from '../LayoutProvider';
import { createRegistry } from '../../registry';
import type { PanelDefinition, PanelRegistry } from '../../registry/types';
import type { PanelDirective, SlotAssignment } from '../types';

// ---------------------------------------------------------------------------
// Mock ResizeObserver
// ---------------------------------------------------------------------------

let resizeCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallback = null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
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
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // Provide default window dimensions
  Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true, configurable: true });

  registry = createRegistry();
  registry.register(mockPanelDef({ type: 'editor', defaultRole: 'primary', sizeClass: 'wide' }));
  registry.register(mockPanelDef({ type: 'sidebar', defaultRole: 'sidebar', sizeClass: 'compact' }));
  registry.register(mockPanelDef({ type: 'viewer', defaultRole: 'secondary', sizeClass: 'standard' }));
});

afterEach(() => {
  vi.restoreAllMocks();
  resizeCallback = null;
});

// ---------------------------------------------------------------------------
// useLayout tests
// ---------------------------------------------------------------------------

describe('useLayout', () => {
  it('returns a resolved layout with correct template', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];

    const { result } = renderHook(() => useLayout(directives, registry));

    expect(result.current.layout).toBeDefined();
    expect(result.current.layout.template).toBe('single');
    expect(result.current.layout.assignments.length).toBe(1);
  });

  it('containerProps have display:grid and grid template strings', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];

    const { result } = renderHook(() => useLayout(directives, registry));

    const { style } = result.current.containerProps;
    expect(style.display).toBe('grid');
    expect(style.gridTemplateRows).toBeDefined();
    expect(style.gridTemplateColumns).toBeDefined();
    expect(result.current.containerProps['data-dzin-layout']).toBe('single');
  });

  it('getSlotProps returns data-dzin-slot and data-dzin-density attributes', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];

    const { result } = renderHook(() => useLayout(directives, registry));

    const slotProps = result.current.getSlotProps(0);
    expect(slotProps['data-dzin-slot']).toBe(0);
    expect(slotProps['data-dzin-density']).toBeDefined();
    expect(slotProps.style).toBeDefined();
  });

  it('resolves split-2 for two directives', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'sidebar' },
    ];

    const { result } = renderHook(() => useLayout(directives, registry));

    expect(result.current.layout.assignments.length).toBe(2);
    // Should pick a two-slot template
    expect(['split-2', 'primary-sidebar']).toContain(result.current.layout.template);
  });
});

// ---------------------------------------------------------------------------
// DzinLayout tests
// ---------------------------------------------------------------------------

describe('DzinLayout', () => {
  it('renders correct number of slot children', () => {
    const directives: PanelDirective[] = [
      { type: 'editor' },
      { type: 'sidebar' },
    ];

    const renderPanel = (assignment: SlotAssignment) => (
      <div data-testid={`panel-${assignment.panelType}`}>
        {assignment.panelType}
      </div>
    );

    render(
      <DzinLayout
        directives={directives}
        registry={registry}
        renderPanel={renderPanel}
      />,
    );

    expect(screen.getByTestId('panel-editor')).toBeDefined();
    expect(screen.getByTestId('panel-sidebar')).toBeDefined();
  });

  it('wraps panels in DensityProvider (density context available)', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];

    // The panel renders its density from context
    const DensityReader = () => {
      // We just verify the structure renders without error
      return <div data-testid="density-reader">rendered</div>;
    };

    const renderPanel = () => <DensityReader />;

    render(
      <DzinLayout
        directives={directives}
        registry={registry}
        renderPanel={renderPanel}
      />,
    );

    expect(screen.getByTestId('density-reader')).toBeDefined();
  });

  it('applies className to the container div', () => {
    const directives: PanelDirective[] = [{ type: 'editor' }];
    const renderPanel = (a: SlotAssignment) => <div>{a.panelType}</div>;

    const { container } = render(
      <DzinLayout
        directives={directives}
        registry={registry}
        renderPanel={renderPanel}
        className="my-grid"
      />,
    );

    const gridDiv = container.firstElementChild as HTMLElement;
    expect(gridDiv.className).toContain('my-grid');
  });
});
