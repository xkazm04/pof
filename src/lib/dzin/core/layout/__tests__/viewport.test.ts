import { describe, it, expect } from 'vitest';
import { getAllowedLayouts, clampLayoutToViewport, VIEWPORT_BREAKPOINTS } from '../viewport';

describe('VIEWPORT_BREAKPOINTS', () => {
  it('has mobile, tablet, desktop thresholds', () => {
    expect(VIEWPORT_BREAKPOINTS.mobile).toBeDefined();
    expect(VIEWPORT_BREAKPOINTS.tablet).toBeDefined();
    expect(VIEWPORT_BREAKPOINTS.desktop).toBeDefined();
    expect(VIEWPORT_BREAKPOINTS.mobile).toBeLessThan(VIEWPORT_BREAKPOINTS.tablet);
    expect(VIEWPORT_BREAKPOINTS.tablet).toBeLessThan(VIEWPORT_BREAKPOINTS.desktop);
  });
});

describe('getAllowedLayouts', () => {
  it('at 600px returns only stack and single', () => {
    const allowed = getAllowedLayouts(600);
    expect(allowed).toContain('stack');
    expect(allowed).toContain('single');
    expect(allowed).not.toContain('split-2');
    expect(allowed).not.toContain('grid-4');
    expect(allowed).not.toContain('studio');
  });

  it('at 900px includes split-2 and primary-sidebar', () => {
    const allowed = getAllowedLayouts(900);
    expect(allowed).toContain('split-2');
    expect(allowed).toContain('primary-sidebar');
    expect(allowed).not.toContain('grid-4');
    expect(allowed).not.toContain('studio');
  });

  it('at 1100px includes split-3 and triptych', () => {
    const allowed = getAllowedLayouts(1100);
    expect(allowed).toContain('split-3');
    expect(allowed).toContain('triptych');
    expect(allowed).not.toContain('studio');
  });

  it('at 1400px includes all layouts including studio and grid-4', () => {
    const allowed = getAllowedLayouts(1400);
    expect(allowed).toContain('single');
    expect(allowed).toContain('split-2');
    expect(allowed).toContain('split-3');
    expect(allowed).toContain('grid-4');
    expect(allowed).toContain('primary-sidebar');
    expect(allowed).toContain('triptych');
    expect(allowed).toContain('studio');
  });
});

describe('clampLayoutToViewport', () => {
  it('downgrades studio at 800px', () => {
    const clamped = clampLayoutToViewport('studio', 800);
    expect(clamped).not.toBe('studio');
    expect(['split-2', 'primary-sidebar', 'single']).toContain(clamped);
  });

  it('downgrades grid-4 at 900px', () => {
    const clamped = clampLayoutToViewport('grid-4', 900);
    expect(clamped).not.toBe('grid-4');
    // Should downgrade to something allowed at 900px
    const allowed = getAllowedLayouts(900);
    expect(allowed).toContain(clamped);
  });

  it('keeps split-2 at 1000px', () => {
    const clamped = clampLayoutToViewport('split-2', 1000);
    expect(clamped).toBe('split-2');
  });

  it('keeps single at any width', () => {
    expect(clampLayoutToViewport('single', 400)).toBe('single');
    expect(clampLayoutToViewport('single', 1920)).toBe('single');
  });

  it('keeps studio at 1400px', () => {
    expect(clampLayoutToViewport('studio', 1400)).toBe('studio');
  });
});
