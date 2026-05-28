import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Empty fetch/post/drain — we don't exercise the server in this test.
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  postArtifact: vi.fn().mockResolvedValue(undefined),
  drainGates: vi.fn().mockResolvedValue(null),
}));

// No bespoke steps registered for our synthetic catalog → falls through to ArchetypeStep.
vi.mock('@/components/layout-lab/steps', () => ({
  getStepComponent: vi.fn().mockReturnValue(null),
}));

// Stub a synthetic pipeline whose steps each return a different status, so we can
// assert that the timeline renders distinct node statuses for every status value.
// Partial mock so registerCatalogPipeline (used at import time by the generated barrel) stays intact.
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'StepPass', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'p', status: 'pass', tier: 'L0', detail: '' }) },
        { archetype: 'brief', label: 'StepFail', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'f', status: 'fail', tier: 'L0', detail: 'boom' }) },
        { archetype: 'gate', label: 'StepDeferred', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'd', status: 'deferred', tier: 'L3', detail: 'live-UE runner not yet run: T' }) },
        { archetype: 'brief', label: 'StepPending', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'q', status: 'pending', tier: 'L0', detail: '' }) },
      ],
    }),
  };
});

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 1, verified: 0 },
  entities: [{ id: 'fix-1', name: 'Fixture One', lifecycle: 'planned' as const, data: {} }],
  steps: ['StepPass', 'StepFail', 'StepDeferred', 'StepPending'],
};

beforeEach(() => {
  // Seed produce artifacts so resolveAccept can compute pass/fail/deferred for the first three steps.
  // StepPending has no artifact → falls into the legacy `pending` branch.
  useLabPipelineStore.setState({
    byEntity: {
      'fix-1': {
        StepPass: { done: true, data: {}, ueAssets: [], at: '2026-05-27T00:00:00Z' },
        StepFail: { done: true, data: {}, ueAssets: [], at: '2026-05-27T00:00:00Z' },
        StepDeferred: { done: true, data: {}, ueAssets: [], at: '2026-05-27T00:00:00Z' },
      },
    },
  });
});

afterEach(cleanup);

describe('Baseline timeline status indicators', () => {
  it('renders distinct data-step-status on each timeline node', () => {
    const { container } = render(
      <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />,
    );
    const statuses = Array.from(container.querySelectorAll('[data-step-status]')).map((el) => el.getAttribute('data-step-status'));
    expect(statuses).toEqual(['pass', 'fail', 'deferred', 'pending']);
  });

  it('failing node carries the pulse class so it pulls the eye', () => {
    const { container } = render(
      <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />,
    );
    const failNode = container.querySelector('[data-step-status="fail"]');
    expect(failNode?.className).toContain('animate-pulse-glow');
    // Only the failing node should pulse.
    expect(container.querySelector('[data-step-status="pass"]')?.className ?? '').not.toContain('animate-pulse-glow');
    expect(container.querySelector('[data-step-status="deferred"]')?.className ?? '').not.toContain('animate-pulse-glow');
  });

  it('aria-label conveys the status for screen readers', () => {
    const { container } = render(
      <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />,
    );
    const buttons = Array.from(container.querySelectorAll('aside button[aria-label]'));
    const labels = buttons.map((b) => b.getAttribute('aria-label'));
    // Unified status language (statusLanguage.ts) — "{step}: {word}[, tier {tier}]".
    expect(labels).toContain('StepPass: passed, tier L0');
    expect(labels).toContain('StepFail: failed, tier L0');
    expect(labels).toContain('StepDeferred: deferred, tier L3');
    expect(labels).toContain('StepPending: pending');
  });

  it('tints deferred nodes with a dashed muted border (not the failed/passing fill)', () => {
    const { container } = render(
      <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />,
    );
    const deferredNode = container.querySelector('[data-step-status="deferred"]') as HTMLElement | null;
    expect(deferredNode).toBeTruthy();
    // Border-style "dashed" is the unique cue for deferred vs solid for the others.
    expect(deferredNode!.style.borderStyle || deferredNode!.style.border).toMatch(/dashed/);
  });
});
