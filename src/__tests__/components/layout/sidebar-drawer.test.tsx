import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { useNavigationStore } from '@/stores/navigationStore';

// SidebarL1/SidebarL2 transitively import src/lib/chart-colors.ts, which
// currently carries unresolved git-stash-pop conflict markers (another
// session's WIP, not ours to resolve) and breaks vite's transform for any
// importer. Stub both — Sidebar itself only composes them, it doesn't need
// their real implementation to prove its own drawer/overlay behavior.
vi.mock('@/components/layout/SidebarL1', () => ({ SidebarL1: () => <div data-testid="l1-stub" /> }));
vi.mock('@/components/layout/SidebarL2', () => ({ SidebarL2: () => <div data-testid="l2-stub" /> }));

const { Sidebar } = await import('@/components/layout/Sidebar');

afterEach(cleanup);

beforeEach(() => {
  useNavigationStore.setState({ activeSubModule: null, sidebarMode: 'full' });
});

describe('Sidebar — inline rendering', () => {
  it('renders both rails inline (no overlay chrome) when overlay is false', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('l1-stub')).toBeTruthy();
    expect(screen.getByTestId('l2-stub')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('omits SidebarL2 when sidebarMode is not full', () => {
    useNavigationStore.setState({ sidebarMode: 'rail' });
    render(<Sidebar />);
    expect(screen.getByTestId('l1-stub')).toBeTruthy();
    expect(screen.queryByTestId('l2-stub')).toBeNull();
  });
});

describe('Sidebar — overlay drawer', () => {
  it('renders nothing when overlay is true and open is false', () => {
    render(<Sidebar overlay open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the drawer + backdrop when overlay is true and open is true', () => {
    render(<Sidebar overlay open />);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Sidebar overlay open onClose={onClose} />);
    const backdrop = container.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses once activeSubModule actually changes to a real value', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sidebar overlay open onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();

    useNavigationStore.setState({ activeSubModule: 'arpg-combat' as never });
    rerender(<Sidebar overlay open onClose={onClose} />);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-dismiss when activeSubModule is cleared to null (picking a category)', () => {
    useNavigationStore.setState({ activeSubModule: 'arpg-combat' as never });
    const onClose = vi.fn();
    const { rerender } = render(<Sidebar overlay open onClose={onClose} />);

    useNavigationStore.setState({ activeSubModule: null });
    rerender(<Sidebar overlay open onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
  });
});
