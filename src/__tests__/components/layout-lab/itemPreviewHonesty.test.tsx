import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { getStepComponent } from '@/components/layout-lab/steps';
import { ITEM_STEP_NAMES, ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { withGeneratedImages } from '@/components/layout-lab/steps/shared/assetHonesty';
import { withItemFixCopy } from '@/components/layout-lab/steps/shared/itemFixCopy';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { iconSlug, slugOfIconFile } from '@/lib/visual-gen/generated-icons';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import type { Acceptance } from '@/components/layout-lab/steps/StepFrame';
import type { GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Two guarantees for the bespoke Items reference pipeline:
 *
 *  1. Its preview panels never present a fabrication as output. Each one used to: a CSS
 *     gradient captioned `◈ LOD0 preview`, an LOD ladder computed as `tris/(i+1)`, four
 *     literal hex constants standing in for Albedo/Normal/ORM/Height, a `sin(i*0.7)`
 *     waveform, an inventory grid depicting the widget drawing the item, and a green
 *     `✓ /Game/Items/…` for a file nothing had written.
 *  2. The honesty layer is DISPLAY ONLY — neither the remediation copy nor the real-asset
 *     overlay may move a verdict.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'preview-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

function seedAll() {
  const byStep: Record<string, { done: boolean; data: Record<string, unknown>; ueAssets: string[]; at: string }> = {};
  for (const step of ITEM_STEP_NAMES) {
    const out = ITEM_STEP_SPECS[step].produce(entity);
    byStep[step] = { done: true, data: out.data ?? {}, ueAssets: out.ueAssets ?? [], at: '2026-01-01T00:00:00.000Z' };
  }
  useLabPipelineStore.setState({ byEntity: { [entity.id]: byStep } });
}

/** `fetch` stub: no judge verdicts, and an icon manifest the test chooses. */
function iconFetch(icons: { name: string; url: string }[], verdicts: unknown[] = []) {
  return vi.fn(async (url: string) => ({
    json: async () => {
      const u = String(url);
      if (u.startsWith('/api/visual-gen/icons')) return { success: true, data: { icons } };
      if (u.startsWith('/api/judge-verdicts')) return { success: true, data: verdicts };
      return { success: true, data: [] };
    },
  }));
}

const gate = (over: Partial<Acceptance> = {}): Acceptance => ({
  label: 'A main icon is selected', status: 'fail', detail: 'none selected', ...over,
});

describe('withItemFixCopy — remediation copy merged onto the RESOLVED verdict', () => {
  it('returns a passing verdict untouched (a clean banner stays clean)', () => {
    const base = gate({ status: 'pass', why: undefined });
    expect(withItemFixCopy('Concept Brief', {}, base)).toBe(base);
  });

  it('is DISPLAY ONLY — every graded field is passed through byte-identically', () => {
    for (const status of ['fail', 'pending', 'deferred'] as const) {
      const base = gate({
        status, label: 'crit', detail: 'd', tier: 'L4', reason: 'the checker said so',
        judge: { provenance: 'current', verdict: 'fail', score: 12, judge: 'vlm', note: 'n' },
      });
      const out = withItemFixCopy('Icon 2D Art', { selected: 0 }, base);
      expect(out.status, status).toBe(base.status);
      expect(out.label).toBe(base.label);
      expect(out.detail).toBe(base.detail);
      expect(out.tier).toBe(base.tier);
      expect(out.reason).toBe(base.reason);
      expect(out.judge).toBe(base.judge);
    }
  });

  it('a POST-overlay down-grade (no `why` from the checker) still gets an explanation naming the winning layer’s reason', () => {
    const out = withItemFixCopy('Concept Brief', { brief: 'x'.repeat(450) }, gate({
      status: 'fail', label: 'Brief is at least 300 characters', detail: '450 / 300 chars',
      reason: 'judge sonnet scored 38 (fail): generic filler prose',
    }));
    expect(out.why).toContain('generic filler prose');
    // Never the bespoke checker copy, which would call a 450-char brief "too short".
    expect(out.why).not.toContain('too short');
    expect((out.fixDirection ?? '').trim()).not.toBe('');
  });

  it('keeps the checker’s own bespoke copy when the checker is what graded non-pass', () => {
    const out = withItemFixCopy('Concept Brief', {}, gate({
      status: 'pending', why: 'No concept brief has been written yet.', suggestion: 'Run Produce to draft a brief.',
    }));
    expect(out.why).toBe('No concept brief has been written yet.');
    expect(out.suggestion).toBe('Run Produce to draft a brief.');
  });

  it('a DEFERRED step gets a why but NO fix direction (a runtime/visual gate is not locally fixable)', () => {
    const out = withItemFixCopy('Test Gate', {}, gate({
      status: 'deferred', tier: 'L3', reason: 'VSItemsDefinitionsTest has not reported',
    }));
    expect(out.why).toBeTruthy();
    expect(out.fixDirection).toBeUndefined();
  });

  it('the fix direction is NEVER empty — copy → the step’s default direction → derived', () => {
    // (a) the copy's own direction wins
    expect(withItemFixCopy('X', {}, gate({ why: 'w', fixDirection: 'retopo under 6000' }), 'fallback').fixDirection)
      .toBe('retopo under 6000');
    // (b) a blank copy direction falls through to the step's default direction
    expect(withItemFixCopy('X', {}, gate({ why: 'w', fixDirection: '   ' }), 'fallback').fixDirection)
      .toBe('fallback');
    // (c) neither → a direction derived from the step label + the checker's own reason
    const derived = withItemFixCopy('Material / Texture', {}, gate({ why: 'w', reason: 'ORM missing' })).fixDirection ?? '';
    expect(derived).toContain('Material / Texture');
    expect(derived).toContain('ORM missing');
  });
});

describe('withGeneratedImages — real art in a bespoke gallery, honest counts', () => {
  const batch = (): Omit<GenCandidate, 'id'>[] => [
    { swatch: 'linear-gradient(a)', payload: { tris: 4200, cap: 6000 }, caption: '4200 tris' },
    { swatch: 'linear-gradient(b)', payload: { tris: 5200, cap: 6000 }, caption: '5200 tris' },
    { swatch: 'linear-gradient(c)', payload: { tris: 5900, cap: 6000 }, caption: '5900 tris' },
  ];

  it('an EMPTY manifest leaves the batch exactly as the bespoke generator built it', () => {
    const b = batch();
    expect(withGeneratedImages(b, [], 0)).toBe(b);
  });

  it('only min(candidates, assets) slots carry a real image — one file never fills the grid', () => {
    const out = withGeneratedImages(batch(), [{ name: 'items_icon_2d_art.jpg', url: '/api/visual-gen/icon/items_icon_2d_art.jpg' }], 0);
    expect(out.filter((c) => c.imageUrl).length).toBe(1);
    expect(out[0].imageUrl).toBe('/api/visual-gen/icon/items_icon_2d_art.jpg');
    expect(out[0].caption).toContain('4200 tris');
    expect(out[0].caption).toContain('items_icon_2d_art.jpg');
  });

  it('leaves every PAYLOAD byte-identical — the overlay provably cannot move a verdict', () => {
    const before = batch();
    const out = withGeneratedImages(before.map((c) => ({ ...c })), [
      { name: 'a.jpg', url: '/a' }, { name: 'b.jpg', url: '/b' }, { name: 'c.jpg', url: '/c' },
    ], 1);
    expect(out.map((c) => c.payload)).toEqual(before.map((c) => c.payload));
    expect(out.map((c) => c.swatch)).toEqual(before.map((c) => c.swatch));
  });

  it('the art on disk for `Icon 2D Art` really is addressed to this step', () => {
    expect(slugOfIconFile('items_icon_2d_art.jpg')).toBe(iconSlug('items', 'Icon 2D Art'));
  });
});

describe('bespoke Items preview panels name what they are showing', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('the Icon 2D Art "Selected" panel carries the honest asset caption', () => {
    vi.stubGlobal('fetch', iconFetch([]));
    seedAll();
    const Step = getStepComponent('items', 'Icon 2D Art')!;
    render(<Step t={t} entity={entity} step="Icon 2D Art" />);
    const caption = screen.getByTestId('gallery-selected-caption').textContent ?? '';
    // With no generated art in the manifest the panel must say so, not render a bare tile.
    expect(caption).toContain('not the generated asset');
  });

  it('shows the REAL file name once this step owns generated art', async () => {
    vi.stubGlobal('fetch', iconFetch([{ name: 'items_icon_2d_art.jpg', url: '/api/visual-gen/icon/items_icon_2d_art.jpg' }]));
    // Seed a gallery history whose selected candidate carries the served image, exactly as
    // a Produce run with the manifest present would write it.
    useLabPipelineStore.setState({ byEntity: { [entity.id]: { 'Icon 2D Art': {
      done: true, at: '2026-01-01T00:00:00.000Z', ueAssets: ['/Game/Items/T_IronLongsword_Icon'],
      data: {
        selected: 0,
        genHistory: { batches: [{ id: 'b0', seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'd', prompt: 'p',
          candidates: [{ id: 'b0-c0', swatch: 'linear-gradient(a)', imageUrl: '/api/visual-gen/icon/items_icon_2d_art.jpg', caption: 'items_icon_2d_art.jpg', payload: { selected: 0 } }] }],
          selectedId: 'b0-c0' },
      },
    } } } });
    const Step = getStepComponent('items', 'Icon 2D Art')!;
    render(<Step t={t} entity={entity} step="Icon 2D Art" />);
    await waitFor(() => {
      expect(screen.getByTestId('gallery-selected-caption').textContent ?? '').toContain('items_icon_2d_art.jpg');
    });
    expect(screen.getByTestId('gallery-selected-caption').textContent ?? '').toContain('Real generated asset');
  });

  it('3D Generation no longer prints an invented LOD ladder, and its UE path reads as a TARGET', () => {
    vi.stubGlobal('fetch', iconFetch([]));
    seedAll();
    const Step = getStepComponent('items', '3D Generation')!;
    const { container } = render(<Step t={t} entity={entity} step="3D Generation" />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('◈ LOD0 preview');
    // 4200 / 2 = 2100, 4200 / 3 = 1400 — the fabricated ladder rows.
    expect(text).not.toContain('2100 tris');
    expect(text).not.toContain('1400 tris');
    expect(text).toContain('4200 tris'); // LOD0, which the artifact actually records
    expect(screen.getByTestId('asset-target').textContent ?? '').toContain('written by the drain');
  });

  it('Material / Texture states that map NAMES are declared, and paints no invented texture colours', () => {
    vi.stubGlobal('fetch', iconFetch([]));
    seedAll();
    const Step = getStepComponent('items', 'Material / Texture')!;
    const { container } = render(<Step t={t} entity={entity} step="Material / Texture" />);
    expect(container.textContent ?? '').toContain('no texture is sampled');
    // The literal hex constants that used to fill the tiles / the reference sphere. Quoted
    // here only to assert their ABSENCE — this is the one place they may still appear.
    const html = container.innerHTML;
    // eslint-disable-next-line no-restricted-syntax -- asserting these hexes are GONE from the DOM
    for (const hex of ['#b08d57', '#8088ff', '#9a9a4a', '#e6c98a', '#8a5a2b']) {
      expect(html.toLowerCase(), hex).not.toContain(hex);
    }
  });

  it('the SFX waveform says it is synthetic, not the produced audio', () => {
    seedAll();
    const Step = getStepComponent('items', 'SFX')!;
    render(<Step t={t} entity={entity} step="SFX" />);
    expect(screen.getByTestId('sfx-waveform-provenance').textContent ?? '').toContain('Synthetic trace');
  });

  it('the inventory grid says it is a layout mock, not the widget rendering the item', () => {
    seedAll();
    const Step = getStepComponent('items', 'Inventory UI Integration')!;
    const { container } = render(<Step t={t} entity={entity} step="Inventory UI Integration" />);
    expect(screen.getByTestId('inventory-grid-provenance').textContent ?? '').toContain('not rendered or verified');
    // eslint-disable-next-line no-restricted-syntax -- asserting the invented cell gradient is GONE
    const goneGradientStop = '#d8a657';
    expect(container.innerHTML.toLowerCase()).not.toContain(goneGradientStop);
  });
});

/**
 * `withCopy` runs INSIDE `accept` and returns early on `pass`, so the plain-language
 * `why` / `suggestion` / `fixDirection` were computed BEFORE the server overlay and the
 * judge bridge could move the status. A judge down-grade therefore rendered a bare FAIL
 * with a terse `detail` — and since `StepFrame` nests "⚡ Produce fix" inside
 * `{acceptance.why && …}` (StepFrame.tsx:168,182), the step ALSO lost its one-click
 * remediation. Both frames now merge the copy onto the RESOLVED verdict, where the generic
 * renderer merges its own (`ArchetypeStep.tsx:266-269`).
 */
describe('a judge-flipped bespoke step keeps its explanation AND its Produce-fix button', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('STATIC step (Concept Brief, llm-panel FAIL)', async () => {
    vi.stubGlobal('fetch', iconFetch([], [{
      catalogId: 'items', entityId: entity.id, step: 'Concept Brief', judge: 'llm-panel', verdict: 'fail',
      score: 38, findings: 'generic filler prose', model: 'sonnet', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    const Step = getStepComponent('items', 'Concept Brief')!;
    render(<Step t={t} entity={entity} step="Concept Brief" />);
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
    const why = screen.getByTestId('acceptance-explanation').textContent ?? '';
    // The explanation names the JUDGE's own reason — the bespoke `briefCopy` is authored for
    // a checker failure and would call a 300+ char brief "too short".
    expect(why).toContain('generic filler prose');
    expect(why).not.toContain('too short');
    expect(screen.getByTestId('acceptance-produce-fix')).toBeTruthy();
  });

  it('GENERATIVE step (Material / Texture, llm-panel FAIL)', async () => {
    vi.stubGlobal('fetch', iconFetch([], [{
      catalogId: 'items', entityId: entity.id, step: 'Material / Texture', judge: 'llm-panel', verdict: 'fail',
      score: 41, findings: 'ORM channels unpacked', model: 'sonnet', rubricVersion: RUBRIC_VERSION,
    }]));
    seedAll();
    // A generative step must own a REAL generated asset for its checker to pass — a
    // swatch-only history is `deferred`, and `bridgeJudgeVerdict` down-grades only a
    // shape-PASS. So the judge flip is only observable on a step that actually has art.
    const maps = { maps: ['Albedo', 'Normal', 'ORM', 'Height'] };
    const batch = makeBatch({
      seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'gen', prompt: 'gen',
      candidates: [{ swatch: 'linear-gradient(a)', imageUrl: '/api/visual-gen/icon/real.png', payload: maps }],
    });
    const state = useLabPipelineStore.getState().byEntity[entity.id];
    useLabPipelineStore.setState({ byEntity: { [entity.id]: { ...state, 'Material / Texture': {
      ...state['Material / Texture'], data: historyData(appendBatch(emptyHistory(), batch), maps),
    } } } });
    const Step = getStepComponent('items', 'Material / Texture')!;
    render(<Step t={t} entity={entity} step="Material / Texture" />);
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
    expect(screen.getByTestId('acceptance-explanation').textContent ?? '').toContain('ORM channels unpacked');
    expect(screen.getByTestId('acceptance-produce-fix')).toBeTruthy();
  });
});
