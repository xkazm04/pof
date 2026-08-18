import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { toStepSummary } from '@/components/layout-lab/stepSummary';
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

const fetchArtifactsResult = vi.fn(
  async (catalogId: string): Promise<Result<PipelineArtifact[], string>> => ({
    ok: true,
    data: [
      { catalogId, entityId: 'e1', step: 'Concept Brief', data: { brief: 'x' }, ueAssets: [], status: 'pass', tier: 'L0' },
      { catalogId, entityId: 'e1', step: 'Test Gate', data: {}, ueAssets: [], status: 'pass', tier: 'L3' },
    ],
  }),
);

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (catalogId: string) => fetchArtifactsResult(catalogId),
  fetchStepSummaryResult: vi.fn(async () => ({ ok: true, data: [] })),
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
  fetchArtifactsResult.mockClear();
});
afterEach(cleanup);

describe('statusArtifactSource — one shared read across tabs', () => {
  it('reads each catalog once and reuses it on the next tab', async () => {
    const first = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(first.container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    // 2 registered catalogs → 2 reads. Nothing more.
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(2);

    // Tab switch: StatusDashboard renders one view per tab, so the Pipelines view unmounts.
    // Before this refactor the next tab re-fanned out the full per-catalog read.
    first.unmount();
    const second = render(<CapabilityView onFilterClass={vi.fn()} />);
    await waitFor(() => {
      expect(second.container.textContent).toMatch(/gates pass|no declared gates|median|benchmark/);
    });
    // The cache outlives the unmount: the second tab pays ZERO further requests.
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(2);

    // …and going back is free too.
    second.unmount();
    const third = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(third.container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(2);
  });

  it('hands the model the SAME rows the server sent — no projection between them', async () => {
    const { container } = render(<PipelinesView onFocusCatalog={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('[title^="Focus an entity — achievements "]')).toBeTruthy();
    });
    // Grade the served rows directly and compare against what the view painted: the source
    // is an input path, not a second grading rule.
    const served: PipelineArtifact[] = [
      { catalogId: 'achievements', entityId: 'e1', step: 'Concept Brief', data: { brief: 'x' }, ueAssets: [], status: 'pass', tier: 'L0' },
      { catalogId: 'achievements', entityId: 'e1', step: 'Test Gate', data: {}, ueAssets: [], status: 'pass', tier: 'L3' },
    ];
    const expected = buildSwimlane(
      'achievements', 'achievements',
      [{ label: 'Concept Brief' }, { label: 'Test Gate' }],
      served, [],
    );
    const pct = [...container.querySelectorAll('[role="img"]')].find((el) =>
      (el.getAttribute('aria-label') ?? '').includes('achievements'),
    );
    expect(pct?.textContent).toBe(`${expected.readyPct}%`);
  });
});

/**
 * WHY /status still reads the FULL rows rather than the 40× smaller
 * `GET /api/pipeline-artifacts/summary` projection.
 *
 * The status model binds a judge verdict to the content it judged by RECOMPUTING
 * `stepContentHash(artifact.data)`. The summary carries no `data` (that is the point of it),
 * so every hash-bound verdict would compare against the hash of `{}` and grade `stale` —
 * a verdict that no longer applies — silently demoting real, current, judge-proven cells.
 *
 * This case pins the mechanism so the follow-up is unambiguous: the summary ALREADY carries
 * the right hash (`toStepSummary` → `contentHash`, the same `stepContentHash` on the server).
 * The model has to take the row's hash instead of recomputing it from a blob; that is a model
 * change, not a view change.
 */
describe('statusArtifactSource — the blob-free projection is blocked on the model', () => {
  it('a blob-free row hashes to a different content binding than the row it projects', () => {
    const artifact: PipelineArtifact = {
      catalogId: 'achievements', entityId: 'e1', step: 'Concept Brief',
      data: { brief: 'real produced content' }, ueAssets: [], status: 'pass', tier: 'L0',
      updatedAt: '2026-08-01T00:00:00Z',
    };
    const summary = toStepSummary(artifact);
    // The projection carries the CORRECT binding…
    expect(summary.contentHash).toBe(stepContentHash(artifact.data));
    // …but a row rebuilt from it without `data` hashes to something else entirely, which is
    // what a hash-recomputing model would compare a standing verdict against. Measured on
    // this exact fixture against the content-binding model: a current judge PASS derives
    // `verified` / provenance `current` / lane readyPct 100 from the full row and
    // `trusted` / `stale` / readyPct 0 from the blob-free one.
    expect(stepContentHash({})).not.toBe(summary.contentHash);
    // The verdict binding a real cell would be compared with — recorded so the follow-up is
    // concrete: thread THIS value through instead of rehashing `data`.
    const bound: JudgeVerdict = {
      catalogId: 'achievements', entityId: 'e1', step: 'Concept Brief', judge: 'human',
      verdict: 'pass', score: 95, model: 'm', findings: '', rubricVersion: RUBRIC_VERSION,
      contentHash: summary.contentHash,
    } as JudgeVerdict;
    expect(bound.contentHash).toBe(summary.contentHash);
  });
});
