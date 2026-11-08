import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useMaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * An analysis in flight belongs to the reference it was asked about. Removing
 * (or replacing) that reference while the request runs used to let the late
 * response write its analysis anyway — the panel then showed properties for a
 * reference that was no longer there. Latest-wins: a superseded completion is
 * inert, on the success and the failure path alike.
 */

const ANALYSIS: AnalyzedProperties = {
  colorPalette: [], surfaceType: 'metal', surfaceConfidence: 0.6,
  roughness: 0.3, metallic: 0.9, emissiveIntensity: 0, subsurfacePresence: 0,
  parallaxDepth: 0, opacity: 1, features: [], description: 'x', suggestions: [],
};

function deferredFetch() {
  let resolve!: (v: unknown) => void;
  const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    succeed: () => resolve({ json: async () => ({ success: true, data: { analysis: ANALYSIS } }) }),
    fail: () => resolve({ json: async () => ({ success: false, error: 'boom' }) }),
  };
}

describe('useMaterialStyleTransfer — a superseded analysis is inert', () => {
  it('a response landing after the reference was removed does not write an analysis', async () => {
    const d = deferredFetch();
    const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
    act(() => result.current.setReferenceDescription('brushed metal'));

    let pending!: Promise<void>;
    act(() => { pending = result.current.handleAnalyze(); });
    expect(result.current.isAnalyzing).toBe(true);

    act(() => result.current.handleClearImage());
    await act(async () => { d.succeed(); await pending; });

    expect(result.current.analysis).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('a superseded failure does not raise an error banner', async () => {
    const d = deferredFetch();
    const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
    act(() => result.current.setReferenceDescription('brushed metal'));

    let pending!: Promise<void>;
    act(() => { pending = result.current.handleAnalyze(); });
    act(() => result.current.handleClearImage());
    await act(async () => { d.fail(); await pending; });

    expect(result.current.analyzeError).toBeNull();
  });

  it('control: a current response still lands', async () => {
    const d = deferredFetch();
    const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
    act(() => result.current.setReferenceDescription('brushed metal'));

    let pending!: Promise<void>;
    act(() => { pending = result.current.handleAnalyze(); });
    await act(async () => { d.succeed(); await pending; });

    expect(result.current.analysis?.surfaceType).toBe('metal');
    expect(result.current.isAnalyzing).toBe(false);
  });
});
