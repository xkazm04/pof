/**
 * ONE PRODUCE DOOR for the bespoke Items steps.
 *
 * `useStaticStep` used to write `ITEM_STEP_SPECS[step].produce(entity)` with no template stamp and
 * no live branch, so the 7 bespoke-owned Items steps were the only steps in the lab an operator
 * could not produce for real, and their "(CLI)" buttons wrote the exemplar sword's constants for
 * any item and graded `pass`. They now dispatch through `useStepProduceDoor`, the door
 * `ArchetypeStep` lifted out: live CLI (opt-in) for the text archetypes, and a TEMPLATE-stamped
 * stub otherwise. fetch is mocked: a real CLI is never spawned in a test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, cleanup, fireEvent } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import '@/lib/catalog/pipelines/registry.generated';
import { useStaticStep } from '@/components/layout-lab/steps/useStaticStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { LIVE_PRODUCE_KEY, type ProduceOutcome } from '@/components/layout-lab/labProduceMode';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { ItemAnimations, ItemVFX, ItemSFX } from '@/components/layout-lab/steps/ItemAnimAudio';
import { ItemInventoryUI } from '@/components/layout-lab/steps/ItemIntegration';
import { ItemAttributes } from '@/components/layout-lab/steps/ItemAttributes';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepProps } from '@/components/layout-lab/steps/stepProps';
import type { ComponentType } from 'react';

const t = LAB_THEMES[0];
const SEED = CATALOG_SECTIONS.find((s) => s.catalogId === 'items')!.seed();
const lab = (id: string): LabEntity => {
  const e = SEED.find((x) => x.id === id)!;
  return { id: e.id, name: e.name, lifecycle: 'planned', data: (e as { data?: unknown }).data };
};
const ITEM_1 = lab('item-1');
const ITEM_2 = lab('item-2');

/** Every fetch answers an empty envelope unless a test installs its own. */
function quietFetch() {
  const f = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) }));
  vi.stubGlobal('fetch', f);
  return f;
}
const oneShotCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).includes('/api/one-shot/step'));

beforeEach(() => {
  useLabPipelineStore.setState({ byEntity: {} });
  localStorage.clear();
  clearJudgeVerdictCache();
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('useStaticStep → the shared produce door', () => {
  it('a stub (live OFF) for non-exemplar item-2 is stamped TEMPLATE and the lab reads pending', () => {
    const f = quietFetch();
    const { result } = renderHook(() => useStaticStep(ITEM_2, 'VFX'));
    act(() => { void result.current.runProduce(); });
    const data = (result.current.art?.data ?? {}) as Record<string, unknown>;
    expect(data.template).toEqual({ exemplar: 'item-1', entity: 'item-2' });
    expect(resolveAccept('items', 'VFX')!(data).status).toBe('pending');
    expect(oneShotCalls(f)).toHaveLength(0);
  });

  it('[guard] the exemplar item-1 Attributes stub carries no stamp and still passes', () => {
    quietFetch();
    const { result } = renderHook(() => useStaticStep(ITEM_1, 'Attributes'));
    act(() => { void result.current.runProduce(); });
    const data = (result.current.art?.data ?? {}) as Record<string, unknown>;
    expect(data.template).toBeUndefined();
    expect(resolveAccept('items', 'Attributes')!(data).status).toBe('pass');
  });

  it('live ON: exactly one one-shot POST (mode cli), the store adopts the server row, the verdict is returned', async () => {
    localStorage.setItem(LIVE_PRODUCE_KEY, '1');
    const f = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('/api/one-shot/step')
        ? { success: true, data: { outcome: 'fail', status: 'fail', reason: 'clips missing', stepName: 'Animations', artifactData: { clips: [] }, ueAssets: [] } }
        : { success: true, data: [] }),
    }));
    vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useStaticStep(ITEM_2, 'Animations'));
    let out: ProduceOutcome | void = undefined;
    await act(async () => { out = await result.current.runProduce({ direction: 'd', prompt: 'p' }); });

    const calls = oneShotCalls(f);
    expect(calls).toHaveLength(1);
    const init = (calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toMatchObject({ catalogId: 'items', entityId: 'item-2', stepLabel: 'Animations', mode: 'cli', direction: 'd' });
    expect(result.current.art?.data).toEqual({ clips: [] });
    const outcome = out as unknown as ProduceOutcome;
    expect(outcome.ok).toBe(false);
    expect(outcome.msg).toContain('clips missing');
  });

  it('live ON does not route a non-text archetype (Attributes = schema) to the CLI', () => {
    localStorage.setItem(LIVE_PRODUCE_KEY, '1');
    const f = quietFetch();
    const { result } = renderHook(() => useStaticStep(ITEM_2, 'Attributes'));
    act(() => { void result.current.runProduce(); });
    expect(oneShotCalls(f)).toHaveLength(0);
    expect((result.current.art?.data ?? {}).template).toEqual({ exemplar: 'item-1', entity: 'item-2' });
  });
});

describe('the bespoke Produce panels', () => {
  const TEXT: [string, ComponentType<StepProps>][] = [
    ['Animations', ItemAnimations], ['VFX', ItemVFX], ['SFX', ItemSFX], ['Inventory UI Integration', ItemInventoryUI],
  ];

  it('the 4 text steps offer the live-CLI mode; Attributes (schema) does not', () => {
    quietFetch();
    for (const [step, Step] of TEXT) {
      const { unmount } = render(<Step t={t} entity={ITEM_2} step={step} />);
      expect(screen.queryByTestId('cli-produce-mode'), step).not.toBeNull();
      unmount();
    }
    render(<ItemAttributes t={t} entity={ITEM_2} step="Attributes" />);
    expect(screen.queryByTestId('cli-produce-mode')).toBeNull();
  });

  it('a stub click on item-2 lands a pending TEMPLATE banner that does not misdescribe the data', () => {
    quietFetch();
    render(<ItemAnimations t={t} entity={ITEM_2} step="Animations" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));
    const banner = screen.getByTestId('acceptance-banner');
    expect(banner.getAttribute('data-status')).toBe('pending');
    expect(banner.textContent).toContain('TEMPLATE');
    // The clip-count copy is authored for a CHECKER shortfall; 4 clips are present here.
    expect(banner.textContent).not.toMatch(/clip\(s\) present/);
    // A stub re-produce would re-write the same stamped stub: no fix button that cannot move it.
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });
});
