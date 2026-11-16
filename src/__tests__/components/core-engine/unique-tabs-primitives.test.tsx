import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CopyButton, TabHeader, ProgressChip, TabButtonGroup, SubTabNavigation, SegmentedControl, FeatureCard } from '@/components/modules/core-engine/unique-tabs/_shared';
import { STATUS_SUCCESS, ACCENT_CYAN } from '@/lib/chart-colors';
import { Box } from 'lucide-react';

/**
 * Shared unique-tabs primitives (scan-sweep night 2026-11-08, core-engine-genre-tabs).
 * Each block pins one pair: a rule a sibling primitive already honours, now honoured here.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('CopyButton — the receipt follows the verified write (lib/clipboard contract)', () => {
  it('a rejected clipboard write never shows "Copied" and raises no unhandled rejection', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    render(<CopyButton getText={() => 'abc'} accent={STATUS_SUCCESS} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    expect(screen.getByRole('button').textContent).toBe('Copy');
  });

  it('a successful write shows "Copied"', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<CopyButton getText={() => 'abc'} accent={STATUS_SUCCESS} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(screen.getByRole('button').textContent).toBe('Copied');
  });
});

/** jsdom serialises inline colours as rgb(); compare against the same conversion. */
function rgbOf(hex: string): string {
  const el = document.createElement('span');
  el.style.color = hex;
  return el.style.color;
}

describe('TabHeader — "complete" means the same thing as ProgressChip', () => {
  it('0 of 0 is not painted as complete (ProgressChip already guards total > 0)', () => {
    const { container } = render(<TabHeader icon={Box} title="T" implemented={0} total={0} accent={ACCENT_CYAN} />);
    const count = container.querySelector('span.font-mono') as HTMLElement;
    expect(count.style.color).toBe(rgbOf(ACCENT_CYAN));
    cleanup();
    const chip = render(<ProgressChip implemented={0} total={0} accent={ACCENT_CYAN} />).container;
    expect((chip.querySelector('span.font-bold') as HTMLElement).style.color).toBe(rgbOf(ACCENT_CYAN));
  });

  it('[control] 3 of 3 is complete in both', () => {
    const { container } = render(<TabHeader icon={Box} title="T" implemented={3} total={3} accent={ACCENT_CYAN} />);
    expect((container.querySelector('span.font-mono') as HTMLElement).style.color).toBe(rgbOf(STATUS_SUCCESS));
  });
});

describe('TabButtonGroup — one tab stop, like SubTabNavigation', () => {
  const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  const stops = () => screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0').length;

  it('a selection that is not one of the items still leaves exactly one tab stop', () => {
    render(<TabButtonGroup items={items} selected="gone" onSelect={vi.fn()} accent={ACCENT_CYAN} ariaLabel="g" />);
    expect(stops()).toBe(1);
    expect(screen.getAllByRole('tab')[0].getAttribute('tabindex')).toBe('0');
    cleanup();
    render(<SubTabNavigation tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} activeTabId="gone" onChange={vi.fn()} accent={ACCENT_CYAN} />);
    expect(stops()).toBe(1);
  });

  it('[control] a real selection is the only tab stop; null falls back to the first', () => {
    render(<TabButtonGroup items={items} selected="b" onSelect={vi.fn()} accent={ACCENT_CYAN} ariaLabel="g" />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0']);
    cleanup();
    render(<TabButtonGroup items={items} selected={null} onSelect={vi.fn()} accent={ACCENT_CYAN} ariaLabel="g" />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });
});

describe('focus indicator — a control that removes the outline must draw .focus-ring', () => {
  const lostFocus = (els: HTMLElement[]) =>
    els.filter((b) => /(^|\s)focus:outline-none(\s|$)/.test(b.className) && !/(^|\s)focus-ring(-inset)?(\s|$)/.test(b.className)).length;

  it('SubTabNavigation, SegmentedControl and the shared FeatureCard keep a visible keyboard focus', () => {
    render(
      <div>
        <SubTabNavigation tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} activeTabId="a" onChange={vi.fn()} accent={ACCENT_CYAN} />
        <SegmentedControl options={[{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }]} activeId="x" onChange={vi.fn()} accent={ACCENT_CYAN} />
        <FeatureCard name="F" featureMap={new Map()} defs={[]} expanded={null} onToggle={vi.fn()} accent={ACCENT_CYAN} />
      </div>,
    );
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLElement[];
    expect(buttons.length).toBe(5);
    expect(lostFocus(buttons)).toBe(0);
  });
});
