/** The harness tabs keep the ARIA tab contract: panels, aria-controls and arrow-key movement. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTestRunner', () => ({
  useTestRunner: () => ({ runTest: vi.fn(), results: [], isRunning: false, error: null, clearResults: vi.fn(), abort: vi.fn() }),
}));
vi.mock('@/hooks/useSnapshots', () => ({
  useSnapshots: () => ({
    capture: vi.fn(), acceptBaselines: vi.fn(), diffReport: null, isCapturing: false, error: null, refreshDiff: vi.fn(),
  }),
}));
vi.mock('@/components/modules/project-setup/TestHarnessPanel/WaitingTestsTab', () => ({ WaitingTestsTab: () => null }));

import { TestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel';

afterEach(() => cleanup());

describe('Test Harness tabs', () => {
  it('every tab controls a tabpanel that the tab labels', () => {
    render(<TestHarnessPanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(4);
    expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(4);
    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      const panel = document.getElementById(panelId!);
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    }
  });

  it('ArrowRight moves focus and selection to the next tab; ArrowLeft wraps', () => {
    render(<TestHarnessPanel />);
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[3]);
    expect(tabs[3].getAttribute('aria-selected')).toBe('true');
  });

  it('only the selected tab is in the tab order', () => {
    render(<TestHarnessPanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
  });
});
