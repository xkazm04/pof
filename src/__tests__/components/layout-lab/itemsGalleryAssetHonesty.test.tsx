import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getStepComponent } from '@/components/layout-lab/steps';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import { serverCheckerFor } from '@/lib/catalog/headless';
import type { GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The bespoke Items generative steps must grade the ASSET, not an integer.
 *
 * `Icon 2D Art` used to be `sel != null ? 'pass' : 'pending'` with the detail
 * `"candidate · 256px"` — a resolution claim about an image that need not exist. `3D
 * Generation` and `Material / Texture` are worse: they are bespoke-only labels, so nothing
 * anywhere graded whether a generator had run, and `itemsMeshWithinTriBudget` graded
 * `data.tris` — a constant hardcoded in `itemGenCandidates.ts`.
 *
 * Live DB, 2026-08-19: `item-1`'s `3D Generation` and `Material / Texture` each held 12
 * batches / 36 candidates with ZERO carrying any generated asset, and both read `pass / L0`.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'gallery-honesty-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

/** A gallery artifact holding ONE batch whose candidates are what the caller passes. */
function galleryData(candidates: Omit<GenCandidate, 'id'>[], extra?: Record<string, unknown>) {
  const batch = makeBatch({
    seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'test', prompt: 'test',
    candidates,
  });
  return historyData(appendBatch(emptyHistory(), batch), extra);
}

/** The deterministic swatch a candidate carries when no generator has run. */
const SWATCH = 'linear-gradient(135deg, hsl(10 46% 42%), hsl(38 56% 64%))';

function seedStep(step: string, data: Record<string, unknown>) {
  useLabPipelineStore.setState({
    byEntity: {
      [entity.id]: {
        [step]: { done: true, data, ueAssets: [], at: '2026-01-01T00:00:00.000Z' },
      },
    },
  });
}

const bannerStatus = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');

describe('bespoke Items gallery steps grade the generated asset, not an integer', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('Icon 2D Art with a swatch-only history renders `deferred`, not `pass`', () => {
    seedStep('Icon 2D Art', galleryData([
      { swatch: SWATCH, payload: { selected: 0 } },
      { swatch: SWATCH, payload: { selected: 1 } },
    ]));
    const Step = getStepComponent('items', 'Icon 2D Art')!;
    render(<Step t={t} entity={entity} step="Icon 2D Art" />);
    expect(bannerStatus()).toBe('deferred');
  });

  it('Icon 2D Art passes at L1 once the selected candidate carries a real generated image', () => {
    const data = galleryData([
      { swatch: SWATCH, imageUrl: '/api/visual-gen/icon/items__icon-2d-art__0.png', payload: { selected: 0 } },
    ]);
    const r = ITEM_STEP_SPECS['Icon 2D Art'].accept(data);
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L1');
    expect(r.detail).toContain('/api/visual-gen/icon/');
  });

  it('the bespoke 3D Generation verdict EQUALS the registered 3D Mesh verdict for the same shape', () => {
    const registered = serverCheckerFor('items', '3D Mesh');
    expect(registered, 'the registered items pipeline must declare a 3D Mesh checker').toBeTruthy();

    // One artifact both checkers can read: the bespoke tri fields, the registry's selection
    // index, and ONE shared swatch-only history.
    const swatchOnly = galleryData(
      [{ swatch: SWATCH, caption: '4200 tris', payload: { tris: 4200, cap: 6000 } }],
      { tris: 4200, cap: 6000, mesh3dSelected: 0 },
    );
    const bespoke = ITEM_STEP_SPECS['3D Generation'].accept(swatchOnly);
    const registry = registered!(swatchOnly);
    expect({ status: bespoke.status, tier: bespoke.tier }).toEqual({ status: registry.status, tier: registry.tier });
    expect(bespoke.status).toBe('deferred');
    expect(bespoke.tier).toBe('L4');
    expect(bespoke.reason).toBeTruthy();

    // …and they agree the other way too, once a real mesh is attached.
    const withAsset = galleryData(
      [{ swatch: SWATCH, caption: '4200 tris', payload: { tris: 4200, cap: 6000, glbUrl: '/api/visual-gen/asset/pof_1.glb' } }],
      { tris: 4200, cap: 6000, mesh3dSelected: 0 },
    );
    const bespokeOk = ITEM_STEP_SPECS['3D Generation'].accept(withAsset);
    const registryOk = registered!(withAsset);
    expect({ status: bespokeOk.status, tier: bespokeOk.tier }).toEqual({ status: registryOk.status, tier: registryOk.tier });
    expect(bespokeOk.status).toBe('pass');
  });

  it('Material / Texture with a swatch-only history defers at L4 with a reason', () => {
    const data = galleryData(
      [{ swatch: SWATCH, caption: 'worn iron', payload: { maps: ['Albedo', 'Normal', 'ORM'] } }],
      { maps: ['Albedo', 'Normal', 'ORM'] },
    );
    const r = ITEM_STEP_SPECS['Material / Texture'].accept(data);
    expect(r.status).toBe('deferred');
    expect(r.tier).toBe('L4');
    expect(String(r.reason)).toContain('swatch');
  });

  it('the SHAPE defect still wins over the asset question — a missing ORM map is reported first', () => {
    const data = galleryData(
      [{ swatch: SWATCH, caption: 'worn iron', payload: { maps: ['Albedo', 'Normal'] } }],
      { maps: ['Albedo', 'Normal'] },
    );
    const r = ITEM_STEP_SPECS['Material / Texture'].accept(data);
    expect(r.status).toBe('pending');
    expect(String(r.reason)).toContain('ORM');
  });

  it('a bespoke generative step with NO generation history defers instead of passing on a constant', () => {
    // Exactly what `populateItemDemo` writes: the produce stub's hardcoded tri count.
    const stub = (ITEM_STEP_SPECS['3D Generation'].produce(entity).data ?? {}) as Record<string, unknown>;
    expect(stub.tris).toBe(4200); // the constant that used to be the whole gate
    const r = ITEM_STEP_SPECS['3D Generation'].accept(stub);
    expect(r.status).toBe('deferred');
    expect(r.tier).toBe('L4');
    expect(String(r.reason)).toContain('no generation history');
  });

  it('the deferred copy does not tell the operator to pick a candidate they already picked', () => {
    seedStep('Icon 2D Art', galleryData([{ swatch: SWATCH, payload: { selected: 0 } }]));
    const r = ITEM_STEP_SPECS['Icon 2D Art'].accept(
      useLabPipelineStore.getState().byEntity[entity.id]['Icon 2D Art'].data,
    );
    expect(r.status).toBe('deferred');
    expect(String(r.why)).not.toContain('has been picked yet');
    expect(String(r.why)).toContain('swatch');
  });
});
