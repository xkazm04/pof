import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { entityStepList, resolveStepJump, toLabEntity } from '@/components/layout-lab/entityPipeline';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * scan-sweep --challenge catalog-browser-ui/A — one per-entity step list. A lab surface that
 * names a step by position must use the position in the list the rail renders for THAT entity.
 */
const lab = (id: string, canonProfile: string): LabEntity => ({ id, name: id, lifecycle: 'planned', data: {}, canonProfile });

describe('entityStepList — the entity\'s own steps, pipeline order', () => {
  it('drops the pof-only dialog steps for a diablo1 entity and keeps pipeline order', () => {
    const all = resolveCatalogSteps('dialog-trees');
    const own = entityStepList('dialog-trees', { canonProfile: 'diablo1' });
    expect(own).toEqual(all.filter((s) => s !== 'Skill Checks' && s !== 'Camera'));
    expect(own).toHaveLength(all.length - 2);
  });

  it('[guard] a pof entity has exactly the catalog list', () => {
    expect(entityStepList('dialog-trees', { canonProfile: 'pof' })).toEqual(resolveCatalogSteps('dialog-trees'));
  });
});

describe('toLabEntity — the single lab constructor keeps the canon profile', () => {
  it('carries provenance.canonProfile onto the LabEntity', () => {
    const e = toLabEntity({
      id: 'd1-dialog-X', name: 'X', lifecycle: 'planned',
      provenance: {
        kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'p', sourceFile: 'f', sourceRow: 'X',
        licenceNote: 'n', ingestedAt: '2026-01-01', canonProfile: 'diablo1',
      },
    });
    expect(e.canonProfile).toBe('diablo1');
    expect(e.reference).toEqual({ sourceGame: 'Diablo I (1996)', sourceFile: 'f', sourceRow: 'X' });
  });

  it('an authored entity is the project\'s own profile', () => {
    expect(toLabEntity({ id: 'a', name: 'A', lifecycle: 'planned' }).canonProfile).toBe('pof');
  });
});

describe('resolveStepJump — a label resolved against the target entity\'s own list', () => {
  it('prefers the open entity and returns ITS index', () => {
    const d1 = lab('d1', 'diablo1');
    expect(resolveStepJump('dialog-trees', 'Test Gate', [lab('p', 'pof'), d1], 'd1')).toEqual({ entityId: 'd1', stepIndex: 8 });
  });

  it('falls through to the first entity whose pipeline has the step', () => {
    const jump = resolveStepJump('dialog-trees', 'Skill Checks', [lab('d1', 'diablo1'), lab('p', 'pof')], 'd1');
    expect(jump).toEqual({ entityId: 'p', stepIndex: resolveCatalogSteps('dialog-trees').indexOf('Skill Checks') });
  });

  it('null when no entity has the step', () => {
    expect(resolveStepJump('dialog-trees', 'Camera', [lab('d1', 'diablo1')], null)).toBeNull();
  });
});
