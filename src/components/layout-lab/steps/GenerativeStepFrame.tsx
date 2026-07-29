'use client';

import { useCallback } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { CandidateGallery } from './shared/CandidateGallery';
import { RawArtifactDisclosure } from './shared/RawArtifactDisclosure';
import { selectedCandidate, selectionSource, type GenCandidate, type GenHistory } from './shared/genHistory';
import { useGenerativeStep } from './shared/useGenerativeStep';
import { useStepAcceptance } from './shared/useStepAcceptance';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact, StepOutput } from '../labPipelineStore';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

/** What a generative (gallery) Items step needs to build its own panels. */
export interface GenerativeStepContext {
  art: LabStepArtifact | undefined;
  history: GenHistory;
  /** The candidate currently projected onto the step's top-level data (null when none). */
  selected: GenCandidate | null;
}

/**
 * Shared scaffold for the three generative ("gallery") Items steps — the counterpart to
 * {@link StaticStepFrame}, and the generative half of putting the bespoke reference
 * pipeline back on the fleet's shared rails.
 *
 * It owns everything those steps used to hand-roll around the shared engine:
 *  - acceptance via the SHARED {@link useStepAcceptance} (unified `buildLabCheckerContext`
 *    + server drain overlay + judge bridge). They previously called
 *    `accept(art?.data ?? {})` with NO context at all — a third grading context that could
 *    show a verdict the server had already superseded;
 *  - the honest SELECTION provenance chip (`selectionSource(history)` — auto-picked vs
 *    human-clicked), which every generic gallery step already renders;
 *  - the shared candidate-gallery panel, the Produce panel, and the RAW-ARTIFACT
 *    disclosure, appended in the same order the generic renderer uses.
 *
 * A step supplies only its bespoke preview panels (the silhouette / LOD budget / texture
 * maps), its candidate generator, and its prompt logic.
 */
export function GenerativeStepFrame({
  t, entity, step, candidates, base, defaultDirection, buildPrompt, produceLabel, produceNote,
  galleryLabel, galleryEmptyHint, galleryColumns, galleryFirst, panels,
}: {
  t: LabTheme;
  entity: LabEntity;
  step: string;
  /** Deterministic candidate generator for this step (see `shared/itemGenCandidates.ts`). */
  candidates: (direction: string, seq: number) => Omit<GenCandidate, 'id'>[];
  /** Static output merged under every generated batch (e.g. the step's UE asset path). */
  base?: StepOutput;
  defaultDirection: string;
  buildPrompt: (direction: string) => string;
  produceLabel: string;
  produceNote: string;
  galleryLabel?: string;
  galleryEmptyHint: string;
  galleryColumns?: number;
  /** Render the gallery BEFORE the step's own preview panels (Icon 2D's existing order). */
  galleryFirst?: boolean;
  /** The step's bespoke preview panels. */
  panels: (ctx: GenerativeStepContext) => StepPanel[];
}) {
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, candidates, base);
  const accept = useCallback(
    (data: Record<string, unknown>, ctx: CheckerContext) => ITEM_STEP_SPECS[step].accept(data, ctx),
    [step],
  );
  const acceptance = useStepAcceptance({ catalogId: 'items', entityId: entity.id, step, art, accept });
  const run = (dir?: string, prompt?: string) => generate(dir ?? defaultDirection, prompt ?? buildPrompt(dir ?? defaultDirection));

  const galleryPanel: StepPanel = {
    label: galleryLabel ?? 'Candidate gallery (kept across re-rolls)',
    node: (
      <CandidateGallery t={t} history={history} onSelect={reselect} columns={galleryColumns}
        emptyHint={galleryEmptyHint} />
    ),
  };
  const ownPanels = panels({ art, history, selected: selectedCandidate(history) });

  return (
    <StepFrame t={t} acceptance={acceptance} catalogId="items" step={step}
      selection={selectionSource(history)}
      onFix={(fixDir) => run(fixDir)}
      panels={[
        ...(galleryFirst ? [galleryPanel, ...ownPanels] : [...ownPanels, galleryPanel]),
        { label: 'Produce', node: (
          <CliProduce t={t} label={produceLabel} rows={3}
            defaultDirection={defaultDirection} note={produceNote} buildPrompt={buildPrompt}
            onComplete={(ctx) => run(ctx?.direction, ctx?.prompt)} />
        ) },
        { label: 'Raw artifact', node: (
          <RawArtifactDisclosure t={t} data={art?.data ?? {}} ueAssets={art?.ueAssets} verdict={art} />
        ) },
      ]} />
  );
}
