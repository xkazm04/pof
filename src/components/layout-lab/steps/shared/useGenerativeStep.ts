'use client';

import { useMemo } from 'react';
import { useLabStep, useLabPipelineStore } from '../../labPipelineStore';
import { readHistory, makeBatch, appendBatch, selectCandidate, historyData, nextSeq } from './genHistory';
import type { GenCandidate, GenHistory } from './genHistory';
import type { LabStepArtifact, StepOutput } from '../../labPipelineStore';

type RawCandidate = Omit<GenCandidate, 'id'>;

/**
 * The ONE browse→compare→select generative engine, shared by the generic
 * `ArchetypeStep` gallery view and the bespoke Items generators (`ItemArt`).
 * Both used to hand-roll the same generate/reselect closures against `produceFrom`
 * with two copies of the batch-append logic — this hook is the single source.
 *
 * Contract (unchanged behavior):
 *  - `generate(direction, prompt)` appends a *kept* batch and auto-selects its first
 *    candidate. It builds from the step's LIVE persisted data inside `produceFrom`
 *    (not this render's closure), so two dispatches in one frame serialize instead of
 *    clobbering a batch; `nextSeq` keeps batch ids unique across pruning.
 *  - `reselect(candidateId)` projects an older candidate's payload back to top-level.
 *  - `base` is the step's non-history StepOutput (its `ueAssets` / `links` / static
 *    `data`); it is spread on every write and its `data` seeds `historyData` so the
 *    selected candidate's payload overrides the static fields. Pass it MEMOIZED (e.g.
 *    `useMemo(() => spec.produce(entity), …)`) so the derivation doesn't re-allocate
 *    every render.
 *
 * `history` is memoized on the artifact's `data` reference (like StaticStepFrame's
 * acceptance memo), so `readHistory` doesn't re-parse on every render.
 */
export function useGenerativeStep(
  entityId: string,
  step: string,
  candidates: (direction: string, seq: number) => RawCandidate[],
  base?: StepOutput,
): {
  art: LabStepArtifact | undefined;
  history: GenHistory;
  generate: (direction: string, prompt: string) => void;
  reselect: (candidateId: string) => void;
} {
  const art = useLabStep(entityId, step);
  const produceFrom = useLabPipelineStore((s) => s.produceFrom);
  const history = useMemo(() => readHistory(art?.data), [art?.data]);

  const generate = (direction: string, prompt: string) => {
    produceFrom(entityId, step, (prevData) => {
      const live = readHistory(prevData);
      const seq = nextSeq(live);
      const batch = makeBatch({ seq, at: new Date().toISOString(), direction, prompt, candidates: candidates(direction, seq) });
      return { ...(base ?? {}), data: historyData(appendBatch(live, batch), base?.data) };
    });
  };

  const reselect = (candidateId: string) => {
    produceFrom(entityId, step, (prevData) => ({
      ...(base ?? {}),
      data: historyData(selectCandidate(readHistory(prevData), candidateId), base?.data),
    }));
  };

  return { art, history, generate, reselect };
}
