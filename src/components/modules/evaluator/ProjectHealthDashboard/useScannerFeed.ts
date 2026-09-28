'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { projectIdOf } from '@/stores/deepEvalStore';
import { scansToReports, regressionAlertsFromScans } from '@/lib/evaluator/scan-report';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import type { EvaluatorReport } from '@/types/evaluator';
import type { RegressionAlert } from './types';

/** How many persisted scans the Scanner dashboard projects. */
export const SCANNER_HISTORY_LIMIT = 10;

const NO_SCANS: PersistedScan[] = [];

/** One settled load, tagged with the request it answers (project + attempt). */
type Settled =
  | { key: string; ok: true; scans: PersistedScan[] }
  | { key: string; ok: false; error: string };

export interface ScannerFeed {
  loading: boolean;
  /** Load failure — distinct from "no scans yet". */
  error: string | null;
  /** Reports oldest -> newest. */
  reports: EvaluatorReport[];
  latest: EvaluatorReport | null;
  alerts: RegressionAlert[];
  /** The newest scan's findings by id (Fix looks a recommendation's finding up here). */
  findingsById: ReadonlyMap<string, EvalFinding>;
  retry: () => void;
}

/**
 * The Scanner dashboard's data source: the durable deep-eval history for the open
 * project (`GET /api/evaluator/results?limit=&project=`), projected by
 * `scansToReports`. Deep Eval writes it; this only reads.
 */
export function useScannerFeed(): ScannerFeed {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectId = projectIdOf(projectPath);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = `${projectId}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    const url = `/api/evaluator/results?limit=${SCANNER_HISTORY_LIMIT}&project=${encodeURIComponent(projectId)}`;
    void (async () => {
      const res = await tryApiFetch<{ scans: PersistedScan[] }>(url);
      if (cancelled) return;
      setSettled(res.ok ? { key, ok: true, scans: res.data.scans ?? NO_SCANS } : { key, ok: false, error: res.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // A load answering an older request (previous project / attempt) is not this
  // view's data: until the current request settles, the feed is loading.
  const current = settled?.key === key ? settled : null;
  const scans = current?.ok ? current.scans : NO_SCANS;

  const derived = useMemo(() => {
    const reports = scansToReports(scans);
    const newest = scans[0];
    return {
      reports,
      latest: reports[reports.length - 1] ?? null,
      alerts: regressionAlertsFromScans(scans),
      findingsById: new Map((newest?.findings ?? []).map((f) => [f.id, f])),
    };
  }, [scans]);

  return {
    loading: current === null,
    error: current && !current.ok ? current.error : null,
    ...derived,
    retry,
  };
}
