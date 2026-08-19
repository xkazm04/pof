import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// useReducedMotion reads matchMedia (absent in jsdom).
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
// Keep the state-machine tab's bridge disconnected (it mounts lazily anyway).
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import { AnimationsView } from '@/components/modules/content/animations/AnimationsView';
import { ANIMATION_STEPS } from '@/components/modules/content/animations/AnimationChecklist';
import { useModuleStore } from '@/stores/moduleStore';
import { resolveProgressKey } from '@/lib/checklist-progress-keys';

const MIXAMO = 'step-mixamo-download';

function seedProgress(progress: Record<string, boolean>) {
  useModuleStore.setState({ checklistProgress: { animations: progress } });
}

function openSetupGuide(container: HTMLElement) {
  const tab = Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === 'Setup Guide',
  );
  expect(tab, 'Setup Guide tab button').toBeTruthy();
  act(() => { fireEvent.click(tab!); });
  const panel = container.querySelector('[data-testid="pof-module-arpg-animation-tab-setup"]');
  expect(panel, 'Setup Guide panel').toBeTruthy();
  return panel as HTMLElement;
}

function renderSetupGuide() {
  const view = render(<AnimationsView />);
  const panel = openSetupGuide(view.container);
  return { ...view, panel };
}

/**
 * "Progress 3/6" — read the element that IS the readout, not a substring of the
 * concatenated panel text (the next step's number would run into the total).
 */
function progressText(panel: HTMLElement) {
  const el = Array.from(panel.querySelectorAll('div')).find((d) =>
    /^Progress \d+\/\d+$/.test((d.textContent ?? '').trim()),
  );
  expect(el, 'progress readout').toBeTruthy();
  return (el!.textContent ?? '').trim();
}

/** A step card is "complete" when its badge reads OK instead of its type label. */
function stepCardFor(panel: HTMLElement, stepId: string) {
  return panel.querySelector(
    `[data-testid="pof-module-arpg-animation-step-${stepId}"]`,
  ) as HTMLElement | null;
}

beforeEach(() => {
  useModuleStore.setState({ checklistProgress: {} });
});

describe('the Setup Guide progress bar hydrates from the persisted store', () => {
  it('shows a step completed on first render when the store already holds it', () => {
    seedProgress({ [MIXAMO]: true });
    const { panel } = renderSetupGuide();

    expect(progressText(panel)).toBe(`Progress 1/${ANIMATION_STEPS.length}`);
    const card = stepCardFor(panel, MIXAMO);
    expect(card, 'the Mixamo step card').toBeTruthy();
    expect(card!.textContent).toContain('OK');
  });

  it('counts every persisted step, not just the last one written', () => {
    seedProgress({ 'step-commandlet-assets': true, [MIXAMO]: true, 'step-animbp': true });
    const { panel } = renderSetupGuide();
    expect(progressText(panel)).toBe(`Progress 3/${ANIMATION_STEPS.length}`);
  });

  it('ignores a step recorded as explicitly NOT complete', () => {
    seedProgress({ [MIXAMO]: false });
    const { panel } = renderSetupGuide();
    expect(progressText(panel)).toBe(`Progress 0/${ANIMATION_STEPS.length}`);
  });

  it('is not confused by the state-machine keys that share the module namespace', () => {
    // AnimationStateMachine writes `anim-*` / `scanned-*` keys into the SAME
    // module progress record — they must not inflate the Setup Guide count.
    seedProgress({ [MIXAMO]: true, 'anim-idle': true, 'scanned-Attack': true });
    const { panel } = renderSetupGuide();
    expect(progressText(panel)).toBe(`Progress 1/${ANIMATION_STEPS.length}`);
  });

  it('survives an unmount/remount of the view', () => {
    seedProgress({ [MIXAMO]: true });
    const first = renderSetupGuide();
    expect(progressText(first.panel)).toBe(`Progress 1/${ANIMATION_STEPS.length}`);
    first.unmount();

    const second = renderSetupGuide();
    expect(progressText(second.panel)).toBe(`Progress 1/${ANIMATION_STEPS.length}`);
  });
});

describe('marking a Setup Guide step complete still writes through', () => {
  it('writes to the store and moves the bar in the same act', () => {
    const { panel } = renderSetupGuide();
    expect(progressText(panel)).toBe(`Progress 0/${ANIMATION_STEPS.length}`);

    // Expand the card so its "Verify Complete" button mounts.
    const toggle = panel.querySelector(
      `[data-testid="pof-module-arpg-animation-toggle-${MIXAMO}"]`,
    ) as HTMLElement | null;
    expect(toggle, 'step card toggle').toBeTruthy();
    act(() => { fireEvent.click(toggle!); });

    const markBtn = panel.querySelector(
      `[data-testid="pof-module-arpg-animation-mark-${MIXAMO}"]`,
    ) as HTMLElement | null;
    expect(markBtn, 'Verify Complete button after expanding the card').toBeTruthy();
    act(() => { fireEvent.click(markBtn!); });

    expect(useModuleStore.getState().checklistProgress.animations?.[MIXAMO]).toBe(true);
    expect(progressText(panel)).toBe(`Progress 1/${ANIMATION_STEPS.length}`);
  });

  it('introduces no new progress key namespace — every step id still resolves as aux', () => {
    for (const step of ANIMATION_STEPS) {
      expect(resolveProgressKey('animations', step.id).kind).toBe('aux');
    }
  });
});
