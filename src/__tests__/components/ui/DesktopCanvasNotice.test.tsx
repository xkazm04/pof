import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** Install a matchMedia stub that reports the given coarse-pointer state. */
function mockCoarsePointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    // Our hook only queries the coarse-pointer media string.
    matches: coarse && query.includes('pointer: coarse'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

import { DesktopCanvasNotice } from '@/components/ui/DesktopCanvasNotice';

describe('DesktopCanvasNotice', () => {
  it('renders nothing on a fine-pointer (desktop) device', () => {
    mockCoarsePointer(false);
    const { container } = render(<DesktopCanvasNotice />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the advisory note on a touch-first (coarse-pointer) device', () => {
    mockCoarsePointer(true);
    render(<DesktopCanvasNotice />);
    const note = screen.getByRole('note');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('desktop');
  });

  it('honours a custom label', () => {
    mockCoarsePointer(true);
    render(<DesktopCanvasNotice label="Custom advisory" />);
    expect(screen.getByRole('note').textContent).toContain('Custom advisory');
  });
});
