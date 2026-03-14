import { describe, it, expect } from 'vitest';
import { computeResize, initResizeState } from '../resize';
import type { PanelDefinition } from '../../registry/types';
import type { PanelDensity } from '../../types/panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal PanelDefinition for test purposes. */
function makePanelDef(overrides?: Partial<PanelDefinition>): PanelDefinition {
  return {
    type: 'test-panel',
    label: 'Test Panel',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'low',
    domains: ['test'],
    description: 'A test panel',
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
  } as PanelDefinition;
}

// ---------------------------------------------------------------------------
// initResizeState Tests
// ---------------------------------------------------------------------------

describe('initResizeState', () => {
  it('captures starting fractions and track index from current grid template', () => {
    const fractions = [0.5, 0.5];
    const panelDef = makePanelDef();
    const state = initResizeState('panel-1', 'right', 500, 300, fractions, 0, panelDef, 'full');

    expect(state.panelId).toBe('panel-1');
    expect(state.edge).toBe('right');
    expect(state.startX).toBe(500);
    expect(state.startY).toBe(300);
    expect(state.startFractions).toEqual([0.5, 0.5]);
    expect(state.trackIndex).toBe(0);
    expect(state.panelDef).toBe(panelDef);
    expect(state.lastDensity).toBe('full');
    expect(state.densityChangePx).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeResize Tests
// ---------------------------------------------------------------------------

describe('computeResize', () => {
  const containerWidth = 1000;
  const containerHeight = 800;

  it('returns original fractions unchanged when delta is 0 (idempotency)', () => {
    const panelDef = makePanelDef();
    const state = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    const result = computeResize(state, 0, 0, containerWidth, containerHeight);

    expect(result.fractions).toEqual([0.5, 0.5]);
  });

  it('increases left panel fraction with positive deltaX for right edge', () => {
    const panelDef = makePanelDef();
    const state = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    // Drag right by 100px in a 1000px container = 0.1 fraction change
    const result = computeResize(state, 100, 0, containerWidth, containerHeight);

    expect(result.fractions[0]).toBeCloseTo(0.6, 5);
    expect(result.fractions[1]).toBeCloseTo(0.4, 5);
  });

  it('decreases left panel fraction with negative deltaX for right edge', () => {
    const panelDef = makePanelDef();
    const state = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    // Drag left by 100px
    const result = computeResize(state, -100, 0, containerWidth, containerHeight);

    expect(result.fractions[0]).toBeCloseTo(0.4, 5);
    expect(result.fractions[1]).toBeCloseTo(0.6, 5);
  });

  it('clamps fractions so no panel goes below minimum (60px)', () => {
    const panelDef = makePanelDef();
    const state = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    // Drag right by 480px -- would make right panel only 20px (below 60px minimum)
    const result = computeResize(state, 480, 0, containerWidth, containerHeight);

    // Right panel should be clamped to 60px / 1000px = 0.06
    const rightWidthPx = result.fractions[1] * containerWidth;
    expect(rightWidthPx).toBeGreaterThanOrEqual(60);
    // Left panel should be 1 - clamped fraction
    expect(result.fractions[0] + result.fractions[1]).toBeCloseTo(1, 5);
  });

  it('returns correct density when panel crosses full->compact threshold (width drops below 400px)', () => {
    const panelDef = makePanelDef();
    // Start with a wide panel (500px of 1000px)
    const state = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    // Shrink left panel so it goes below 400px (drag left by 150px: 500 - 150 = 350px)
    // Need to account for hysteresis: must be 20px past the threshold
    // Below 400px - 20px buffer = 380px => drag left by 120+ px
    // Actually, first time crossing there's no buffer yet
    const result = computeResize(state, -150, 0, containerWidth, containerHeight);

    // Left panel: (0.5 * 1000) - 150 = 350px, should be compact
    expect(result.density).toBe('compact');
  });

  it('returns correct density when panel crosses compact->micro threshold (width drops below 180px)', () => {
    const panelDef = makePanelDef();
    // Start with panel at compact range
    const state = initResizeState('p1', 'right', 200, 400, [0.2, 0.8], 0, panelDef, 'compact');

    // Shrink further: 200 - 100 = 100px, below compact threshold (180)
    const result = computeResize(state, -100, 0, containerWidth, containerHeight);

    expect(result.density).toBe('micro');
  });

  it('applies density hysteresis -- requires 20px buffer before changing density again', () => {
    const panelDef = makePanelDef();
    // Panel starts at exactly 400px (full density threshold)
    const state = initResizeState('p1', 'right', 400, 400, [0.4, 0.6], 0, panelDef, 'full');

    // First resize: drag left by 10px -> 390px (below 400 threshold) -> density changes to compact
    const result1 = computeResize(state, -10, 0, containerWidth, containerHeight);
    expect(result1.density).toBe('compact');

    // Update state to reflect the density change happened at 390px
    const updatedState = {
      ...state,
      lastDensity: result1.density,
      densityChangePx: result1.widthPx,
    };

    // Second resize: drag right by 5px from original -> 395px (still below 400, but within 20px of where density changed)
    // Hysteresis: must move 20px past the threshold in the opposite direction to change back
    // densityChangePx was 390, need to go to 390 + 20 = 410px to go back to full
    const result2 = computeResize(updatedState, -5, 0, containerWidth, containerHeight);
    // 395px - still compact due to hysteresis (hasn't gone 20px past 400 threshold)
    expect(result2.density).toBe('compact');

    // Third resize: drag right enough to go past hysteresis buffer
    // Need widthPx > densityChangePx + 20 = 390 + 20 = 410
    const result3 = computeResize(updatedState, 15, 0, containerWidth, containerHeight);
    // 415px - past hysteresis buffer, should snap back to full
    expect(result3.density).toBe('full');
  });
});
