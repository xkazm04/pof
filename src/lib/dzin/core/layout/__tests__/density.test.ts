import { describe, it, expect } from 'vitest';
import { assignSlotDensity } from '../density';
import type { PanelDefinition } from '../../registry/types';

// Minimal mock panel with density modes
function mockPanel(densityModes: PanelDefinition['densityModes'] = {}): PanelDefinition {
  return {
    type: 'test-panel',
    label: 'Test Panel',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'medium',
    domains: ['test'],
    description: 'A test panel',
    capabilities: [],
    useCases: [],
    inputs: [],
    outputs: [],
    densityModes,
    component: () => null,
  } as unknown as PanelDefinition;
}

describe('assignSlotDensity', () => {
  it('picks "full" for large slot (600x400)', () => {
    const panel = mockPanel({
      full: { minWidth: 500, minHeight: 300, description: 'full' },
      compact: { minWidth: 200, minHeight: 150, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    });

    expect(assignSlotDensity(panel, 600, 400)).toBe('full');
  });

  it('picks "compact" for medium slot (200x150)', () => {
    const panel = mockPanel({
      full: { minWidth: 500, minHeight: 300, description: 'full' },
      compact: { minWidth: 200, minHeight: 150, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    });

    expect(assignSlotDensity(panel, 200, 150)).toBe('compact');
  });

  it('picks "micro" for small slot (80x60)', () => {
    const panel = mockPanel({
      full: { minWidth: 500, minHeight: 300, description: 'full' },
      compact: { minWidth: 200, minHeight: 150, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    });

    expect(assignSlotDensity(panel, 80, 60)).toBe('micro');
  });

  it('falls back to "micro" if nothing fits', () => {
    const panel = mockPanel({
      full: { minWidth: 500, minHeight: 300, description: 'full' },
      compact: { minWidth: 200, minHeight: 150, description: 'compact' },
      micro: { minWidth: 100, minHeight: 80, description: 'micro' },
    });

    // 30x20 is too small even for micro
    expect(assignSlotDensity(panel, 30, 20)).toBe('micro');
  });

  it('explicit density override always wins', () => {
    const panel = mockPanel({
      full: { minWidth: 500, minHeight: 300, description: 'full' },
      compact: { minWidth: 200, minHeight: 150, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    });

    // Slot is tiny but explicit says full
    expect(assignSlotDensity(panel, 80, 60, 'full')).toBe('full');
    // Slot is huge but explicit says micro
    expect(assignSlotDensity(panel, 1920, 1080, 'micro')).toBe('micro');
  });

  it('uses fallback thresholds when panel has no densityModes', () => {
    const panel = mockPanel({}); // No density modes at all

    // Large slot should still get full via fallback
    expect(assignSlotDensity(panel, 600, 400)).toBe('full');
    // Small slot should get compact or micro via fallback
    const small = assignSlotDensity(panel, 150, 100);
    expect(['compact', 'micro']).toContain(small);
  });
});
