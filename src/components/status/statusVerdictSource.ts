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
 * It is a thin hook over the lab's EXISTING verdict cache (`useStepJudgeVerdicts.ts`:
 * 60 s TTL, `invalidateJudgeVerdicts`, one in-flight request per key) — not a second cache.
 * Its read keeps its `Result`: a failure reaches the view as `{ ok: false, error }`, and each
 * view keeps its own copy for saying so. A failed read is never cached, so the next mount or
 * `reload` asks the server again; a verdict written after first load reaches the next read
 * once the TTL expires or a judge write invalidates the cache.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  invalidateJudgeVerdicts,
  peekAllJudgeVerdicts,
  readAllJudgeVerdicts,
} from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/** One settled whole-project verdict read. `ok: false` means UNKNOWN — never "no verdicts". */
export type StatusVerdictRead =
  | { ok: true; all: JudgeVerdict[]; byCatalog: ReadonlyMap<string, JudgeVerdict[]> }
  | { ok: false; error: string };

export interface StatusVerdictSource {
  /** `null` until the read settles. */
  verdicts: StatusVerdictRead | null;
  /** Operator-driven re-read: drops the shared cache and asks the server again. */
  reload: () => void;
}

function settled(all: JudgeVerdict[]): StatusVerdictRead {
  // Grouped here rather than via `globalCoachModel.groupVerdictsByCatalog`, whose module pulls
  // the lab's whole derivation graph into /status for a six-line loop.
  const byCatalog = new Map<string, JudgeVerdict[]>();
  for (const v of all) {
    const list = byCatalog.get(v.catalogId);
    if (list) list.push(v);
    else byCatalog.set(v.catalogId, [v]);
  }
  return { ok: true, all, byCatalog };
}

/** Warm start: a remount inside the TTL renders from the cache with no loading flash. */
function initial(): StatusVerdictRead | null {
  const rows = peekAllJudgeVerdicts();
  return rows ? settled(rows) : null;
}

export function useStatusVerdicts(): StatusVerdictSource {
  const [verdicts, setVerdicts] = useState<StatusVerdictRead | null>(initial);
  /** Bumped by `reload` to re-run the read. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void readAllJudgeVerdicts().then((r) => {
      if (!alive) return;
      // A warm-cache answer is the very list already held: keep the reference so nothing
      // downstream re-derives for a read that brought no news.
      setVerdicts((prev) => {
        if (!r.ok) return { ok: false, error: r.error };
        return prev?.ok && prev.all === r.data ? prev : settled(r.data);
      });
    });
    return () => { alive = false; };
  }, [attempt]);

  return useMemo(
    () => ({
      verdicts,
      reload: () => {
        invalidateJudgeVerdicts();
        setVerdicts(null);
        setAttempt((n) => n + 1);
      },
    }),
    [verdicts],
  );
}
