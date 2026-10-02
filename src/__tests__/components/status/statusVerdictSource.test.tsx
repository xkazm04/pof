/**
 * ONE whole-project judge-verdict read for /status, built on the lab's existing verdict cache
 * (`useStepJudgeVerdicts.ts` — 60 s TTL, `invalidateJudgeVerdicts`), never a second cache.
 *
 * Pins: the tabs share one in-flight GET; a failed read is a failure (`{ok:false}`), never a
 * cached `[]` that would silently drop a condemning verdict; and the shared read can never hold
 * a condemned cell green — a FAIL recorded after first load reaches the next read once the
 * cache is invalidated or expires.
 *
 * scan-sweep --challenge run challenge-2026-09-28b, card status-health-dashboard/A.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, renderHook, act } from '@testing-library/react';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import {
  invalidateJudgeVerdicts,
  readAllJudgeVerdicts,
  JUDGE_VERDICT_CACHE_TTL_MS,
} from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { useStatusVerdicts } from '@/components/status/statusVerdictSource';
import { CategoryView } from '@/components/status/CategoryView';
import { PipelinesView } from '@/components/status/PipelinesView';
import { useCatalogStore } from '@/stores/catalogStore';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
  const items = { catalogId: 'items', steps: [{ archetype: 'brief', label: 'Concept Brief', engine: 'Claude', view, produce, accept }] };
  return {
    ...actual,
    allCatalogPipelines: () => [items],
    getCatalogPipeline: (id: string) => (id === 'items' ? items : undefined),
  };
});

const fail = (entityId: string): JudgeVerdict => ({
  catalogId: 'items', entityId, step: 'Concept Brief', judge: 'llm-panel', verdict: 'fail',
  score: 20, model: 'm', findings: 'f', rubricVersion: 3,
} as JudgeVerdict);

/** Server stand-in: every GET is recorded; the verdict route answers from `verdictBody`. */
let urls: string[] = [];
let verdictBody: () => { success: boolean; data?: JudgeVerdict[]; error?: string } = () => ({ success: true, data: [] });
let holdVerdicts: Promise<void> | null = null;

beforeEach(() => {
  urls = [];
  verdictBody = () => ({ success: true, data: [] });
  holdVerdicts = null;
  _resetArtifactCache();
  invalidateJudgeVerdicts();
  useCatalogStore.setState({ entitiesByCatalog: { items: { e1: { id: 'e1', catalogId: 'items', name: 'E1', categoryPath: [], tags: [], lifecycle: 'planned', links: [] } } } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(String(url));
    if (String(url).startsWith('/api/judge-verdicts')) {
      if (holdVerdicts) await holdVerdicts;
      return { ok: true, status: 200, json: async () => verdictBody() };
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const verdictGets = () => urls.filter((u) => u.startsWith('/api/judge-verdicts')).length;

describe('statusVerdictSource — one shared verdict read', () => {
  it('CategoryView + PipelinesView mounted together issue exactly one GET /api/judge-verdicts', async () => {
    let release!: () => void;
    holdVerdicts = new Promise<void>((r) => { release = r; });
    const cat = render(<CategoryView catalogId="items" onFocusEntity={vi.fn()} onPickCatalog={vi.fn()} />);
    const pipes = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => expect(verdictGets()).toBe(1));
    release();
    await waitFor(() => expect(cat.container.textContent).toContain('E1'));
    await waitFor(() => expect(pipes.container.querySelector('[title^="Focus an entity — items "]')).toBeTruthy());
    expect(verdictGets()).toBe(1);
  });
});

describe('readAllJudgeVerdicts — Result-keeping, on the existing 60 s cache', () => {
  it('returns a failed read as {ok:false} and does not cache it as []', async () => {
    verdictBody = () => ({ success: false, error: '500' });
    const first = await readAllJudgeVerdicts();
    expect(first).toEqual({ ok: false, error: '500' });
    verdictBody = () => ({ success: true, data: [fail('e1')] });
    const second = await readAllJudgeVerdicts();
    expect(second.ok && second.data).toEqual([fail('e1')]);
    expect(verdictGets()).toBe(2);
  });

  it('a FAIL recorded after first load is visible on the next read after invalidateJudgeVerdicts()', async () => {
    const first = await readAllJudgeVerdicts();
    expect(first).toEqual({ ok: true, data: [] });
    verdictBody = () => ({ success: true, data: [fail('e1')] });
    // Within the TTL the cached read is served (one request)…
    expect(await readAllJudgeVerdicts()).toEqual({ ok: true, data: [] });
    expect(verdictGets()).toBe(1);
    // …and a judge write's invalidation surfaces the new FAIL on the very next read.
    invalidateJudgeVerdicts('items');
    expect(await readAllJudgeVerdicts()).toEqual({ ok: true, data: [fail('e1')] });
  });

  it('a FAIL recorded after first load is visible on the next read after TTL expiry', async () => {
    const t0 = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0);
    await readAllJudgeVerdicts();
    verdictBody = () => ({ success: true, data: [fail('e1')] });
    now.mockReturnValue(t0 + JUDGE_VERDICT_CACHE_TTL_MS + 1);
    expect(await readAllJudgeVerdicts()).toEqual({ ok: true, data: [fail('e1')] });
  });

  it('useStatusVerdicts groups by catalog, reports failure, and reload re-reads after a write', async () => {
    verdictBody = () => ({ success: false, error: 'HTTP 500' });
    const { result } = renderHook(() => useStatusVerdicts());
    await waitFor(() => expect(result.current.verdicts).toEqual({ ok: false, error: 'HTTP 500' }));
    verdictBody = () => ({ success: true, data: [fail('e1')] });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.verdicts?.ok).toBe(true));
    const v = result.current.verdicts!;
    expect(v.ok && v.byCatalog.get('items')).toEqual([fail('e1')]);
  });

  it('a lab-side invalidation that lands new rows reaches a mounted useStatusVerdicts without its reload (lab-hooks/A)', async () => {
    const { result } = renderHook(() => useStatusVerdicts());
    await waitFor(() => expect(result.current.verdicts?.ok).toBe(true));
    verdictBody = () => ({ success: true, data: [fail('e1')] });
    act(() => invalidateJudgeVerdicts('items'));
    // Revalidating: the held (stale) read stays on screen — never a loading null.
    expect(result.current.verdicts?.ok).toBe(true);
    await waitFor(() => {
      const v = result.current.verdicts;
      expect(v?.ok && v.byCatalog.get('items')).toEqual([fail('e1')]);
    });
    expect(verdictGets()).toBe(2);
  });
});
