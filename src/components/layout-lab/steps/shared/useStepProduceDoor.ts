'use client';

import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import {
  isCliEligible, isLiveProduceEnabled, describeProduceOutcome, type OneShotStepResult, type ProduceOutcome,
} from '@/components/layout-lab/labProduceMode';
import { apiFetch } from '@/lib/api-utils';
import { withProduceDirection } from '@/lib/catalog/produceDirection';
import { stampTemplate } from '@/lib/catalog/produceTemplate';
import type { StepEvidence } from './stepEvidence';
import type { LibraryAsset } from '@/types/asset-library';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/** What `CliProduce.onComplete` hands a dispatch: the typed direction + the built prompt. */
export interface ProduceCtx {
  direction: string;
  prompt: string;
}

/**
 * A step's produce dispatch. The STUB path returns nothing and writes synchronously inside the
 * call (the Rule 5 walker and `act(() => runProduce())` rely on it); the LIVE path returns a
 * promise of the server's verdict. A throw / rejection means the dispatch itself failed.
 */
export type ProduceDispatch = (pctx?: ProduceCtx) => void | Promise<ProduceOutcome | void>;

export interface StepProduceDoorArgs {
  /** No catalog id (an inline, unregistered spec) → never live, never stamped. */
  catalogId?: string;
  spec: Pick<StepSpec, 'archetype' | 'produce'>;
  entity: LabEntity;
  step: string;
  /** Real artifacts the panel cites (only the panel knows what is on screen). */
  evidence?: readonly StepEvidence[];
  /** Asset-library picks for this produce (session state, never artifact data). */
  library?: readonly LibraryAsset[];
}

/**
 * THE ONE PRODUCE DOOR for a non-gallery step — lifted out of `ArchetypeStep` so the bespoke Items
 * steps (`useStaticStep`) go through the same door as the ~330 generic steps.
 *
 *  - LIVE (opt-in, `isLiveProduceEnabled()` read at click time) AND a text archetype a CLI session
 *    can author (`isCliEligible`): `POST /api/one-shot/step` with `mode: 'cli'`. The client sends
 *    INPUTS (direction, evidence, library picks), never a prompt — the server rebuilds it from the
 *    same `buildStepProducePrompt`. The store adopts what the SERVER persisted either way, and the
 *    server's verdict is returned (`describeProduceOutcome`), so a graded fail never reads
 *    `✓ Recorded`.
 *  - Otherwise the STUB: `spec.produce(entity, direction)`, the direction stamped on the artifact,
 *    and `stampTemplate` — a data-blind body written for a non-exemplar entity carries
 *    `data.template`, which the template guard holds at `pending` instead of `pass`.
 */
export function useStepProduceDoor({ catalogId, spec, entity, step, evidence, library }: StepProduceDoorArgs): ProduceDispatch {
  const produce = useLabPipelineStore((s) => s.produce);
  return (pctx) => {
    const dir = pctx?.direction ?? '';
    if (catalogId && isCliEligible(spec.archetype) && isLiveProduceEnabled()) {
      return (async () => {
        const res = await apiFetch<OneShotStepResult>('/api/one-shot/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalogId, entityId: entity.id, stepLabel: step, mode: 'cli', direction: dir,
            proposal: { name: entity.name, data: entity.data },
            evidence: evidence ?? [], library: library ?? [],
          }),
        });
        produce(entity.id, step, { data: res.artifactData ?? {}, ueAssets: res.ueAssets ?? [] });
        return describeProduceOutcome(res);
      })();
    }
    produce(entity.id, step, stampTemplate(catalogId, spec, entity, withProduceDirection(spec.produce(entity, dir), pctx), dir));
  };
}
