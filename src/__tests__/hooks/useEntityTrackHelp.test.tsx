import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute, lastConfig } = vi.hoisted(() => ({
  execute: vi.fn((_t: unknown) => Promise.resolve()),
  lastConfig: { value: null as { moduleId: string; sessionKey: string; label: string } | null },
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (config: { moduleId: string; sessionKey: string; label: string }) => {
    lastConfig.value = config;
    return { execute, sendPrompt: vi.fn(), isRunning: false };
  },
}));

import { useEntityTrackHelp } from '@/hooks/useEntityTrackHelp';

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
  data: { id: 'brute' },
};

describe('useEntityTrackHelp', () => {
  beforeEach(() => { execute.mockClear(); lastConfig.value = null; });

  it('dispatches a quickAction task mentioning the entity + track', () => {
    const { result } = renderHook(() => useEntityTrackHelp(entity));
    act(() => result.current.evaluate('art-3d'));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Brute');
    expect(task.prompt).toContain('3D Art');
  });

  it('scopes the session key to entity + track so it shows in the entity-scoped rail', () => {
    const { result } = renderHook(() => useEntityTrackHelp(entity));
    act(() => result.current.evaluate('logic'));
    // sessionKey must start with gen-<entityId> so the CLI Rail entity filter matches.
    expect(lastConfig.value?.sessionKey).toContain('gen-brute');
  });

  it('exposes isRunning from the underlying session', () => {
    const { result } = renderHook(() => useEntityTrackHelp(entity));
    expect(result.current.isRunning).toBe(false);
  });
});
