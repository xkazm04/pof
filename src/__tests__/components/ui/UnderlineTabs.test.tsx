import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Bug } from 'lucide-react';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import type { UnderlineTab } from '@/components/ui/UnderlineTabs';
import { ACCENT_ROSE, ACCENT_VIOLET } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// jsdom serializes inline hex colors to rgb(); compare against that form.
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

type Id = 'a' | 'b' | 'c';

const TABS: UnderlineTab<Id>[] = [
  { id: 'a', label: 'Alpha', count: 3, accent: ACCENT_ROSE },
  { id: 'b', label: 'Beta', icon: Bug, count: 0 }, // count 0 still renders a pill
  { id: 'c', label: 'Gamma' }, // no count → no pill
];

describe('UnderlineTabs', () => {
  it('renders every tab as a role=tab and marks only the active one aria-selected', () => {
    render(<UnderlineTabs tabs={TABS} active="a" onChange={vi.fn()} accent={ACCENT_VIOLET} ariaLabel="Demo tabs" />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(screen.getByRole('tablist', { name: 'Demo tabs' })).toBeTruthy();

    expect(screen.getByRole('tab', { name: /Alpha/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Beta/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /Gamma/ }).getAttribute('aria-selected')).toBe('false');
  });

  it('renders a count pill only when count is defined (0 included)', () => {
    render(<UnderlineTabs tabs={TABS} active="a" onChange={vi.fn()} accent={ACCENT_VIOLET} />);

    // .rounded matches the pill (px-1.5 py-0.5 rounded …), not the bar (.rounded-t).
    const alphaPill = screen.getByRole('tab', { name: /Alpha/ }).querySelector('span.rounded');
    const betaPill = screen.getByRole('tab', { name: /Beta/ }).querySelector('span.rounded');
    const gammaPill = screen.getByRole('tab', { name: /Gamma/ }).querySelector('span.rounded');

    expect(alphaPill?.textContent).toBe('3');
    expect(betaPill?.textContent).toBe('0');
    expect(gammaPill).toBeNull();
  });

  it('paints the active underline bar with the tab accent, falling back to the group accent', () => {
    const { rerender } = render(
      <UnderlineTabs tabs={TABS} active="a" onChange={vi.fn()} accent={ACCENT_VIOLET} />,
    );
    // Active tab "a" has its own accent.
    const aBar = screen.getByRole('tab', { name: /Alpha/ }).querySelector('span.rounded-t') as HTMLElement;
    expect(aBar).toBeTruthy();
    expect(aBar.style.backgroundColor).toBe(rgbOf(ACCENT_ROSE));
    // Inactive tabs have no bar.
    expect(screen.getByRole('tab', { name: /Gamma/ }).querySelector('span.rounded-t')).toBeNull();

    // Active tab "c" has no own accent → falls back to the group accent.
    rerender(<UnderlineTabs tabs={TABS} active="c" onChange={vi.fn()} accent={ACCENT_VIOLET} />);
    const cBar = screen.getByRole('tab', { name: /Gamma/ }).querySelector('span.rounded-t') as HTMLElement;
    expect(cBar.style.backgroundColor).toBe(rgbOf(ACCENT_VIOLET));
  });

  it('calls onChange with the tab id when an inactive tab is clicked', () => {
    const onChange = vi.fn();
    render(<UnderlineTabs tabs={TABS} active="a" onChange={onChange} accent={ACCENT_VIOLET} />);

    fireEvent.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders the optional icon and the trailing slot', () => {
    render(
      <UnderlineTabs
        tabs={TABS}
        active="a"
        onChange={vi.fn()}
        accent={ACCENT_VIOLET}
        trailing={<span>Trailing slot</span>}
      />,
    );
    // Beta carries an icon → an <svg> renders inside its button.
    expect(screen.getByRole('tab', { name: /Beta/ }).querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Trailing slot')).toBeTruthy();
  });
});
