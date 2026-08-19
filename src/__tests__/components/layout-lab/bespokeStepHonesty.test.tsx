import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { getStepComponent } from '@/components/layout-lab/steps';
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

  it('every one of the 13 bespoke steps renders a provenance strip and a raw-artifact disclosure', () => {
    expect(ITEM_STEP_NAMES).toHaveLength(13);
    seedAll();
    for (const step of ITEM_STEP_NAMES) {
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
      catalogId: 'items', entityId: entity.id, step: 'Concept Brief', judge: 'llm-panel', verdict: 'fail',
      score: 38, findings: 'generic filler prose', model: 'sonnet', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    const Step = getStepComponent('items', 'Concept Brief')!;
    render(<Step t={t} entity={entity} step="Concept Brief" />);
    // The shape checker alone reads pass (>= 300 chars)…
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    // …and the persisted judge verdict now reaches the bespoke banner too.
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
  });

  it('a matching-class judge FAIL down-grades a bespoke GENERATIVE step banner', async () => {
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: 'Icon 2D Art', judge: 'vlm', verdict: 'fail',
      score: 44, findings: 'silhouette unreadable at 64px', model: 'qwen-vl', rubricVersion: RUBRIC_VERSION,
    }]));
    // The step must own a REAL generated image for the checker to pass — a swatch-only
    // history defers, and `bridgeJudgeVerdict` deliberately down-grades only a shape-PASS.
    seedAll();
    reseed('Icon 2D Art', withRealArt({ selected: 0 }));
    const Step = getStepComponent('items', 'Icon 2D Art')!;
    render(<Step t={t} entity={entity} step="Icon 2D Art" />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
  });

  it('a WRONG-class judge verdict never speaks for a bespoke step', async () => {
    // 'Concept Brief' is audited as llm-panel; a vlm verdict must not down-grade it.
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: 'Concept Brief', judge: 'vlm', verdict: 'fail',
      score: 12, findings: 'wrong class', model: 'qwen-vl', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    const Step = getStepComponent('items', 'Concept Brief')!;
    render(<Step t={t} entity={entity} step="Concept Brief" />);
    await waitFor(() => expect(screen.getByTestId('provenance-strip')).toBeTruthy());
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });

  it('a bespoke step grades through the unified context — the Test Gate reads real siblings', () => {
    // Every sibling produced → the derived gate reads them. The three generative upstreams own
    // no generated asset from a produce stub, so they defer, and a gate blocked only by
    // deferred upstreams defers too (nothing failed; nothing local can make it pass).
    seedAll();
    const Step = getStepComponent('items', 'Test Gate')!;
    const { unmount } = render(<Step t={t} entity={entity} step="Test Gate" />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('deferred');
    unmount();

    // Break one upstream step (Animations loses its clips) → the gate must fail.
    const state = useLabPipelineStore.getState().byEntity[entity.id];
    useLabPipelineStore.setState({
      byEntity: { [entity.id]: { ...state, Animations: { ...state.Animations, data: { clips: [] } } } },
    });
    render(<Step t={t} entity={entity} step="Test Gate" />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
  });
});
