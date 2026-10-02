'use client';

import { useCallback, useMemo } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { RawArtifactDisclosure } from './shared/RawArtifactDisclosure';
import { useStepAcceptance } from './shared/useStepAcceptance';
import { withItemFixCopy } from './shared/itemFixCopy';
import { useStaticStep } from './useStaticStep';
import { noopFixSuggestion } from './ArchetypeStep';
import { itemsBespokeStepSpec } from '../itemsBespokeSpecs';
import { TEMPLATE_MARKER } from '@/lib/catalog/acceptance/markers';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact } from '../labPipelineStore';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { ProduceDispatch } from './shared/useStepProduceDoor';

/** What a static step needs to build its panels: the persisted artifact and the
 *  shared produce dispatch (used as both `onComplete` and the banner `onFix`). */
export interface StaticStepContext {
  art: LabStepArtifact | undefined;
  /** Pass straight to `CliProduce.onComplete` — the typed direction reaches produce. */
  runProduce: ProduceDispatch;
  /** Pass to `CliProduce.liveEligible`: true only for a text step a CLI session can author. */
  liveEligible: boolean;
  /** Live mode is on for this step — the next click runs a real session (display only). */
  live: boolean;
  /** The shared produce prompt — the one a live dispatch sends; use it as `buildPrompt`. */
  stepPrompt: (direction: string) => string;
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
  const { art, runProduce, liveEligible, live, stepPrompt } = useStaticStep(entity, step);
  const accept = useCallback(
    (data: Record<string, unknown>, ctx: CheckerContext) => ITEM_STEP_SPECS[step].accept(data, ctx),
    [step],
  );
  const judged = useStepAcceptance({ catalogId: 'items', entityId: entity.id, step, art, accept });
  // Remediation copy is merged onto the RESOLVED verdict — the position the generic
  // renderer uses (`withGenericFixCopy` over `judged`). `withCopy` inside `accept` returns
  // early on `pass`, so a server-drain or judge down-grade used to land a bare FAIL with no
  // `why` — and StepFrame nests "⚡ Produce fix" inside `{acceptance.why && …}`, so the step
  // silently lost its one-click remediation exactly when it needed it. Display only.
  //
  // A TEMPLATE hold is not a checker shortfall: the step-authored copy ("Only 4 clip(s) present")
  // would misdescribe it, so the reason-bearing generic copy is used, and — the stub being
  // data-blind and direction-blind — no fix is offered; the banner says what WOULD move it.
  const held = typeof judged.reason === 'string' && judged.reason.startsWith(TEMPLATE_MARKER);
  const acceptance = useMemo(
    () => {
      const base = held ? { ...judged, why: undefined, suggestion: undefined, fixDirection: undefined } : judged;
      const copied = withItemFixCopy(step, art?.data ?? {}, base);
      if (!held) return copied;
      const spec = itemsBespokeStepSpec(step) ?? ({ archetype: 'custom', label: step } as StepSpec);
      return { ...copied, suggestion: noopFixSuggestion(spec, copied.fixDirection) };
    },
    [step, art, judged, held],
  );

  // onFix carries a corrective DIRECTION STRING, not a produce ctx — drop it rather than
  // letting it land in the ctx slot (it would stamp a prompt that was never built).
  // `deferred` gets no fix affordance at all (the generic contract): a runtime/visual gate
  // is proved by the drain, not by re-producing from this panel.
  return (
    <StepFrame t={t} acceptance={acceptance}
      onFix={acceptance.status === 'deferred' || held ? undefined : () => { void runProduce(); }}
      catalogId="items" step={step}
      panels={[
        ...panels({ art, runProduce, liveEligible, live, stepPrompt }),
        { label: 'Raw artifact', node: (
          <RawArtifactDisclosure t={t} data={art?.data ?? {}} ueAssets={art?.ueAssets} verdict={art} />
        ) },
      ]} />
  );
}
