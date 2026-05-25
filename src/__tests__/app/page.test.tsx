import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '@/app/page';

// Stub the shell so we can detect it rendered without booting it.
vi.mock('@/components/ecw/NewAppShell', () => ({
  NewAppShell: () => <div data-testid="ecw-shell">ecw</div>,
}));

describe('app/page.tsx (post-cutover)', () => {
  afterEach(cleanup);

  it('always renders the ECW shell (legacy ?ecw gate removed in Phase 12)', () => {
    render(<Home />);
    expect(screen.getByTestId('ecw-shell')).toBeTruthy();
  });
});
