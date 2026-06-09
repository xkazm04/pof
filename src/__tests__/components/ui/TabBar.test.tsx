import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Activity, Target } from 'lucide-react';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { STATUS_ERROR } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// jsdom serializes inline hex colors to rgb(); compare against that form.
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

type Id = 'a' | 'b' | 'c';
const TABS: TabItem<Id>[] = [
  { id: 'a', label: 'Alpha', icon: Activity },
  { id: 'b', label: 'Beta', icon: Target, badge: { count: 3 } },
  { id: 'c', label: 'Gamma', badge: { count: 2, color: STATUS_ERROR, label: '2 alerts' } },
];

describe('TabBar', () => {
  it('renders a tablist with one tab per item and marks the active one selected', () => {
    render(<TabBar tabs={TABS} activeId="b" onChange={vi.fn()} layoutId="t1" accent={STATUS_ERROR} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('uses roving tabindex with only the active tab in the tab order', () => {
    render(<TabBar tabs={TABS} activeId="b" onChange={vi.fn()} layoutId="t1" accent={STATUS_ERROR} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the first tab in the tab order when none is active', () => {
    render(<TabBar tabs={TABS} activeId={'x' as Id} onChange={vi.fn()} layoutId="t1" accent={STATUS_ERROR} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<TabBar tabs={TABS} activeId="a" onChange={onChange} layoutId="t1" accent={STATUS_ERROR} />);
    fireEvent.click(screen.getByRole('tab', { name: /Gamma/ }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves between tabs with arrow keys and wraps around the ends', () => {
    const onChange = vi.fn();
    render(<TabBar tabs={TABS} activeId="a" onChange={onChange} layoutId="t1" accent={STATUS_ERROR} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c'); // wraps to last
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(tabs[0], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('renders a colored alert pill, a neutral count chip, and hides zero counts', () => {
    render(
      <TabBar
        tabs={[
          { id: 'a', label: 'Alpha', badge: { count: 0 } },
          { id: 'b', label: 'Beta', badge: { count: 3 } },
          { id: 'c', label: 'Gamma', badge: { count: 2, color: STATUS_ERROR, label: '2 alerts' } },
        ]}
        activeId="a"
        onChange={vi.fn()}
        layoutId="t1"
        accent={STATUS_ERROR}
      />,
    );
    const alertPill = screen.getByLabelText('2 alerts');
    expect(alertPill.textContent).toBe('2');
    expect((alertPill as HTMLElement).style.backgroundColor).toBe(rgbOf(STATUS_ERROR));
    // Neutral chip (no color) shows the bare count and carries no aria-label.
    expect(screen.getByText('3')).toBeTruthy();
    // A zero count renders no pill at all.
    expect(screen.queryByText('0')).toBeNull();
  });
});
