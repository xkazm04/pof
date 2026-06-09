import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubTabNavigation, type SubTab } from '@/components/modules/core-engine/unique-tabs/_shared';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

afterEach(cleanup);

const TABS: SubTab[] = [
  { id: 'core', label: 'Core' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'effects', label: 'Effects' },
];

describe('SubTabNavigation — roving tabindex + arrow keys', () => {
  it('exposes a tablist of tabs with aria-selected on the active tab', () => {
    render(<SubTabNavigation tabs={TABS} activeTabId="abilities" onChange={vi.fn()} accent={STATUS_SUCCESS} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('uses roving tabindex so only the active tab is in the tab order', () => {
    render(<SubTabNavigation tabs={TABS} activeTabId="abilities" onChange={vi.fn()} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the first tab in the tab order when none is active', () => {
    render(<SubTabNavigation tabs={TABS} activeTabId="nonexistent" onChange={vi.fn()} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('moves to the next tab on ArrowRight and focuses it', () => {
    const onChange = vi.fn();
    render(<SubTabNavigation tabs={TABS} activeTabId="abilities" onChange={onChange} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('effects');
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('moves to the previous tab on ArrowLeft', () => {
    const onChange = vi.fn();
    render(<SubTabNavigation tabs={TABS} activeTabId="abilities" onChange={onChange} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('core');
  });

  it('wraps to the first tab on ArrowRight from the last tab', () => {
    const onChange = vi.fn();
    render(<SubTabNavigation tabs={TABS} activeTabId="effects" onChange={onChange} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('core');
  });

  it('jumps to the last tab on End and the first on Home', () => {
    const onChange = vi.fn();
    render(<SubTabNavigation tabs={TABS} activeTabId="core" onChange={onChange} accent={STATUS_SUCCESS} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('effects');
    fireEvent.keyDown(tabs[0], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('core');
  });
});
