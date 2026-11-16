import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, render, screen, waitFor, cleanup } from '@testing-library/react';

afterEach(cleanup);

const tryApiFetch = vi.fn();
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  tryApiFetch: (...a: unknown[]) => tryApiFetch(...a),
}));

import { useGameDirector } from '@/hooks/useGameDirector';

function route(listOk: boolean) {
  tryApiFetch.mockImplementation(async (url: string) => {
    if (url.includes('action=list')) return listOk ? { ok: true, data: [] } : { ok: false, error: 'HTTP 500' };
    if (url.includes('action=stats')) return { ok: true, data: null };
    return { ok: true, data: [] };
  });
}

describe('useGameDirector load failure', () => {
  it('exposes the error when the session list read fails', async () => {
    route(false);
    const { result } = renderHook(() => useGameDirector());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.sessions).toEqual([]);
  });

  it('has no error when the list loads', async () => {
    route(true);
    const { result } = renderHook(() => useGameDirector());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

describe('GameDirectorModule load failure', () => {
  it('renders the error text with a Retry', async () => {
    route(false);
    vi.resetModules();
    const { GameDirectorModule } = await import('@/components/modules/game-director/GameDirectorModule');
    const { container } = render(<GameDirectorModule />);
    await waitFor(() => expect(container.textContent).toContain('Could not load playtest sessions: HTTP 500'));
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
