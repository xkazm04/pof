import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getStepComponent } from '@/components/layout-lab/steps';
import { ITEM_STEP_NAMES, ITEM_STEP_SPECS, deriveGateChecks } from '@/components/layout-lab/steps/itemsSteps';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The Test Gate is the step that GATES THE WHOLE ITEM, and it used to re-run each sibling's
 * LOCAL shape checker on raw `data` — no `CheckerContext`, no server drain verdict, no judge
 * verdict — while `resolveStepAcceptance` is the app's declared single truth for exactly that
 * merge. `labCheckerContext.ts` dropped `status`/`tier`/`reason` from every `LabStepArtifact`
 * before the gate could see them.
 *
 * Measured on the live DB 2026-08-19: `item-1`'s `Icon 2D Art` was `deferred / L4` on the
 * server with the reason "not a generated asset", and the gate's `"Visual QA (icon + mesh)"`
 * row printed PASS with `Result={Success}` beside it.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'gate-layers-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

type Seeded = {
  done: boolean; data: Record<string, unknown>; ueAssets: string[]; at: string;
  status?: string; tier?: string; reason?: string;
};

/** An artifact whose selected candidate carries a REAL generated image → its checker passes. */
function withRealArt(data: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...data };
  delete payload.genHistory;
  const batch = makeBatch({
    seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'gen', prompt: 'gen',
    candidates: [{ swatch: 'linear-gradient(135deg, #444, #888)', imageUrl: '/api/visual-gen/icon/real.png', payload }],
  });
  return historyData(appendBatch(emptyHistory(), batch), data);
}

/** An artifact whose selected candidate is only a deterministic swatch → its checker defers. */
function swatchOnly(data: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...data };
  delete payload.genHistory;
  const batch = makeBatch({
    seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'stub', prompt: 'stub',
    candidates: [{ swatch: 'linear-gradient(135deg, #444, #888)', payload }],
  });
  return historyData(appendBatch(emptyHistory(), batch), data);
}

/**
 * Seed every Items step with its produce output, then give the three generative steps REAL
 * art so the gate's own baseline is a clean `pass` — the point of these tests is what a
 * SERVER or JUDGE verdict does to it, not what a missing generator does (that is
 * itemsGalleryAssetHonesty.test.tsx).
 */
function seedAllPassing(overrides?: Record<string, Partial<Seeded>>) {
  const byStep: Record<string, Seeded> = {};
  for (const step of ITEM_STEP_NAMES) {
    const out = ITEM_STEP_SPECS[step].produce(entity);
    byStep[step] = { done: true, data: out.data ?? {}, ueAssets: out.ueAssets ?? [], at: '2026-01-01T00:00:00.000Z' };
  }
  byStep['Icon 2D Art'].data = withRealArt({ selected: 0 });
  byStep['3D Generation'].data = withRealArt({ tris: 4200, cap: 6000 });
  byStep['Material / Texture'].data = withRealArt({ maps: ['Albedo', 'Normal', 'ORM', 'Height'] });
  for (const [step, patch] of Object.entries(overrides ?? {})) {
    byStep[step] = { ...byStep[step], ...patch };
  }
  useLabPipelineStore.setState({ byEntity: { [entity.id]: byStep } });
}

function verdictFetch(rows: unknown[]) {
  return vi.fn(async (url: string) => ({
    json: async () => {
      const u = String(url);
      if (u.startsWith('/api/judge-verdicts')) return { success: true, data: rows };
      if (u.startsWith('/api/visual-gen/icons')) return { success: true, data: { icons: [] } };
      return { success: true, data: [] };
    },
  }));
}

const banner = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const canvas = () => document.body.textContent ?? '';

describe('the Items Test Gate reads RESOLVED sibling verdicts, not raw shape', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('a clean item with real art passes the gate — the baseline these tests move off', () => {
    seedAllPassing();
    const Step = getStepComponent('items', 'Test Gate')!;
    render(<Step t={t} entity={entity} step="Test Gate" />);
    expect(banner()).toBe('pass');
    expect(canvas()).toContain('Result={Success}');
  });

  it('a DRAIN that condemned Icon 2D Art fails the gate and names the drain as the layer', () => {
    // The live shape: the artifact holds only swatch candidates, so its own checker can say no
    // more than `deferred` — and the drain, which actually ran, recorded `fail`. Only
    // `serverVerdictOverlay` knows that, and the gate never used to see it.
    seedAllPassing({
      'Icon 2D Art': {
        data: swatchOnly({ selected: 0 }),
        status: 'fail', tier: 'L4', reason: 'the icon never rendered in the drain',
      },
    });
    const Step = getStepComponent('items', 'Test Gate')!;
    render(<Step t={t} entity={entity} step="Test Gate" />);
    expect(banner()).toBe('fail');
    expect(canvas()).toContain('Icon 2D Art (fail · drain)');
    expect(canvas()).toContain('Result={Failure}');
    expect(canvas()).not.toContain('Result={Success}');
  });

  it('a DRAIN that PASSED an L4 gallery step unblocks the gate — the overlay works both ways', () => {
    // The mirror case, and the reason this must be the resolved verdict rather than the raw
    // checker: a swatch-only artifact defers locally forever, so a successful drain used to
    // change nothing in the gate that is supposed to be downstream of it.
    seedAllPassing({
      'Icon 2D Art': {
        data: swatchOnly({ selected: 0 }),
        status: 'pass', tier: 'L4', reason: 'drain observed the rendered icon',
      },
    });
    const Step = getStepComponent('items', 'Test Gate')!;
    render(<Step t={t} entity={entity} step="Test Gate" />);
    expect(banner()).toBe('pass');
    expect(canvas()).toContain('Result={Success}');
  });

  it('a matching-class judge FAIL on Animations blocks "Equip + use in PIE" and names the judge', async () => {
    vi.stubGlobal('fetch', verdictFetch([{
      catalogId: 'items', entityId: entity.id, step: 'Animations', judge: 'human', verdict: 'fail',
      score: 30, findings: 'equip montage never fires', model: 'operator', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAllPassing();
    const Step = getStepComponent('items', 'Test Gate')!;
    render(<Step t={t} entity={entity} step="Test Gate" />);
    await waitFor(() => {
      expect(canvas()).toContain('Animations (fail · judge)');
    });
    expect(banner()).toBe('fail');
  });

  it('deriveGateChecks stays PURE — with no resolver it falls back to the sibling checker', () => {
    const siblings: Record<string, Record<string, unknown>> = {};
    for (const step of ITEM_STEP_NAMES) {
      siblings[step] = (ITEM_STEP_SPECS[step].produce(entity).data ?? {}) as Record<string, unknown>;
    }
    const noResolver = deriveGateChecks(siblings);
    const visual = noResolver.find((r) => r.name === 'Visual QA (icon + mesh)')!;
    expect(visual.blockers.every((b) => b.layer === 'checker')).toBe(true);

    // …and an injected resolver is what moves it, with no store involved at all.
    const injected = deriveGateChecks(siblings, (s) => (s === 'Attributes' ? { status: 'fail', source: 'judge' } : undefined));
    const stats = injected.find((r) => r.name === 'Stat/rules unit test')!;
    expect(stats.ok).toBe(false);
    expect(stats.blockedBy).toContain('Attributes (fail · judge)');
  });
});
