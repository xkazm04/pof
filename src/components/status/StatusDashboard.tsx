'use client';

/**
 * /status — the pipeline health map. One swimlane per catalog pipeline, one colored
 * cell per step, readiness derived from pipeline_artifacts truth (never hand-set):
 * proven (green) · deferred L3/L4 (amber) · attention/fail (red) · pending (blue) ·
 * unwired (dark = mocked/skipped/never run — the bottleneck color).
 */
import { useEffect, useMemo, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { buildSwimlane, sortLanes, type Swimlane } from '@/lib/status/statusModel';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, OPACITY_60 } from '@/lib/chart-colors';
import { StatusCell } from './StatusCell';

const READINESS_COLOR: Record<string, string> = {
  proven: STATUS_SUCCESS,
  deferred: STATUS_WARNING,
  attention: STATUS_ERROR,
  pending: STATUS_INFO,
};

export function StatusDashboard() {
  const [lanes, setLanes] = useState<Swimlane[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pipelines = allCatalogPipelines();
      const results = await Promise.all(
        pipelines.map(async (p) => {
          const artifacts: PipelineArtifact[] = await fetchArtifacts(p.catalogId);
          return buildSwimlane(p.catalogId, p.catalogId, p.steps.map((s) => s.label), artifacts);
        }),
      );
      if (alive) setLanes(sortLanes(results));
    })();
    return () => { alive = false; };
  }, []);

  const legend = useMemo(
    () => [
      { key: 'proven', label: 'proven (pass at its tier)' },
      { key: 'deferred', label: 'deferred (L3/L4 gate not run)' },
      { key: 'pending', label: 'pending (produced, not passing)' },
      { key: 'attention', label: 'failing' },
      { key: 'unwired', label: 'unwired (mocked / skipped / never run)' },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-5">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-lg font-semibold tracking-wide">Pipeline Status</h1>
        <a href="/layout" className="text-xs text-slate-400 hover:text-slate-200 focus-ring rounded px-1">← Blueprint</a>
      </div>
      <p className="text-xs text-slate-400 mb-4 max-w-3xl">
        One row per catalog pipeline, one cell per step — readiness derived from recorded artifacts.
        Dark cells are the bottlenecks: nothing has ever produced there.
      </p>

      <div className="flex flex-wrap gap-3 mb-5 text-xs" role="list" aria-label="legend">
        {legend.map((l) => (
          <span key={l.key} role="listitem" className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-slate-700"
              style={l.key === 'unwired' ? undefined : { background: READINESS_COLOR[l.key] + OPACITY_60 }}
              aria-hidden="true"
            />
            {l.label}
          </span>
        ))}
      </div>

      {!lanes && <div className="text-sm text-slate-400">Loading pipeline truth…</div>}

      <div className="space-y-1.5 overflow-x-auto">
        {lanes?.map((lane) => (
          <div key={lane.catalogId} className="flex items-center gap-2 min-w-max">
            <a
              href={`/layout?catalog=${lane.catalogId}`}
              className="w-44 shrink-0 text-xs text-slate-300 hover:text-white truncate focus-ring rounded px-1"
              title={`${lane.catalogId} — ${lane.provenPct}% proven, ${lane.wiredPct}% wired`}
            >
              {lane.label}
            </a>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">{lane.provenPct}%</span>
            <div className="flex gap-1">
              {lane.cells.map((cell) => (
                <StatusCell key={cell.label} cell={cell} color={READINESS_COLOR[cell.readiness]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
