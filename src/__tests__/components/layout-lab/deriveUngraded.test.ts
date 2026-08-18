/**
 * A checker that THROWS during derivation must degrade THAT step — never the canvas.
 *
 * `deriveEntityArtifacts` runs inside `useBaseline` BEFORE any component renders, so
 * `StepCrashBoundary` (wave 2) structurally cannot catch a throw from it: only
 * `src/app/error.tsx` can, and that replaces the whole application shell. The same function
 * is also the derivation behind `buildMatrixRows` and the global coach, so ONE bad artifact
 * used to take out the step canvas, the CatalogMatrix and the cross-catalog coach together.
 *
 * These cases FORCE the failure with a real, registry-resolved checker that throws — not a
 * mocked `resolveAccept` — and assert three things every time:
 *   1. the derivation completes (the sibling steps / entities still derive);
 *   2. the throwing step is NOT a pass (the fabricated-pass trap `null` would have re-opened);
 *   3. its reason carries the `UNGRADED:` stamp naming the thrown message (Rule 4b).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { deriveEntityArtifacts, UNGRADED_PREFIX } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import {
  buildCatalogCandidates,
  buildCatalogCandidatesFromSummary,
  deriveEntityFromSummary,
  groupSummaryByEntity,
} from '@/components/layout-lab/globalCoachModel';
import { toStepSummary } from '@/components/layout-lab/stepSummary';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const CATALOG = 'ungraded-probe';
const BOOM_MESSAGE = 'data.rows.map is not a function';

/** The kind of throw a real checker makes on an artifact another session wrote. */
const spec = (label: string, accept: StepSpec['accept']): StepSpec => ({
  archetype: 'brief',
  label,
  view: { kind: 'prose', field: 'brief', emptyText: 'Nothing yet' },
  produce: () => ({ data: {} }),
  accept,
});

// A REAL pipeline in the REAL registry, so `resolveAccept` genuinely resolves these
// checkers — the guard is proven against the production resolution path, not a stub.
registerCatalogPipeline({
  catalogId: CATALOG,
  steps: [
    spec('Boom', (data) => {
      // Exactly the shape of failure the wave-2 crash work measured: the artifact holds a
      // string where the checker assumed an array.
      (data.rows as string[]).map((r) => r);
      return { label: 'Boom', status: 'pass', tier: 'L0', detail: '' };
    }),
    spec('Fine', () => ({ label: 'Fine', status: 'pass', tier: 'L0', detail: 'ok' })),
  ],
  packagingExempt: 'test fixture — never packaged',
});

const STEPS = ['Boom', 'Fine'];
const entity = (id: string): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });
const local = (): Record<string, LabStepArtifact> => ({
  Boom: { done: true, data: { rows: 'not-an-array' }, ueAssets: [], at: '2026-08-18T10:00:00.000Z' },
  Fine: { done: true, data: { brief: 'ok' }, ueAssets: [], at: '2026-08-18T10:00:00.000Z' },
});
const srv = (entityId: string, step: string, status: PipelineArtifact['status']): PipelineArtifact => ({
  catalogId: CATALOG, entityId, step, data: { rows: 'not-an-array' }, ueAssets: [], status, tier: 'L0',
  updatedAt: '2026-08-18T10:00:00.000Z',
});

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // The guard reports the throw through `logger.error`; the throw is the point of these
  // tests, so keep the run readable without hiding anything real.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

describe('the forced failure is real', () => {
  it('resolves a genuine checker for the step, and that checker throws', () => {
    const accept = resolveAccept(CATALOG, 'Boom');
    expect(accept).toBeTypeOf('function');
    expect(() => accept!({ rows: 'not-an-array' })).toThrow(BOOM_MESSAGE);
  });
});

describe('deriveEntityArtifacts — a throwing checker degrades one step', () => {
  it('completes the derivation and still grades the sibling step', () => {
    const d = deriveEntityArtifacts(CATALOG, entity('e1'), STEPS, local(), {});
    expect(d.displayStatus('Fine', 1)).toBe('pass');
    expect(d.artifacts.map((a) => a.step)).toEqual(['Boom', 'Fine']);
  });

  it('does NOT read as a pass, and stamps the UNGRADED reason with the thrown message', () => {
    const d = deriveEntityArtifacts(CATALOG, entity('e1'), STEPS, local(), {});
    const boom = d.artifactByStep.get('Boom')!;
    expect(boom.status).not.toBe('pass');
    expect(d.displayStatus('Boom', 0)).not.toBe('pass');
    expect(boom.reason).toContain(UNGRADED_PREFIX);
    expect(boom.reason).toContain(BOOM_MESSAGE);
    // It must not read as a verdict on the content either.
    expect(boom.reason).toContain('not a verdict');
  });

  it('cannot be rescued into a pass by a server row, and is not reported as drift', () => {
    // `deferred` is the one status `serverVerdictOverlay` adopts a server verdict over — an
    // ungraded step must never take that route, or a stale server `pass` would silently
    // stand in for a grade nothing computed.
    const d = deriveEntityArtifacts(CATALOG, entity('e1'), STEPS, local(), { Boom: srv('e1', 'Boom', 'pass') });
    expect(d.artifactByStep.get('Boom')!.status).not.toBe('pass');
    // Drift means two verdicts disagree; here there is only one, so nothing is flagged.
    expect(d.driftByStep.has('Boom')).toBe(false);
  });

  it('leaves the no-checker path untouched — `null` still means "use my own status"', () => {
    // A step label with no registered checker resolves to `null`, which is NOT the throw
    // case: the caller's own status stands (pass), exactly as before.
    const steps = ['No Checker Here'];
    const d = deriveEntityArtifacts(CATALOG, entity('e1'), steps, {
      'No Checker Here': { done: true, data: {}, ueAssets: [], at: '' },
    }, {});
    expect(d.displayStatus('No Checker Here', 0)).toBe('pass');
    expect(d.artifactByStep.get('No Checker Here')!.reason).toBeUndefined();
  });
});

describe('buildMatrixRows — one bad cell does not take the matrix down', () => {
  it('renders every row, and reports the ungraded cell as a named blocker', () => {
    const rows = buildMatrixRows(CATALOG, [entity('e1'), entity('e2')], new Map(), { e1: local(), e2: local() }, STEPS);
    expect(rows.map((r) => r.id)).toEqual(['e1', 'e2']); // the map completed for BOTH entities
    for (const row of rows) {
      expect(row.statusByStep('Fine')).toBe('pass');
      expect(row.statusByStep('Boom')).not.toBe('pass');
      const blocker = row.blockers.find((b) => b.step === 'Boom');
      expect(blocker?.reason).toContain(UNGRADED_PREFIX);
    }
  });
});

describe('the global coach — both derivations survive a throwing checker', () => {
  it('artifact path: the entity still yields a candidate carrying the UNGRADED reason', () => {
    const candidates = buildCatalogCandidates({
      catalogId: CATALOG, catalogLabel: 'Probe', steps: STEPS,
      entities: [entity('e1'), entity('e2')],
      serverByEntity: new Map(), localByEntity: { e1: local(), e2: local() },
    });
    expect(candidates.map((c) => c.entityId)).toEqual(['e1', 'e2']);
    expect(candidates[0].step).toBe('Boom');
    expect(candidates[0].reason).toContain(UNGRADED_PREFIX);
  });

  it('summary (blob-free) path: same degradation, same reason', () => {
    const d = deriveEntityFromSummary(CATALOG, 'e1', STEPS, local(), undefined);
    expect(d.displayStatus('Fine', 1)).toBe('pass');
    expect(d.displayStatus('Boom', 0)).not.toBe('pass');
    expect(d.reasonForStep('Boom')).toContain(UNGRADED_PREFIX);
    expect(d.reasonForStep('Boom')).toContain(BOOM_MESSAGE);
    expect(d.driftByStep.has('Boom')).toBe(false);
  });

  it('summary path: a server row cannot turn the ungraded step into a pass either', () => {
    const summary = groupSummaryByEntity([srv('e1', 'Boom', 'pass')].map(toStepSummary));
    const candidates = buildCatalogCandidatesFromSummary({
      catalogId: CATALOG, catalogLabel: 'Probe', steps: STEPS,
      entities: [entity('e1')], summaryByEntity: summary, localByEntity: { e1: local() },
    });
    expect(candidates[0].step).toBe('Boom');
    expect(candidates[0].reason).toContain(UNGRADED_PREFIX);
  });
});
