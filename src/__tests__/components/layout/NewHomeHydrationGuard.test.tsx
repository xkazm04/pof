import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// The guard is what is under test — stub the heavy branches it gates.
vi.mock('@/hooks/usePofBridge', () => ({ usePofBridge: () => undefined }));
vi.mock('@/components/layout-lab/LayoutLab', () => ({
  LayoutLab: () => <div data-testid="lab" />,
}));
vi.mock('@/components/modules/project-setup/SetupWizard', () => ({
  SetupWizard: () => <div data-testid="wizard" />,
}));

import { NewHome } from '@/components/layout-lab/NewHome';
import { useProjectStore } from '@/stores/projectStore';

describe('NewHome hydration guard genuinely consults Zustand persist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useProjectStore.setState({ isSetupComplete: true });
  });

  it('holds the skeleton while persist reports un-hydrated, and reveals on onFinishHydration', () => {
    let notify: (() => void) | null = null;
    let hydrated = false;

    vi.spyOn(useProjectStore.persist, 'hasHydrated').mockImplementation(() => hydrated);
    vi.spyOn(useProjectStore.persist, 'onFinishHydration').mockImplementation((cb) => {
      notify = cb as () => void;
      return () => {};
    });

    const { queryByTestId } = render(<NewHome />);

    // The guard read the persist flag — not a hard-coded `true`.
    expect(queryByTestId('new-home-skeleton')).not.toBeNull();
    expect(queryByTestId('lab')).toBeNull();
    expect(notify).not.toBeNull();

    // Persist finishing is what reveals the shell.
    hydrated = true;
    act(() => notify!());

    expect(queryByTestId('new-home-skeleton')).toBeNull();
    expect(queryByTestId('lab')).not.toBeNull();
  });

  it('adds no skeleton flash with the real (synchronous localStorage) store', () => {
    // Measured, not assumed: createJSONStorage(() => localStorage) rehydrates
    // before first render, so the honest guard is already satisfied on paint 1.
    expect(useProjectStore.persist.hasHydrated()).toBe(true);

    const { queryByTestId } = render(<NewHome />);
    expect(queryByTestId('new-home-skeleton')).toBeNull();
    expect(queryByTestId('lab')).not.toBeNull();
  });

  it('shows the wizard, not the lab, once hydrated with no project', () => {
    useProjectStore.setState({ isSetupComplete: false });
    const { queryByTestId } = render(<NewHome />);
    expect(queryByTestId('wizard')).not.toBeNull();
  });
});
