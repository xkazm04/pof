import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { getStepComponent } from '@/components/layout-lab/steps';
import { itemsLabelOwner } from '@/components/layout-lab/itemsLabelOwner';
import { ITEM_STEP_NAMES, ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The bespoke Items steps are the REFERENCE pipeline — they must be graded and disclosed
 * exactly like the ~330 generic steps, not through their own private rails. Before
 * `useStepAcceptance`, `StaticStepFrame` hand-rolled a `CheckerContext` with
 * `has: () => false` and `ItemArt` called `accept(data)` with no context at all, and
 * neither saw the server-drain overlay, the judge bridge, or the raw-artifact disclosure.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'bespoke-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

/** Seed every Items step's artifact with its own spec's produce output. */
function seedAll(extra?: Record<string, { status?: string; tier?: string; reason?: string }>) {
  const byStep: Record<string, {
    done: boolean; data: Record<string, unknown>; ueAssets: string[]; at: string;
    status?: string; tier?: string; reason?: string;
  }> = {};
  for (const step of ITEM_STEP_NAMES) {
    const out = ITEM_STEP_SPECS[step].produce(entity);
    byStep[step] = {
      done: true, data: out.data ?? {}, ueAssets: out.ueAssets ?? [], at: '2026-01-01T00:00:00.000Z',
      ...(extra?.[step] ?? {}),
    };
  }
  useLabPipelineStore.setState({ byEntity: { [entity.id]: byStep } });
}

/**
 * The same artifact with a one-candidate history whose selected candidate carries a REAL
 * generated image, so the step's checker reads `pass`. A swatch-only history is `deferred`
 * (see itemsGalleryAssetHonesty.test.tsx), and `bridgeJudgeVerdict` deliberately down-grades
 * only a shape-PASS — so any test about a judge FLIPPING a generative step must start from a
 * step that actually owns art.
 */
function withRealArt(data: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...data };
  delete payload.genHistory;
  const batch = makeBatch({
    seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'gen', prompt: 'gen',
    candidates: [{ swatch: 'linear-gradient(135deg, #444, #888)', imageUrl: '/api/visual-gen/icon/real.png', payload }],
  });
  return historyData(appendBatch(emptyHistory(), batch), data);
}

/** Replace one seeded step's data in place (the store is already seeded by `seedAll`). */
function reseed(step: string, data: Record<string, unknown>) {
  const state = useLabPipelineStore.getState().byEntity[entity.id];
  useLabPipelineStore.setState({
    byEntity: { [entity.id]: { ...state, [step]: { ...state[step], data } } },
  });
}

function verdictFetch(rows: unknown[]) {
  return vi.fn(async (url: string) => ({
    json: async () => (String(url).startsWith('/api/judge-verdicts')
      ? { success: true, data: rows }
      : { success: true, data: [] }),
  }));
}

describe('bespoke Items steps ride the fleet honesty rails', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  // Since 2026-09-29 the 6 labels BOTH items specs declare are registry-owned (itemsLabelOwner) and
  // render through ArchetypeStep, which carries these rails itself; the 7 bespoke-owned remain here.
  it('every one of the 7 bespoke-OWNED steps renders a provenance strip and a raw-artifact disclosure', () => {
    const owned = ITEM_STEP_NAMES.filter((s) => itemsLabelOwner(s) === 'bespoke');
    expect(owned).toHaveLength(7);
    seedAll();
    for (const step of owned) {
      const Step = getStepComponent('items', step);
      expect(Step, `no component registered for ${step}`).toBeTruthy();
      if (!Step) continue;
      const { unmount } = render(<Step t={t} entity={entity} step={step} />);
      expect(screen.getByTestId('provenance-strip'), `no provenance strip on ${step}`).toBeTruthy();
      expect(screen.getByTestId('raw-artifact'), `no raw artifact panel on ${step}`).toBeTruthy();
      unmount();
    }
  });

  it('the raw-artifact disclosure shows exactly what the step stored', () => {
    seedAll();
    const Step = getStepComponent('items', 'Attributes')!;
    render(<Step t={t} entity={entity} step="Attributes" />);
    fireEvent.click(screen.getByTestId('raw-artifact-summary'));
    const json = screen.getByTestId('raw-artifact-json').textContent ?? '';
    expect(JSON.parse(json).data.stats.Damage).toBe(34);
  });

  it('a matching-class judge FAIL down-grades a bespoke STATIC step banner', async () => {
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: 'Attributes', judge: 'llm-panel', verdict: 'fail',
      score: 38, findings: 'generic filler stats', model: 'sonnet', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    const Step = getStepComponent('items', 'Attributes')!;
    render(<Step t={t} entity={entity} step="Attributes" />);
    // The shape checker alone reads pass (every attribute key populated)…
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    // …and the persisted judge verdict now reaches the bespoke banner too.
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
  });

  it('a matching-class judge FAIL down-grades a bespoke GENERATIVE step banner', async () => {
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: '3D Generation', judge: 'vlm', verdict: 'fail',
      score: 44, findings: 'silhouette unreadable at LOD0', model: 'qwen-vl', rubricVersion: RUBRIC_VERSION,
    }]));
    // The step must own a REAL generated image for the checker to pass — a swatch-only
    // history defers, and `bridgeJudgeVerdict` deliberately down-grades only a shape-PASS.
    seedAll();
    reseed('3D Generation', withRealArt({ tris: 4200, cap: 6000 }));
    const Step = getStepComponent('items', '3D Generation')!;
    render(<Step t={t} entity={entity} step="3D Generation" />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
  });

  it('a WRONG-class judge verdict never speaks for a bespoke step', async () => {
    // 'Attributes' is audited as llm-panel; a vlm verdict must not down-grade it.
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: 'Attributes', judge: 'vlm', verdict: 'fail',
      score: 12, findings: 'wrong class', model: 'qwen-vl', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    const Step = getStepComponent('items', 'Attributes')!;
    render(<Step t={t} entity={entity} step="Attributes" />);
    await waitFor(() => expect(screen.getByTestId('provenance-strip')).toBeTruthy());
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });

  // The bespoke Test Gate (derived 'Checks' panel over sibling verdicts) was retired from the
  // screen on 2026-09-29: 'Test Gate' is registry-owned and grades through the registered
  // entityRuntimeDeferred L3 gate, as the server always did (see itemsUnionSteps.test.tsx).
  it('Test Gate is registry-owned — no bespoke component renders it', () => {
    expect(getStepComponent('items', 'Test Gate')).toBeNull();
  });
});
