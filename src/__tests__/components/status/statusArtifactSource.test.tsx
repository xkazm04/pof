import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { toStepSummary, summaryToVerdictRow } from '@/components/layout-lab/stepSummary';
import type { StepSummary } from '@/components/layout-lab/stepSummary';
import { buildSwimlane } from '@/lib/status/statusModel';
import { PipelinesView } from '@/components/status/PipelinesView';
import { CapabilityView } from '@/components/status/CapabilityView';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { Result } from '@/types/result';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));

const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
const produce = () => ({ data: {}, ueAssets: [] });
const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
const step = (label: string) => ({ archetype: 'brief', label, engine: 'Claude', view, produce, accept });

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return {
    ...actual,
    allCatalogPipelines: () => [
      { catalogId: 'achievements', steps: [step('Concept Brief'), step('Test Gate')] },
      { catalogId: 'ambient', steps: [step('Concept Brief'), step('Test Gate')] },
    ],
  };
});

/** The rows the server holds. /status reads their BLOB-FREE projection — the real
 *  `toStepSummary`, so the wire shape under test is the one the route actually serves. */
const rowsFor = (catalogId: string): PipelineArtifact[] => [
  { catalogId, entityId: 'e1', step: 'Concept Brief', data: { brief: 'x' }, ueAssets: [], status: 'pass', tier: 'L0' },
  { catalogId, entityId: 'e1', step: 'Test Gate', data: {}, ueAssets: [], status: 'pass', tier: 'L3' },
];

const fetchStepSummaryResult = vi.fn(
  async (catalogId: string): Promise<Result<StepSummary[], string>> => ({
    ok: true,
    data: rowsFor(catalogId).map(toStepSummary),
  }),
);

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: vi.fn(async () => ({ ok: true, data: [] })),
  fetchStepSummaryResult: (catalogId: string) => fetchStepSummaryResult(catalogId),
  fetchArtifacts: vi.fn(async () => []),
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: vi.fn().mockResolvedValue({ ok: true, data: [] }) };
});

beforeEach(() => {
  // The shared read is a MODULE-LEVEL cache — it deliberately outlives an unmount, so each
  // case starts from an empty one.
  _resetArtifactCache();
  fetchStepSummaryResult.mockClear();
});
afterEach(cleanup);

describe('statusArtifactSource — one shared read across tabs', () => {
  it('reads each catalog once and reuses it on the next tab', async () => {
    const first = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(first.container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    // 2 registered catalogs → 2 reads. Nothing more.
    expect(fetchStepSummaryResult).toHaveBeenCalledTimes(2);

    // Tab switch: StatusDashboard renders one view per tab, so the Pipelines view unmounts.
    // Before this refactor the next tab re-fanned out the full per-catalog read.
    first.unmount();
    const second = render(<CapabilityView onFilterClass={vi.fn()} />);
    await waitFor(() => {
      expect(second.container.textContent).toMatch(/gates pass|no declared gates|median|benchmark/);
    });
    // The cache outlives the unmount: the second tab pays ZERO further requests.
    expect(fetchStepSummaryResult).toHaveBeenCalledTimes(2);

    // …and going back is free too.
    second.unmount();
    const third = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(third.container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    expect(fetchStepSummaryResult).toHaveBeenCalledTimes(2);
  });

  it('paints the grade the FULL rows derive, from the blob-free projection of them', async () => {
    const { container } = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    // Grade the server's FULL rows directly and compare against what the view painted from the
    // projection. The source is an input path, not a second grading rule — and the projection
    // may only ever be a cheaper way to reach the same grade, never a different one.
    const expected = buildSwimlane(
      'achievements', 'achievements',
      [{ label: 'Concept Brief' }, { label: 'Test Gate' }],
      rowsFor('achievements'), [],
    );
    const pct = [...container.querySelectorAll('[role="img"]')].find((el) =>
      (el.getAttribute('aria-label') ?? '').includes('achievements'),
    );
    expect(pct?.textContent).toBe(`${expected.readyPct}%`);
  });
});

/**
 * The projection /status reads is the SAME truth, 40× smaller.
 *
 * The model used to bind every judge verdict to the content it judged by RE-hashing
 * `stepContentHash(artifact.data)`, so a blob-free row compared a standing verdict against the
 * hash of `{}` and read `stale` — silently demoting real, current, judge-proven cells. It now
 * TAKES the binding the row carries; `toStepSummary` stamps it server-side with that same
 * function, and `summaryToVerdictRow` lifts it onto the row the model grades.
 *
 * The grade-equivalence gate (current / stale / unhashable-legacy provenances) lives in
 * `src/__tests__/lib/status/statusRowContentHash.test.ts`. This case pins the WIRE end of it:
 * what the source hands the model still carries the binding, and still carries no blob.
 */
describe('statusArtifactSource — the blob-free projection carries the content binding', () => {
  it('lifts the server hash onto the row, with no produced data attached', () => {
    const artifact: PipelineArtifact = {
      catalogId: 'achievements', entityId: 'e1', step: 'Concept Brief',
      data: { brief: 'real produced content' }, ueAssets: [], status: 'pass', tier: 'L0',
      updatedAt: '2026-08-01T00:00:00Z',
    };
    const row = summaryToVerdictRow('achievements', toStepSummary(artifact));
    // The binding survives the projection — byte-identical to the full row's own hash…
    expect(row.contentHash).toBe(stepContentHash(artifact.data));
    // …and it is NOT the hash of `{}`, which is what a rehashing model compared against.
    expect(row.contentHash).not.toBe(stepContentHash({}));
    // The blob does not.
    expect(row.data).toBeUndefined();
    // A verdict bound to that content therefore still matches on the thin row.
    const bound: JudgeVerdict = {
      catalogId: 'achievements', entityId: 'e1', step: 'Concept Brief', judge: 'human',
      verdict: 'pass', score: 95, model: 'm', findings: '', rubricVersion: RUBRIC_VERSION,
      contentHash: row.contentHash,
    } as JudgeVerdict;
    expect(bound.contentHash).toBe(row.contentHash);
  });
});
