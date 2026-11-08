import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useUE5SourceSync } from '@/hooks/useUE5SourceSync';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);

interface Pending { path: string; resolve: (data: unknown) => void; fail: (msg: string) => void }
let pending: Pending[] = [];

const reply = (status: number, body: unknown) => ({
  ok: status < 400, status,
  json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
});

beforeEach(() => {
  pending = [];
  globalThis.fetch = vi.fn((_url: unknown, init?: RequestInit) => new Promise((res) => {
    pending.push({
      path: (JSON.parse(String(init?.body)) as { projectPath: string }).projectPath,
      resolve: (data) => res(reply(200, { success: true, data })),
      fail: (error) => res(reply(500, { success: false, error })),
    });
  })) as unknown as typeof fetch;
  useProjectStore.setState({ projectPath: 'A', isSetupComplete: true });
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const setPath = (projectPath: string) => act(() => { useProjectStore.setState({ projectPath }); });
const parsed = (tag: string) => ({ tag }) as never;

describe('useUE5SourceSync', () => {
  it('does not stay loading when the project is cleared mid-fetch', async () => {
    const { result } = renderHook(() => useUE5SourceSync());
    await flush();
    expect(result.current.isLoading).toBe(true);
    setPath('');
    pending[0].resolve(parsed('A'));
    await flush();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not stay loading on A -> B -> A when A was already fetched', async () => {
    const { result } = renderHook(() => useUE5SourceSync());
    await flush();
    pending[0].resolve(parsed('A'));
    await flush();
    setPath('B');
    await flush();
    setPath('A');
    await flush();
    pending[1].resolve(parsed('B'));
    await flush();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ tag: 'A' });
  });

  it('a late refresh of the old project cannot replace the new project', async () => {
    const { result } = renderHook(() => useUE5SourceSync());
    await flush();
    pending[0].resolve(parsed('A'));
    await flush();
    act(() => result.current.refresh());
    await flush();
    setPath('B');
    await flush();
    const [, refreshA, loadB] = pending;
    expect([refreshA.path, loadB.path]).toEqual(['A', 'B']);
    loadB.resolve(parsed('B'));
    await flush();
    refreshA.resolve(parsed('A-late'));
    await flush();
    expect(result.current.data).toEqual({ tag: 'B' });
  });
});
