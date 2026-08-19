/**
 * The TopBar progress readout must not present numbers it cannot stand behind.
 *
 * `moduleStore` holds ONE global progress blob while the server row is per-project.
 * When a load fails (or a save is refused because the blob belongs to another
 * project), the percentage in the header is no longer this project's ground truth —
 * previously it just kept rendering, with no error anywhere in the app.
 *
 * RED before this change: `ProjectStats` had no knowledge of the error at all, so it
 * rendered the bar and fraction unchanged and there was no retry affordance.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useModuleStore } from '@/stores/moduleStore';
import { ProjectStats } from '@/components/layout/TopBar/ProjectStats';
import { TOTAL_CHECKLIST_ITEMS } from '@/components/layout/TopBar/constants';

beforeEach(() => {
  useModuleStore.setState({
    checklistProgress: {},
    progressProjectPath: '/proj/B',
    progressAdopted: true,
    progressLoadError: null,
    progressSaveError: null,
    progressLoadPath: null,
    isLoadingProgress: false,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProjectStats progress-error surface', () => {
  it('renders the numbers normally when there is no error', () => {
    const { container } = render(<ProjectStats />);
    expect(container.textContent).toContain(`0/${TOTAL_CHECKLIST_ITEMS}`);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('replaces the numbers with the load failure and a retry', () => {
    useModuleStore.setState({
      progressLoadError: 'Could not load this project\'s progress (offline). Showing nothing — the previously open project\'s marks were discarded rather than shown here.',
    });
    const { container } = render(<ProjectStats />);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('discarded');
    // The percentage claim is gone — it was never this project's.
    expect(container.textContent).not.toContain(`0/${TOTAL_CHECKLIST_ITEMS}`);
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('surfaces a refused save (the blob belongs to another project)', () => {
    useModuleStore.setState({
      progressSaveError:
        'Progress not saved: the loaded progress belongs to "/proj/A", but the open project is "/proj/B".',
    });
    const { container } = render(<ProjectStats />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('/proj/A');
    expect(alert?.textContent).toContain('/proj/B');
  });

  it('Retry re-runs the load for the failed path', () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    useModuleStore.setState({
      progressLoadError: 'Could not load this project\'s progress (offline).',
      progressLoadPath: '/proj/B',
      retryLoadProgress: retry,
    });
    render(<ProjectStats />);
    fireEvent.click(screen.getByText('Retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('dismiss clears both errors and the numbers come back', () => {
    useModuleStore.setState({ progressLoadError: 'boom' });
    const { container } = render(<ProjectStats />);
    fireEvent.click(screen.getByLabelText('Dismiss progress error'));
    expect(useModuleStore.getState().progressLoadError).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain(`0/${TOTAL_CHECKLIST_ITEMS}`);
  });
});
