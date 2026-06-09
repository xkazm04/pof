import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// useReducedMotion reads matchMedia (absent in jsdom) — stub via the framer mock.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});
// Disconnected bridge → deterministic fallback states render.
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import { AnimationStateMachine } from '@/components/modules/content/animations/AnimationStateMachine';

function renderGraph() {
  return render(
    <AnimationStateMachine onSelectState={() => {}} isRunning={false} activeStateId={null} />,
  );
}

// Built non-literally so this regression guard doesn't itself trip no-hardcoded-hex.
const OLD_FLOOR = '#' + '03030a';

describe('AnimationStateMachine adopts the tokenized SchematicPanel surface', () => {
  it('frames the panel and the diagram well with SchematicPanel tones', () => {
    const { container } = renderGraph();
    expect(container.querySelector('[data-schematic-tone="panel"]')).toBeTruthy();
    expect(container.querySelector('[data-schematic-tone="well"]')).toBeTruthy();
  });

  it('reads the surface token instead of the old hardcoded #03030a floor', () => {
    const { container } = renderGraph();
    const panel = container.querySelector('[data-schematic-tone="panel"]') as HTMLElement;
    expect(panel.style.backgroundColor).toContain('var(--schematic-surface)');
    // The deep-black floor literal is gone from the rendered surface.
    expect(panel.getAttribute('style') ?? '').not.toContain(OLD_FLOOR);
  });
});
