/**
 * `labPipelines.FINE_STEPS` is a hand-maintained step list per catalog. The manifest reads it for
 * the bespoke catalog (items) and for the no-pipeline fallback only — so an entry for a catalog
 * that HAS a registered `StepSpec` pipeline is never rendered while the registry is loaded, and
 * when it is reached (a module path that never imported the registry) it renders labels that key
 * no persisted `pipeline_artifacts` row (Rule 4b). On 2026-11-08 spellbook (16 labels), bestiary
 * (16) and currencies (14) all held such lists; not one of their labels matched the registry.
 *
 * The test is derived from the ground truth (every registered pipeline), not from the list.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { pipelineForCatalog, trackLabel } from '@/lib/pipeline/tracks';
import { labPipelineSteps } from '@/components/layout-lab/labPipelines';
import { isBespokeCatalog } from '@/components/layout-lab/catalogManifest';

describe('labPipelines holds no fine-step list a registered pipeline shadows', () => {
  it('every non-bespoke registered catalog falls through to the generic track labels', () => {
    const shadowed = allCatalogPipelines()
      .map((p) => p.catalogId)
      .filter((c) => !isBespokeCatalog(c))
      .filter((c) => JSON.stringify(labPipelineSteps(c)) !== JSON.stringify(pipelineForCatalog(c).map(trackLabel)));
    expect(shadowed).toEqual([]);
  });
});
