'use client';

import { useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Read the persisted judge verdicts for ONE step, so the lab's acceptance banner can apply
 * the same judge → acceptance bridge the headless path applies (`bridgeJudgeVerdict`).
 *
 * Until this existed, `bridgeJudgeVerdict` ran only in `headless.ts`: a current-rubric judge
 * FAIL down-graded /status and the MCP recipe while the on-screen banner still read a bare
 * checker `pass` — two truths for the same step.
 *
 * Cheap by construction: ONE `/api/judge-verdicts?catalogId=…` read per catalog, cached at
 * module scope and shared by every step of that catalog (verdicts are written by the judge
 * fleet, not by the lab, so they don't change under the user's hands). Non-throwing —
 * a failed/absent read yields `[]`, i.e. no overlay, never a fabricated verdict.
 */
const EMPTY: JudgeVerdict[] = [];
const cache = new Map<string, JudgeVerdict[]>();
const inflight = new Map<string, Promise<JudgeVerdict[]>>();

/** Test seam: drop the module cache so a test can serve fresh verdicts. */
export function clearJudgeVerdictCache(): void {
  cache.clear();
  inflight.clear();
}

function loadCatalogVerdicts(catalogId: string): Promise<JudgeVerdict[]> {
  const pending = inflight.get(catalogId);
  if (pending) return pending;
  const p = tryApiFetch<JudgeVerdict[]>(`/api/judge-verdicts?catalogId=${encodeURIComponent(catalogId)}`)
    .then((r) => {
      const rows = r.ok ? r.data : EMPTY;
      cache.set(catalogId, rows);
      inflight.delete(catalogId);
      return rows;
    });
  inflight.set(catalogId, p);
  return p;
}

export function useStepJudgeVerdicts(catalogId: string | undefined, entityId: string, step: string): JudgeVerdict[] {
  // The catalog's verdicts live in the module cache; this counter only re-renders the
  // subscriber once a fetch resolves (no setState during the effect body — the cached
  // value is read straight off the cache on the next render).
  const [loaded, setLoaded] = useState(0);
  const rows = (catalogId ? cache.get(catalogId) : undefined) ?? EMPTY;

  useEffect(() => {
    if (!catalogId || cache.has(catalogId)) return;
    let live = true;
    void loadCatalogVerdicts(catalogId).then(() => { if (live) setLoaded((n) => n + 1); });
    return () => { live = false; };
  }, [catalogId]);

  // Memoized so the acceptance memo downstream stays referentially stable between renders.
  return useMemo(
    () => rows.filter((v) => v.entityId === entityId && v.step === step),
    // `loaded` re-runs the filter when the catalog fetch resolves and swaps `rows`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, entityId, step, loaded],
  );
}
