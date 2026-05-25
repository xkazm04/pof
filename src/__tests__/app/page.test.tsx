import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '@/app/page';

vi.mock('@/components/ecw/NewAppShell', () => ({ NewAppShell: () => <div data-testid="ecw-shell">ecw</div> }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => <div data-testid="legacy-shell">legacy</div> }));

describe('app/page.tsx shell gate (ECW default)', () => {
  afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('renders ECW by default', () => {
    window.history.replaceState({}, '', '/');
    render(<Home />);
    expect(screen.getByTestId('ecw-shell')).toBeTruthy();
  });
  it('renders legacy when ?legacy=1', () => {
    window.history.replaceState({}, '', '/?legacy=1');
    render(<Home />);
    expect(screen.getByTestId('legacy-shell')).toBeTruthy();
  });
});
