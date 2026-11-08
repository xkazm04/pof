/**
 * Every failure exit of useMaterialStore leaves ONE tagged logger.warn line, so a
 * failure the UI dismisses still leaves a trace (the Advanced hook already does).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({
  logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

function failingFetch(url: string) {
  if (url === 'blob:alb') {
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1]).buffer } as unknown as Response;
  }
  return { json: async () => ({ success: false, error: 'boom' }) } as unknown as Response;
}

beforeEach(() => {
  warn.mockClear();
  vi.stubGlobal('fetch', async (url: string) => failingFetch(url));
  useMaterialStore.getState().reset();
});

afterEach(() => vi.unstubAllGlobals());

describe('useMaterialStore failure logging', () => {
  it('logs one tagged warn per failing action (5 actions -> 5 warns)', async () => {
    const s = useMaterialStore.getState();
    useMaterialStore.setState({ albedoTexture: 'blob:alb' });

    expect((await s.deriveMapsFromAlbedo()).ok).toBe(false);
    expect((await s.loadPresets()).ok).toBe(false);
    expect((await s.addPreset('p')).ok).toBe(false);
    expect((await s.removePreset('x')).ok).toBe(false);
    expect((await s.sendToBlender()).ok).toBe(false);

    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(5);
    for (const l of lines) {
      expect(l.startsWith('[material-lab] ')).toBe(true);
      expect(l).toContain('boom');
    }
  });
});
