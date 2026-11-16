import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { config } = vi.hoisted(() => ({ config: { onComplete: null as null | (() => void) } }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (c: { onComplete: () => void }) => {
    config.onComplete = c.onComplete;
    return { execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false };
  },
}));

import { useGeneration } from '@/hooks/useGeneration';
import { logger } from '@/lib/logger';

afterEach(cleanup);

const entity = {
  id: 'e1', catalogId: 'spellbook', name: 'E', categoryPath: [], tags: [], lifecycle: 'planned', data: {},
} as unknown as StoredCatalogEntity;

describe('useGeneration lifecycle refresh', () => {
  it('reports why the post-run lifecycle refresh failed', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('server down')) as unknown as typeof fetch;
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    renderHook(() => useGeneration(entity));
    config.onComplete?.();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(String(warn.mock.calls[0][0])).toContain('spellbook');
    warn.mockRestore();
  });
});
