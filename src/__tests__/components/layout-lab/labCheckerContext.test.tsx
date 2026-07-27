import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import {
  buildLabCheckerContext, labGrade, serverVerdictOverlay,
} from '@/components/layout-lab/labCheckerContext';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { registerCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';

/**
 * ONE truth for grading: the on-screen banner, the write-through that PERSISTS the verdict,
 * and the rail recompute must run a step's Checker under the SAME CheckerContext — and the
 * lab must apply the same judge overlay + drain-verdict overlay the headless path applies.
 */

const t = LAB_THEMES[0];
const entity = { id: 'e1', name: 'Blade', lifecycle: 'planned' as const, data: {} };
const CAT = 'ctx-test-catalog';
const STEP = 'Test Gate';

/** A SIBLING-aware checker: it passes only when an upstream step's artifact says so. */
const siblingAware: Checker = (data, ctx): AcceptanceResult => {
  const upstream = ctx?.siblings?.['Concept Brief'];
  return upstream?.ready === true
    ? { label: 'Upstream brief ready', status: 'pass', tier: 'L1', detail: 'sibling ready' }
    : { label: 'Upstream brief ready', status: 'fail', tier: 'L1', detail: 'sibling not ready', reason: 'Concept Brief has not produced a ready brief' };
};

const spec: StepSpec = {
  archetype: 'checklist', label: STEP,
  view: { kind: 'checklist', field: 'items' },
  produce: () => ({ data: { items: ['a'] } }),
  accept: siblingAware,
};

/** A checker that can only ever defer — the L3/L4 gate shape the drain resolves. */
const gateSpec: StepSpec = {
  archetype: 'checklist', label: STEP,
  view: { kind: 'checklist', field: 'items' },
  produce: () => ({ data: { items: ['a'] } }),
  accept: () => ({ label: 'Runtime gate', status: 'deferred', tier: 'L3', detail: 'gate not run', reason: 'live-UE gate not run' }),
};

/** A plain passing checker — for the judge-downgrade case. */
const passSpec: StepSpec = {
  archetype: 'checklist', label: STEP,
  view: { kind: 'checklist', field: 'items' },
  produce: () => ({ data: { items: ['a'] } }),
  accept: () => ({ label: 'Shape ok', status: 'pass', tier: 'L0', detail: '1 item' }),
};

function seed(steps: Record<string, Record<string, unknown>>, extra?: Record<string, { status?: string; tier?: string; reason?: string }>) {
  const byStep: Record<string, { done: boolean; data: Record<string, unknown>; ueAssets: string[]; at: string; status?: string; tier?: string; reason?: string }> = {};
  for (const [s, data] of Object.entries(steps)) {
    byStep[s] = { done: true, data, ueAssets: [], at: '2026-01-01T00:00:00.000Z', ...(extra?.[s] ?? {}) };
  }
  useLabPipelineStore.setState({ byEntity: { [entity.id]: byStep } });
}

describe('lab grading — one CheckerContext for banner and write-through', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
    registerCatalogPipeline({ catalogId: CAT, steps: [spec] });
  });

  it('builds siblings from every persisted step and a live `has`', () => {
    const ctx = buildLabCheckerContext(CAT, {
      A: { done: true, data: { x: 1 }, ueAssets: [], at: '' },
    }, { other: { e9: {} } });
    expect(ctx.catalog).toBe(CAT);
    expect(ctx.siblings.A).toEqual({ x: 1 });
    expect(ctx.has('other', 'e9')).toBe(true);
    expect(ctx.has('other', 'nope')).toBe(false);
  });

  it('a sibling-aware checker agrees in the banner and in the persisted grade', () => {
    // Upstream NOT ready → both paths must read `fail`.
    seed({ 'Concept Brief': { ready: false }, [STEP]: { items: ['a'] } });
    const { unmount } = render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId={CAT} />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    expect(labGrade(CAT, entity.id, STEP, { items: ['a'] })?.status).toBe('fail');
    unmount();

    // Upstream ready → both paths must read `pass` (the old banner passed `siblings: {}`,
    // so it disagreed with the status the write-through persisted).
    seed({ 'Concept Brief': { ready: true }, [STEP]: { items: ['a'] } });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId={CAT} />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    expect(labGrade(CAT, entity.id, STEP, { items: ['a'] })?.status).toBe('pass');
  });

  it('a matching-class judge FAIL down-grades the on-screen banner', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      json: async () => (String(url).startsWith('/api/judge-verdicts')
        ? { success: true, data: [{
            catalogId: CAT, entityId: entity.id, step: STEP, judge: 'llm-panel', verdict: 'fail',
            score: 41, findings: 'shallow content, contradicts canon', model: 'sonnet', rubricVersion: RUBRIC_VERSION,
          }] }
        : { success: true, data: [] }),
    })));
    seed({ [STEP]: { items: ['a'] } });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={passSpec} catalogId={CAT} />);
    // Checker alone says pass…
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    // …the judge verdict arrives and condemns the content.
    await waitFor(() => {
      expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('fail');
    });
    expect(screen.getByTestId('acceptance-explanation').textContent).toContain('scored 41');
  });

  it('a persisted drain verdict resolves the banner of a deferred gate', () => {
    seed({ [STEP]: { items: ['a'] } });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={gateSpec} catalogId={CAT} />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('deferred');
    cleanup();
    // The drain ran server-side; hydration carried the verdict onto the artifact.
    seed({ [STEP]: { items: ['a'] } }, { [STEP]: { status: 'pass', tier: 'L3', reason: 'gate passed in UE' } });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={gateSpec} catalogId={CAT} />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });
});

describe('serverVerdictOverlay', () => {
  const deferred: AcceptanceResult = { label: 'g', status: 'deferred', tier: 'L3', detail: '', reason: 'not run' };
  const passing: AcceptanceResult = { label: 'g', status: 'pass', tier: 'L0', detail: '' };

  it('lets a concrete server verdict resolve a local deferral (with its reason)', () => {
    const r = serverVerdictOverlay(deferred, { status: 'fail', tier: 'L3', reason: 'gate failed' });
    expect(r.status).toBe('fail');
    expect(r.reason).toBe('gate failed');
  });

  it('never overrides a verdict the checker could decide itself', () => {
    expect(serverVerdictOverlay(passing, { status: 'fail' }).status).toBe('pass');
  });

  it('leaves a deferral alone for a non-concrete / absent server status', () => {
    expect(serverVerdictOverlay(deferred, { status: 'deferred' }).status).toBe('deferred');
    expect(serverVerdictOverlay(deferred, undefined).reason).toBe('not run');
  });
});

describe('hydrateEntity — server verdict merges onto an existing local artifact', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('keeps local content add-only but adopts the server status/tier/reason', () => {
    seed({ [STEP]: { items: ['local'] } });
    useLabPipelineStore.getState().hydrateEntity(entity.id, [{
      step: STEP,
      artifact: { done: true, data: { items: ['server'] }, ueAssets: [], at: '', status: 'pass', tier: 'L3', reason: 'gate passed' },
    }]);
    const art = useLabPipelineStore.getState().byEntity[entity.id][STEP];
    expect(art.data.items).toEqual(['local']); // content untouched (add-only)
    expect(art.status).toBe('pass');
    expect(art.tier).toBe('L3');
    expect(art.reason).toBe('gate passed');
  });
});
