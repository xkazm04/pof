import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

// The step's checker is the REAL linksResolve, so the verdict depends on ctx.has — the live entity index.
vi.mock('@/components/layout-lab/labAcceptance', async () => {
  const { linksResolve } = await import('@/lib/catalog/acceptance/linkCheckers');
  return { resolveAccept: (_c: string, step: string) => linksResolve(step) };
});

import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { buildCatalogCandidates, buildCatalogCandidatesFromSummary } from '@/components/layout-lab/globalCoachModel';

afterEach(cleanup);

const CATALOG = 'c';
const STEP = 'S';
const entity: LabEntity = { id: 'e1', name: 'E1', lifecycle: 'planned', data: {} };
const local: LabStepArtifact = {
  done: true, ueAssets: [], at: '',
  data: { links: [{ catalogId: 'bestiary', entityId: 'goblin' }] },
};
const INDEX = { bestiary: { goblin: {} } };

describe('one CheckerContext truth across rail, matrix and coach (local-only produce, link target exists)', () => {
  it('rail: the live index resolves the link', () => {
    const d = deriveEntityArtifacts(CATALOG, entity, [STEP], { [STEP]: local }, {}, INDEX);
    expect(d.displayStatus(STEP, 0)).toBe('pass');
  });

  it('matrix cell agrees with the rail when given the index', () => {
    const rows = buildMatrixRows(CATALOG, [entity], new Map(), { e1: { [STEP]: local } }, [STEP], [], INDEX);
    expect(rows[0].statusByStep(STEP)).toBe('pass');
  });

  it('coach (artifact path) raises no deferred candidate when the index resolves the link', () => {
    const cin = { catalogId: CATALOG, catalogLabel: 'C', steps: [STEP], entities: [entity], serverByEntity: new Map(), localByEntity: { e1: { [STEP]: local } } };
    expect(buildCatalogCandidates({ ...cin, entitiesByCatalog: INDEX })).toEqual([]);
    expect(buildCatalogCandidates(cin)[0]?.priority).toBe('deferred'); // ctx-free callers keep the old reading
  });

  it('coach (summary path) agrees too', () => {
    const cin = { catalogId: CATALOG, catalogLabel: 'C', steps: [STEP], entities: [entity], summaryByEntity: new Map(), localByEntity: { e1: { [STEP]: local } } };
    expect(buildCatalogCandidatesFromSummary({ ...cin, entitiesByCatalog: INDEX })).toEqual([]);
  });
});
