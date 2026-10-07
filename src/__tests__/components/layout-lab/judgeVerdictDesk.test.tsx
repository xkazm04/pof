import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * `?ux=judge-verdict` — the [UX] Concept Brief prototype. Without the flag the step must render
 * as it always has (the 200-char excerpt in the banner, panels View · Produce · Raw artifact);
 * with it, the blocking judge verdict is laid out in full and can seed the Produce direction.
 */

const t = LAB_THEMES[0];
const CATALOG = 'combat-map'; // audited Concept Brief judge class: llm-panel
const STEP = 'Concept Brief';
const entity: LabEntity = { id: 'arena-ux', name: 'Ravaged Courtyard', lifecycle: 'planned', data: {} };
const BRIEF = 'A scorched temple courtyard with four pillars of cover. '.repeat(8); // > 300 chars: shape passes

const spec: StepSpec = {
  archetype: 'brief', label: STEP,
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: () => ({ data: { brief: BRIEF } }),
  accept: minLength('brief', 'Brief ≥ 300 characters', 300),
};

// Shaped like the judge runner's record: header, praise first, the defect past char 200, FIX last.
const PRAISE = 'The prose voice is genuinely strong, and the arena reads at a glance with its cover and hazards named. '.repeat(2);
const DEFECT = 'But the brief promises two waves while the Waves & Spawns sibling declares three.';
const FIX = 'State two waves everywhere, or restate the sibling to three.';
const FINDINGS = `[rubric v${RUBRIC_VERSION}+canon] [median-of-3: 83,85,86] ${PRAISE}${DEFECT} FIX: ${FIX}`;

const storedData = () => useLabPipelineStore.getState().byEntity[entity.id]?.[STEP]?.data;

function verdict(over: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId: CATALOG, entityId: entity.id, step: STEP, judge: 'llm-panel', verdict: 'fail', score: 85,
    findings: FINDINGS, model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION, judgedAt: '2026-10-01 10:00:00',
    dimensions: { coherence: 88, specificity: 93, plausibility: 84 },
    contentHash: stepContentHash(storedData()), ...over,
  };
}

function serve(rows: JudgeVerdict[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    json: async () => ({ success: true, data: String(url).startsWith('/api/judge-verdicts') ? rows : [] }),
  })));
}

const panelLabels = () => Array.from(document.querySelectorAll('section > div:first-child')).map((d) => d.textContent);
const blocked = () => waitFor(() => expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail'));

function renderStep(step = STEP) {
  return render(<ArchetypeStep t={t} entity={entity} step={step} spec={{ ...spec, label: step }} catalogId={CATALOG} />);
}

describe('[UX] judge verdict desk — Concept Brief, opt-in via ?ux=judge-verdict', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
    useLabPipelineStore.getState().produce(entity.id, STEP, spec.produce(entity));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

  it('the record under test hides the defect and the fix past the 200-char excerpt the banner shows', () => {
    expect(FINDINGS.indexOf(DEFECT)).toBeGreaterThan(200);
    expect(FINDINGS.indexOf(FIX)).toBeGreaterThan(200);
  });

  it('WITHOUT the opt-in the step renders as before: excerpt banner, no desk, stock panels', async () => {
    serve([verdict()]);
    window.history.replaceState({}, '', '/layout?legacy=0&c=combat-map');
    renderStep();
    await blocked();
    expect(screen.queryByTestId('judge-verdict-desk')).toBeNull();
    expect(panelLabels()).toEqual(['View', 'Produce', 'Raw artifact']);
    const why = screen.getByTestId('acceptance-explanation').textContent ?? '';
    expect(why).toMatch(/This step's acceptance is failing — judge claude-opus-4-8 scored 85 \(fail\)/);
    expect(why).not.toContain(FIX);
    expect((screen.getByTestId('cli-produce-direction') as HTMLTextAreaElement).value).toBe('');
  });

  it('an unrelated ux flag changes nothing either', async () => {
    serve([verdict()]);
    window.history.replaceState({}, '', '/layout?ux=something-else');
    renderStep();
    await blocked();
    expect(screen.queryByTestId('judge-verdict-desk')).toBeNull();
    expect(panelLabels()).toEqual(['View', 'Produce', 'Raw artifact']);
  });

  it('WITH the opt-in the full verdict sits beside the brief: score vs bar, weakest dimension, critique, fix', async () => {
    serve([verdict()]);
    window.history.replaceState({}, '', '/layout?legacy=0&c=combat-map&s=Concept+Brief&ux=judge-verdict');
    renderStep();
    await waitFor(() => expect(screen.getByTestId('judge-verdict-desk')).toBeTruthy());
    expect(panelLabels()).toEqual(['Judge verdict', 'View', 'Produce', 'Raw artifact']);
    expect(screen.getByTestId('judge-score').textContent).toBe('85 / 90 to pass');
    expect(screen.getByTestId('judge-critique').textContent).toContain(DEFECT);
    expect(screen.getByTestId('judge-fix').textContent).toBe(FIX);
    expect(screen.getByTestId('judge-dimensions').textContent).toMatch(/plausibility84.*coherence88.*specificity93/);
    expect(screen.getByTestId('judge-weakest').textContent).toMatch(/^Weakest: plausibility 84, 6 below the bar\./);
    expect(screen.getByTestId('judge-only-blocker')).toBeTruthy();
    expect(screen.getByTestId('judge-after-reproduce').textContent).toMatch(/STALE/);
    // The banner states the decision in one line instead of the excerpt.
    expect(screen.getByTestId('acceptance-explanation').textContent).toMatch(/scored this Concept Brief 85; it passes at 90/);
  });

  it('seeds the judge’s own fix into the Produce direction, and says a stub produce cannot move it', async () => {
    serve([verdict()]);
    window.history.replaceState({}, '', '/layout?ux=judge-verdict');
    renderStep();
    await waitFor(() => expect(screen.getByTestId('judge-seed-direction')).toBeTruthy());
    expect(screen.getByTestId('judge-next-produce').textContent).toMatch(/Live produce is off/);
    fireEvent.click(screen.getByTestId('judge-seed-direction'));
    const direction = (screen.getByTestId('cli-produce-direction') as HTMLTextAreaElement).value;
    expect(direction).toContain(FIX);
    expect(direction).toMatch(/scored it 85 against a bar of 90/);
    expect(screen.getByTestId('judge-seeded')).toBeTruthy();
  });

  it('an old-hash-scheme verdict still blocks, and the desk says a re-produce will NOT retire it', async () => {
    serve([verdict({ contentHash: 'v2-abc-123' })]);
    window.history.replaceState({}, '', '/layout?ux=judge-verdict');
    renderStep();
    await waitFor(() => expect(screen.getByTestId('judge-after-reproduce')).toBeTruthy());
    expect(screen.getByTestId('judge-after-reproduce').textContent).toMatch(/does not retire this verdict, because its content binding was recorded under hash scheme v2/);
  });

  it('when the checker fails too, the banner keeps the checker’s own reason; the desk only adds the verdict', async () => {
    const failing: StepSpec = { ...spec, accept: () => ({ label: 'Brief ≥ 300 characters', status: 'fail', tier: 'L0', detail: 'stub', reason: 'brief names no arena' }) };
    serve([verdict()]);
    window.history.replaceState({}, '', '/layout?ux=judge-verdict');
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={failing} catalogId={CATALOG} />);
    await waitFor(() => expect(screen.getByTestId('judge-verdict-desk')).toBeTruthy());
    expect(screen.queryByTestId('judge-only-blocker')).toBeNull();
    const why = screen.getByTestId('acceptance-explanation').textContent ?? '';
    expect(why).toMatch(/^This step's acceptance is failing — brief names no arena/);
    expect(why).not.toMatch(/scored this Concept Brief/);
  });

  it('stays on Concept Brief: the same flag on another step adds nothing', async () => {
    serve([verdict({ step: 'Encounter Layout' })]);
    window.history.replaceState({}, '', '/layout?ux=judge-verdict');
    useLabPipelineStore.getState().produce(entity.id, 'Encounter Layout', spec.produce(entity));
    renderStep('Encounter Layout');
    await waitFor(() => expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail'));
    expect(screen.queryByTestId('judge-verdict-desk')).toBeNull();
  });
});
