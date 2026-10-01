'use client';

/**
 * THE whole-project judge-verdict read for /status — the verdict twin of
 * `statusArtifactSource`, shared by every tab that grades with verdicts (Pipelines,
 * Capability, Category, Item Focus).
 *
 * ── What it replaces ──────────────────────────────────────────────────────────
 * Each of those four tabs issued its own `GET /api/judge-verdicts` on mount, each with a
 * different failure rule: Pipelines showed a PARTIAL banner, Capability refused to grade,
 * and Category + Item Focus folded a failed read into `[]` and graded on — which drops a
 * condemning judge FAIL and lifts the cell from blocked to R3 reached, greener than the truth.
 *
 * ── What it does instead ─────────────────────────────────────────────────────
 * It is a thin SUBSCRIPTION to the lab's verdict store (`useStepJudgeVerdicts.ts`:
 * stale-while-revalidate on a 60 s TTL, `invalidateJudgeVerdicts`, one in-flight request per
 * key) — not a second cache and not a second state machine. A verdict written after first load
 * reaches a MOUNTED tab once the TTL lapses (the next render revalidates) or the moment any
 * surface invalidates the store. Its read keeps its `Result`: when the latest read failed the
 * view gets `{ ok: false, error }` — never a cached `[]`, and never stale rows passed off as
 * current — and each view keeps its own copy for saying so. While a revalidation runs, the
 * held read stays on screen marked `stale`, never a loading flash.
 */

import { useMemo } from 'react';
import {
  invalidateJudgeVerdicts,
  useAllJudgeVerdictState,
} from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/** One settled whole-project verdict read. `ok: false` means UNKNOWN — never "no verdicts". */
export type StatusVerdictRead =
  | { ok: true; all: JudgeVerdict[]; byCatalog: ReadonlyMap<string, JudgeVerdict[]>; stale?: boolean }
  | { ok: false; error: string };

export interface StatusVerdictSource {
  /** `null` until the first read settles. */
  verdicts: StatusVerdictRead | null;
  /** Operator-driven re-read: invalidates the shared store, which revalidates every reader. */
  reload: () => void;
}

function groupByCatalog(all: JudgeVerdict[]): ReadonlyMap<string, JudgeVerdict[]> {
  // Grouped here rather than via `globalCoachModel.groupVerdictsByCatalog`, whose module pulls
  // the lab's whole derivation graph into /status for a six-line loop.
  const byCatalog = new Map<string, JudgeVerdict[]>();
  for (const v of all) {
    const list = byCatalog.get(v.catalogId);
    if (list) list.push(v);
    else byCatalog.set(v.catalogId, [v]);
  }
  return byCatalog;
}

const reload = () => invalidateJudgeVerdicts();

export function useStatusVerdicts(): StatusVerdictSource {
  const { rows, loaded, stale, error } = useAllJudgeVerdictState();
  // Keyed on the rows REFERENCE: a revalidation that brought no news keeps the grouping, so
  // nothing downstream re-derives.
  const byCatalog = useMemo(() => groupByCatalog(rows), [rows]);
  return useMemo(() => {
    let verdicts: StatusVerdictRead | null = null;
    if (error !== undefined) verdicts = { ok: false, error };
    else if (loaded) verdicts = { ok: true, all: rows, byCatalog, stale };
    return { verdicts, reload };
  }, [rows, byCatalog, loaded, stale, error]);
}
