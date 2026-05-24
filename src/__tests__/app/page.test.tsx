import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '@/app/page';

// Stub both shells so we can detect which one rendered without booting either.
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: () => <div data-testid="legacy-shell">legacy</div>,
}));
vi.mock('@/components/ecw/NewAppShell', () => ({
  NewAppShell: () => <div data-testid="ecw-shell">ecw</div>,
}));

describe('app/page.tsx ECW flag gate', () => {
  afterEach(cleanup);

  it('renders the legacy shell when no ?ecw flag', () => {
    window.history.replaceState({}, '', '/');
    render(<Home />);
    expect(screen.getByTestId('legacy-shell')).toBeTruthy();
    expect(screen.queryByTestId('ecw-shell')).toBeNull();
  });

  it('renders the ECW shell when ?ecw=1', () => {
    window.history.replaceState({}, '', '/?ecw=1');
    render(<Home />);
    expect(screen.getByTestId('ecw-shell')).toBeTruthy();
    expect(screen.queryByTestId('legacy-shell')).toBeNull();
  });
});
