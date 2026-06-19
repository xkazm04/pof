'use client';

import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { fetchHistory, fetchRun } from './client';
import type { ExperimentRunSummary, ExperimentRunDetail } from '@/lib/ue-experiment/experiment-db';

/** History list + A-B compare for past experiment runs. Re-fetches when refreshKey changes. */
export function ExperimentHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([]);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [a, setA] = useState<ExperimentRunDetail | null>(null);
  const [b, setB] = useState<ExperimentRunDetail | null>(null);

  useEffect(() => {
    fetchHistory().then(setRuns).catch((e) => logger.error('history fetch failed', e));
  }, [refreshKey]);

  // Fetch detail when a slot is assigned (never clears state synchronously — the
  // compare render guards on id match, so a deselected/changed slot just stops matching).
  useEffect(() => { if (aId) fetchRun(aId).then(setA).catch(() => undefined); }, [aId]);
  useEffect(() => { if (bId) fetchRun(bId).then(setB).catch(() => undefined); }, [bId]);

  const pick = useCallback((slot: 'a' | 'b', id: string) => {
    (slot === 'a' ? setAId : setBId)((cur) => (cur === id ? null : id));
  }, []);

  const showCompare = a && b && a.id === aId && b.id === bId;

  if (runs.length === 0) return <p className="text-2xs text-text-muted">No past runs yet — run an experiment to start the history.</p>;

  return (
    <section className="space-y-3" aria-label="experiment history">
      <h2 className="text-sm font-semibold">History &amp; compare</h2>
      <div className="max-h-56 space-y-1 overflow-auto">
        {runs.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded bg-surface p-2 text-xs">
            <span className={r.ok ? 'text-emerald-500' : 'text-red-500'}>{r.ok ? '✓' : '✗'}</span>
            <span className="rounded bg-background px-1 text-2xs text-text-muted">{r.mode}</span>
            <span className="flex-1 truncate font-mono" title={r.label}>{r.label}</span>
            <span className="text-2xs text-text-muted">{Math.round(r.durationMs / 1000)}s</span>
            <button type="button" onClick={() => pick('a', r.id)} className={`rounded px-1.5 ${aId === r.id ? 'bg-emerald-600 text-white' : 'bg-background text-text-muted'}`} aria-label={`compare ${r.id} as A`}>A</button>
            <button type="button" onClick={() => pick('b', r.id)} className={`rounded px-1.5 ${bId === r.id ? 'bg-emerald-600 text-white' : 'bg-background text-text-muted'}`} aria-label={`compare ${r.id} as B`}>B</button>
          </div>
        ))}
      </div>

      {showCompare && (
        <div className="grid grid-cols-2 gap-3" aria-label="compare">
          <CompareColumn run={a} slot="A" />
          <CompareColumn run={b} slot="B" />
        </div>
      )}
    </section>
  );
}

function CompareColumn({ run, slot }: { run: ExperimentRunDetail; slot: string }) {
  const s = run.observationSummary;
  return (
    <div className="space-y-2 rounded border border-border p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="rounded bg-surface px-1.5 py-0.5 font-semibold">{slot}</span>
        <span className={run.ok ? 'text-emerald-500' : 'text-red-500'}>{run.ok ? '✓ ran' : '✗ failed'}</span>
        <span className="text-text-muted">{Math.round(run.durationMs / 1000)}s</span>
      </div>
      <div className="truncate font-mono text-2xs text-text-muted" title={run.label}>{run.label}</div>
      {run.behavioralVerdict && (
        <div className={run.behavioralVerdict.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}>behavior: {run.behavioralVerdict.status} — {run.behavioralVerdict.detail}</div>
      )}
      {run.verdict && (
        <div className={run.verdict.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}>visual: {run.verdict.status}</div>
      )}
      {s && (
        <div className="text-2xs text-text-muted">samples {s.sampleCount} · maxSpeed {s.maxSpeed.toFixed(0)} · disp {s.displacement.toFixed(0)} · montage {s.montagePlayed ? 'yes' : 'no'}</div>
      )}
      {Object.keys(run.markers).length > 0 && (
        <pre className="overflow-x-auto rounded bg-surface p-1.5 font-mono text-2xs">{Object.entries(run.markers).map(([k, v]) => `${k}=${v}`).join('\n')}</pre>
      )}
      {run.hasScreenshot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/experiment/screenshot/${run.id}`} alt={`run ${slot} frame`} className="max-w-full rounded border border-border" />
      )}
    </div>
  );
}
