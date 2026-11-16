/**
 * Codegen completion must stamp the document the run was DISPATCHED for.
 * Switching documents during a multi-minute run used to stamp whichever doc was
 * open when the run ended.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { LevelDesignDocument, UpdateDocPayload } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type OnComplete = (success: boolean) => void;
const completions: Record<string, OnComplete | undefined> = {};
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: OnComplete }) => {
    completions[opts.sessionKey] = opts.onComplete;
    return { sendPrompt: vi.fn(), execute: vi.fn(async () => true), isRunning: false };
  },
}));

import { useLevelDesignView } from '@/components/modules/content/level-design/LevelDesignView/useLevelDesignView';

afterEach(cleanup);

function doc(id: number): LevelDesignDocument {
  return {
    id, name: `Doc ${id}`, description: '', designNarrative: '', rooms: [], connections: [],
    difficultyArc: [], pacingNotes: '', syncStatus: 'doc-ahead', syncReport: [],
    lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
  };
}

function installApi() {
  const puts: UpdateDocPayload[] = [];
  const docs = { 7: doc(7), 8: doc(8) } as Record<number, LevelDesignDocument>;
  const envelope = (data: unknown) => ({
    ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (String(url).startsWith('/api/level-design')) {
      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as UpdateDocPayload;
        puts.push(body);
        const { id, ...patch } = body;
        docs[id] = { ...docs[id], ...patch } as LevelDesignDocument;
        return envelope({ doc: docs[id] });
      }
      return envelope({ docs: Object.values(docs) });
    }
    return envelope({});
  }) as unknown as typeof fetch;
  return puts;
}

describe('codegen completion stamp', () => {
  it('lands on the document the run was dispatched for, not the one open at completion', async () => {
    const puts = installApi();
    const { result } = renderHook(() => useLevelDesignView());
    await waitFor(() => expect(result.current.docs).toHaveLength(2));

    act(() => result.current.setActiveDocId(7));
    await waitFor(() => expect(result.current.activeDoc?.id).toBe(7));
    act(() => result.current.handleGenerateAllCode());

    act(() => result.current.setActiveDocId(8));
    await waitFor(() => expect(result.current.activeDoc?.id).toBe(8));

    await act(async () => { completions['level-design-codegen']?.(true); });
    await waitFor(() => expect(puts.length).toBeGreaterThan(0));

    const stamped = puts.filter((p) => p.syncStatus === 'synced');
    expect(stamped.map((p) => p.id)).toEqual([7]);
  });

  it('still stamps the open document when it did not change', async () => {
    const puts = installApi();
    const { result } = renderHook(() => useLevelDesignView());
    await waitFor(() => expect(result.current.docs).toHaveLength(2));
    act(() => result.current.setActiveDocId(7));
    await waitFor(() => expect(result.current.activeDoc?.id).toBe(7));
    act(() => result.current.handleGenerateAllCode());
    await act(async () => { completions['level-design-codegen']?.(true); });
    await waitFor(() => expect(puts.filter((p) => p.syncStatus === 'synced').map((p) => p.id)).toEqual([7]));
  });
});
