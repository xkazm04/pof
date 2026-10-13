import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { AudioLibraryPanel } from '@/components/modules/content/audio/AudioLibraryPanel';

afterEach(cleanup);

function respond(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
}

function mockFetch(library: () => Promise<unknown>) {
  globalThis.fetch = vi.fn().mockImplementation((url: string) =>
    String(url).startsWith('/api/audio-gen') ? library() : respond({ success: true, data: { bySet: {}, preflight: null } }),
  ) as unknown as typeof fetch;
}

describe('AudioLibraryPanel - load states', () => {
  it('an empty library says "No audio yet" and shows no error', async () => {
    mockFetch(() => respond({ success: true, data: { sets: [], assets: [], usage: null } }));
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByText(/No audio yet/)).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a FAILED library load is an error with Retry, never the empty-library message', async () => {
    mockFetch(() => respond({ success: false, error: 'database is locked' }, 500));
    render(<AudioLibraryPanel />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('database is locked');
    expect(screen.queryByText(/No audio yet/)).toBeNull();
  });

  it('a network failure is also an error state', async () => {
    mockFetch(() => Promise.reject(new Error('net down')));
    render(<AudioLibraryPanel />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('net down');
    expect(screen.queryByText(/No audio yet/)).toBeNull();
  });
});

describe('AudioLibraryPanel - facet controls have accessible names (same fix SoundForgePanel.Field already carries)', () => {
  it('every facet select is reachable by its visible label', async () => {
    mockFetch(() => respond({ success: true, data: { sets: [], assets: [], usage: null } }));
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByText(/No audio yet/)).toBeTruthy());
    for (const [label, testId] of [['Kind', 'facet-kind'], ['Surface', 'facet-surface'], ['Event key', 'facet-event'], ['Duration', 'facet-duration']]) {
      expect(screen.getByLabelText(label).getAttribute('data-testid'), label).toBe(testId);
    }
  });
});
