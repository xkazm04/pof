import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PaneIdContext, usePaneHold, getPaneHolds } from '@/hooks/usePaneHold';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

function Holder({ active, reason }: { active: boolean; reason: string }) {
  usePaneHold(active, reason);
  return <div>holder</div>;
}

describe('usePaneHold declares in-flight work for the pane it renders in', () => {
  it('registers the hold under the pane id, and releases it when active turns false', () => {
    const { rerender } = render(
      <PaneIdContext.Provider value="packaging">
        <Holder active reason="x" />
      </PaneIdContext.Provider>,
    );
    expect(getPaneHolds()).toEqual({ packaging: ['x'] });

    rerender(
      <PaneIdContext.Provider value="packaging">
        <Holder active={false} reason="x" />
      </PaneIdContext.Provider>,
    );
    expect(getPaneHolds()).toEqual({});
  });

  it('releases the hold on unmount — the registry cannot outlive its holders', () => {
    const { unmount } = render(
      <PaneIdContext.Provider value="packaging">
        <Holder active reason="x" />
      </PaneIdContext.Provider>,
    );
    expect(getPaneHolds()).toEqual({ packaging: ['x'] });
    unmount();
    expect(getPaneHolds()).toEqual({});
  });

  it('keeps one entry per holder, so one holder releasing leaves the other standing', () => {
    const { rerender } = render(
      <PaneIdContext.Provider value="arpg-combat">
        <Holder active reason="scan batch" />
        <Holder active reason="checklist batch" />
      </PaneIdContext.Provider>,
    );
    expect(getPaneHolds()['arpg-combat']).toEqual(['scan batch', 'checklist batch']);

    rerender(
      <PaneIdContext.Provider value="arpg-combat">
        <Holder active={false} reason="scan batch" />
        <Holder active reason="checklist batch" />
      </PaneIdContext.Provider>,
    );
    expect(getPaneHolds()).toEqual({ 'arpg-combat': ['checklist batch'] });
  });

  it('[guard] is a no-op outside a shell pane (the lab, previews, tests) — no throw, nothing held', () => {
    expect(() => render(<Holder active reason="x" />)).not.toThrow();
    expect(getPaneHolds()).toEqual({});
  });
});
