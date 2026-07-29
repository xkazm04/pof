'use client';

import { useCallback } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { RawArtifactDisclosure } from './shared/RawArtifactDisclosure';
import { useStepAcceptance } from './shared/useStepAcceptance';
import { useStaticStep } from './useStaticStep';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

/** What a static step needs to build its panels: the persisted artifact and the
 *  shared produce dispatch (used as both `onComplete` and the banner `onFix`). */
export interface StaticStepContext {
  art: LabStepArtifact | undefined;
  /** Pass straight to `CliProduce.onComplete` — the typed direction reaches produce. */
  runProduce: (ctx?: { direction: string; prompt: string }) => void;
}

/**
 * Thin shared scaffold for every non-generative ("static") Items step.
 *
 * It lifts the byte-identical prologue that each step body used to copy-paste —
 * `const { art, runProduce } = useStaticStep(entity, step);` followed by
 * `<StepFrame t={t} acceptance={…} onFix={runProduce} panels={...} />` — into one
 * place. A step now supplies only its `panels`, derived from the `{ art, runProduce }`
 * context.
 *
 * Acceptance is derived by the SHARED {@link useStepAcceptance} — the same hook the
 * generic `ArchetypeStep` uses. That is what puts the reference pipeline back on the
 * fleet's ONE truth: the unified `buildLabCheckerContext` (real siblings + a LIVE `has`,
 * replacing the `has: () => false` this component used to hand-roll — the documented
 * anti-pattern that drags every satisfied cross-catalog link to `deferred`), plus the
 * server drain overlay and the judge bridge. A drained L3/L4 gate or a matching-class
 * judge FAIL now reaches a bespoke banner exactly as it reaches a generic one.
 *
 * Every static step also gets the fleet's RAW-ARTIFACT disclosure appended to its panel
 * grid, so what the step actually stored is inspectable here too.
 */
export function StaticStepFrame({ t, entity, step, panels }: {
  t: LabTheme;
  entity: LabEntity;
  step: string;
  /** Build the step's panels from the shared static-step context. */
  panels: (ctx: StaticStepContext) => StepPanel[];
}) {
  const { art, runProduce } = useStaticStep(entity, step);
  const accept = useCallback(
    (data: Record<string, unknown>, ctx: CheckerContext) => ITEM_STEP_SPECS[step].accept(data, ctx),
    [step],
  );
  const acceptance = useStepAcceptance({ catalogId: 'items', entityId: entity.id, step, art, accept });

  // onFix carries a corrective DIRECTION STRING, not a produce ctx — drop it rather than
  // letting it land in the ctx slot (it would stamp a prompt that was never built).
  return (
    <StepFrame t={t} acceptance={acceptance} onFix={() => runProduce()} catalogId="items" step={step}
      panels={[
        ...panels({ art, runProduce }),
        { label: 'Raw artifact', node: (
          <RawArtifactDisclosure t={t} data={art?.data ?? {}} ueAssets={art?.ueAssets} verdict={art} />
        ) },
      ]} />
  );
}
