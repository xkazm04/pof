'use client';

import { Loader2, Wrench } from 'lucide-react';
import { GlbPreviewPanel, GLB_PREVIEW_LABEL } from '@/components/layout-lab/steps/shared/GlbPreviewPanel';
import type { LabTheme } from '@/components/layout-lab/theme';
import { useForgeStore, type GenerationJob } from './useForgeStore';
import { meshPreview } from './forgeJobStatus';

/**
 * The remedy row under a delivered card's verdict — the answer to "is this fixable
 * locally, or do I pay again?", stated instead of left to the operator.
 *
 *   - `finish` → ONE explicit button into the existing $0 critique -> mesh-finish route,
 *     then its before -> after line and a preview of the finished low-poly.
 *   - `reroll` → a note that another generation is PAID. Deliberately no button: the only
 *     paid path stays the queue's explicit Retry, which exists on failed jobs only.
 *   - `none`   → the reason no remedy applies (floater-only, critic missing, dir).
 */
export function FinishRemedy({ job, previewTheme }: { job: GenerationJob; previewTheme: LabTheme }) {
  const finishJob = useForgeStore((s) => s.finishJob);
  const { remedy, finish } = job;
  if (!remedy) return null;

  if (remedy.kind === 'reroll') {
    return (
      <p className="mt-1 text-xs text-amber-400" data-testid="job-remedy-reroll">
        Not fixable by finishing: {remedy.note}
      </p>
    );
  }
  if (remedy.kind === 'none') {
    return (
      <p className="mt-1 text-2xs text-text-muted" data-testid="job-remedy-none">
        No local finish offered: {remedy.reason}
      </p>
    );
  }

  const running = finish?.state === 'running';
  const done = finish?.state === 'done' ? finish : null;
  const donePreview = done ? meshPreview(done.meshPath) : null;

  return (
    <div className="mt-2 space-y-1" data-testid="job-finish-row">
      <p className="text-2xs text-text-muted">
        {remedy.note}
        {remedy.unaddressed.length > 0 && ` Still failing afterwards: ${remedy.unaddressed.join(', ')}.`}
      </p>
      {!done && (
        <button
          onClick={() => void finishJob(job.id)}
          disabled={running}
          data-testid="job-finish-remedy"
          title="Local Blender retopo/decimate/bake, re-graded before -> after. No generation is paid for."
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                     border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors
                     disabled:opacity-60 disabled:cursor-wait"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
          {running ? 'Finishing in Blender…' : 'Finish in Blender — $0'}
        </button>
      )}
      {finish?.state === 'refused' && (
        <p className="text-xs text-amber-400" data-testid="job-finish-refused">Finish declined: {finish.reason}</p>
      )}
      {finish?.state === 'failed' && (
        <p className="text-xs text-red-400" data-testid="job-finish-failed">Finish failed: {finish.error}</p>
      )}
      {done && (
        <p
          className={`text-xs ${done.improved ? 'text-emerald-400' : 'text-amber-400'}`}
          data-testid="job-finish-summary"
        >
          Finished: {done.summary}
        </p>
      )}
      {donePreview?.kind === 'servable' && (
        <div data-testid="job-finish-preview">
          <p className="text-2xs text-text-muted mb-1">Finished low-poly — {GLB_PREVIEW_LABEL}</p>
          <GlbPreviewPanel t={previewTheme} url={donePreview.url} />
        </div>
      )}
      {donePreview?.kind === 'gap' && <p className="text-2xs text-text-muted">{donePreview.reason}</p>}
    </div>
  );
}
