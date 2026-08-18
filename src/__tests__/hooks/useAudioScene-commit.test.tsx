import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAudioScene } from '@/hooks/useAudioScene';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';

/**
 * Pins the "one commit == one PUT" half of the writes-per-gesture claim, and the
 * reason `commitDoc` exists at all: `updateDoc` swallows a failure into `null`,
 * which a local edit buffer cannot distinguish from success.
 */

const EMPTY_PAYLOAD = { docs: [], summary: {} };

function envelope(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}
function failure(error: string) {
  return { ok: false, json: async () => ({ success: false, error }) };
}

let fetchMock: ReturnType<typeof vi.fn>;

function methodsOf(): string[] {
  return fetchMock.mock.calls.map((c) => ((c[1] as RequestInit | undefined)?.method ?? 'GET'));
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(envelope(EMPTY_PAYLOAD));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

describe('useAudioScene.commitDoc', () => {
  it('issues exactly one PUT per commit', async () => {
    const { result } = renderHook(() => useAudioScene());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fetchMock.mockClear();

    fetchMock.mockResolvedValue(envelope({ doc: { id: 1 }, docs: [], summary: {} }));
    await act(async () => { await result.current.commitDoc({ id: 1, zones: [] }); });

    expect(methodsOf().filter((m) => m === 'PUT')).toHaveLength(1);
  });

  it('rejects with the server reason (where updateDoc silently returns null)', async () => {
    const { result } = renderHook(() => useAudioScene());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockResolvedValue(failure('audio_scenes is locked'));

    await expect(
      act(async () => { await result.current.commitDoc({ id: 1, zones: [] }); }),
    ).rejects.toThrow('audio_scenes is locked');

    let swallowed: unknown = 'unset';
    await act(async () => { swallowed = await result.current.updateDoc({ id: 1, zones: [] }); });
    expect(swallowed).toBeNull();
  });
});

describe('useAudioScene.deleteDoc', () => {
  it('drops the deleted scene\'s event catalog instead of stranding it in localStorage', async () => {
    useAudioEventCatalogStore.getState().setEvents('7', [{ id: 'ev1' } as never]);
    expect(useAudioEventCatalogStore.getState().getEvents('7')).toHaveLength(1);

    const { result } = renderHook(() => useAudioScene());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.deleteDoc(7); });
    expect('7' in useAudioEventCatalogStore.getState().byScene).toBe(false);
  });
});
