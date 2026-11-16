/**
 * useLanesBoard must not carry one game's board across a game switch: a failing read of the new
 * game reads as an error, never as the previous game's board "stale".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useLanesBoard } from '@/components/layout-lab/game/gameHomeLanesData';

const BOARD = { configured: true, roots: [], readAt: '2026-11-08T00:00:00Z' };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useLanesBoard key scope', () => {
  it('a game switch to a failing read shows an error, not the previous game board', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({
      json: () => Promise.resolve(String(url).includes('/game-a/') ? { success: true, data: BOARD } : { success: false, error: 'lanes down' }),
    })));
    const { result, rerender } = renderHook(({ id }) => useLanesBoard(id), { initialProps: { id: 'game-a' } });
    await waitFor(() => expect(result.current.read.kind).toBe('ok'));
    rerender({ id: 'game-b' });
    await waitFor(() => expect(result.current.read.kind).toBe('error'));
    expect(result.current.read).toEqual({ kind: 'error', message: 'lanes down' });
  });
});
