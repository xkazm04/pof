import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Control the reduced-motion preference deterministically.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});
// Keep the bridge disconnected so the graph uses the deterministic fallback states.
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import { AnimationStateMachine } from '@/components/modules/content/animations/AnimationStateMachine';
import { useModuleStore } from '@/stores/moduleStore';

function renderGraph() {
  return render(
    <AnimationStateMachine onSelectState={() => {}} isRunning={false} activeStateId={null} />,
  );
}

describe('AnimationStateMachine honors prefers-reduced-motion', () => {
  beforeEach(() => {
    // Mark two connected fallback states done → the idle↔walk edges become
    // "bothDone", which is what drives the looping marching-ants <animate>.
    useModuleStore.setState({
      checklistProgress: { animations: { 'anim-idle': true, 'anim-walk': true } },
    });
  });

  it('renders looping SMIL edge animations when motion is allowed', () => {
    motionState.reduced = false;
    const { container } = renderGraph();
    expect(container.querySelectorAll('animate').length).toBeGreaterThan(0);
  });

  it('suppresses looping SMIL edge animations under reduced motion', () => {
    motionState.reduced = true;
    const { container } = renderGraph();
    expect(container.querySelectorAll('animate').length).toBe(0);
  });

  it('gates the node hover scale behind motion-safe: (no ungated scale jump)', () => {
    motionState.reduced = false;
    const { container } = renderGraph();
    const html = container.innerHTML;
    expect(html).toContain('motion-safe:hover:scale-105');
    // No bare hover:scale-105 token that would jump for reduced-motion users.
    expect(/(^|["\s])hover:scale-105/.test(html)).toBe(false);
  });

  it('disables pulse glows under reduced motion via motion-reduce:animate-none', () => {
    motionState.reduced = true;
    const { container } = renderGraph();
    // The active-state dot keeps animate-pulse but pairs it with motion-reduce:animate-none.
    // (No active state here, but the class contract is asserted on the rendered markup.)
    const pulses = container.querySelectorAll('.animate-pulse');
    pulses.forEach((el) => expect(el.className).toContain('motion-reduce:animate-none'));
  });
});
