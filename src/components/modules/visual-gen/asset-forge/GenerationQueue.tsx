'use client';

import { useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Clock, CheckCircle, AlertCircle, HelpCircle, Loader2, Trash2, X, Download, RotateCcw, ExternalLink } from 'lucide-react';
import { MeterBar } from '@/components/ui/MeterBar';
import { StatusTag } from '@/components/ui/StatusTag';
import { GlbPreviewPanel, GLB_PREVIEW_LABEL } from '@/components/layout-lab/steps/shared/GlbPreviewPanel';
import type { LabTheme } from '@/components/layout-lab/theme';
import { useForgeStore, type GenerationJob } from './useForgeStore';
import { jobOutcome, meshPreview, type ForgeOutcome } from './forgeJobStatus';
import { CritiqueBadge } from './CritiqueBadge';

/**
 * Card presentation per OUTCOME, not per transport status. `rejected` is the row
 * that used to be missing: a `completed` job whose delivered mesh never cleared
 * the Tier-1 gate (`accepted: false`) rendered here as a green "Complete", which
 * is the one thing the job stores were written to prevent.
 *
 * `ungated` is the THIRD delivery state, and it is deliberately neither green nor
 * red: the mesh is real and was handed over, and nothing measured it. Folding it
 * into `complete` claims a pass nobody granted; folding it into `rejected` blames
 * the mesh for a gate that never ran.
 */
const OUTCOME_CONFIG: Record<ForgeOutcome, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-400', label: 'Pending' },
  generating: { icon: Loader2, color: 'text-[var(--visual-gen)]', label: 'Generating' },
  importing: { icon: Download, color: 'text-blue-400', label: 'Importing to Blender...' },
  complete: { icon: CheckCircle, color: 'text-emerald-400', label: 'Complete' },
  ungated: { icon: HelpCircle, color: 'text-amber-400', label: 'Delivered ungated' },
  rejected: { icon: AlertCircle, color: 'text-red-400', label: 'Rejected by quality gate' },
  failed: { icon: AlertCircle, color: 'text-red-400', label: 'Failed' },
};

/**
 * The `LabTheme` the shared `GlbPreviewPanel` needs, expressed in the FORGE's own
 * tokens (it reads `fontMono` + `muted` for its served-URL caption, so the preview
 * inherits this module's surface rather than the lab's).
 *
 * Built here rather than imported from `layout-lab/theme` on purpose: that module
 * calls next/font at import time, which pulls the whole font loader into any
 * consumer — including this module's tests.
 */
const FORGE_VIEWER_THEME: LabTheme = {
  id: 'dark',
  label: 'Asset Forge',
  bg: 'var(--surface)',
  gridLine: null,
  panel: 'var(--surface)',
  ink: 'var(--text)',
  inkDeep: 'var(--text)',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  line: 'var(--border)',
  accentBg: 'var(--visual-gen)',
  glass: false,
  fontBody: '',
  fontMono: 'font-mono',
  ok: 'var(--status-success)',
  warn: 'var(--status-warning)',
  bad: 'var(--status-error)',
  onAccent: 'var(--text)',
};

function JobCard({ job, now }: { job: GenerationJob; now: number }) {
  const removeJob = useForgeStore((s) => s.removeJob);
  const retryJob = useForgeStore((s) => s.retryJob);
  const outcome = jobOutcome(job);
  const config = OUTCOME_CONFIG[outcome];
  const StatusIcon = config.icon;

  const elapsed = job.completedAt
    ? Math.round((job.completedAt - job.createdAt) / 1000)
    : Math.round((now - job.createdAt) / 1000);

  const isAnimated = outcome === 'generating' || outcome === 'importing';
  // Only a finished job has anything to preview; the path is the runner's, which
  // is not necessarily reachable through the asset route (see `meshPreview`). An
  // `ungated` delivery is a DELIVERY — the mesh exists and is as previewable as any
  // other, which is exactly why it must not read as a pass.
  const delivered = outcome === 'complete' || outcome === 'rejected' || outcome === 'ungated';
  const preview = delivered ? meshPreview(job.meshPath) : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface/50" data-outcome={outcome}>
      <div className={`mt-0.5 ${config.color}`}>
        <StatusIcon size={16} className={isAnimated ? 'animate-spin' : ''} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text truncate">
            {job.prompt || `Image-to-3D (${job.providerId})`}
          </span>
          <span className={`text-xs ${config.color}`} data-testid="job-outcome-label">{config.label}</span>
          {outcome === 'rejected' && (
            <StatusTag level="bad" word="REJECTED" iconClassName="w-2.5 h-2.5" />
          )}
          {/* Not a pass and not a rejection — a third word, because it is a third thing. */}
          {outcome === 'ungated' && (
            <StatusTag level="warn" word="UNGATED" iconClassName="w-2.5 h-2.5" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          <span>{job.mode === 'text-to-3d' ? 'Text' : 'Image'} → 3D</span>
          <span>·</span>
          <span>{job.providerId}</span>
          <span>·</span>
          <span>{elapsed}s</span>
          {typeof job.attempts === 'number' && (
            <>
              <span>·</span>
              {/* Each attempt is a paid provider generation — never silent. */}
              <span data-testid="job-attempts">
                {job.attempts} generation{job.attempts === 1 ? '' : 's'} spent
              </span>
            </>
          )}
        </div>
        {/* The gate's own words for why the delivered mesh was not accepted. */}
        {outcome === 'rejected' && (
          <p className="mt-1 text-xs text-red-400" data-testid="job-gate-reason">
            {job.gateReason ?? 'The delivered mesh did not clear the quality gate (no reason recorded).'}
          </p>
        )}
        {/* And the ungated words: what was MISSING, not what was wrong with the mesh. */}
        {outcome === 'ungated' && (
          <p className="mt-1 text-xs text-amber-400" data-testid="job-ungated-reason">
            {job.gateReason ?? 'Nothing measured this mesh — it was delivered, not passed (no reason recorded).'}
          </p>
        )}
        {/* The budget in force. Rendered verbatim from the server so a class-blind
            default is READ rather than assumed — including for a delivered job, where
            "which budget did this verdict use?" is the first question. */}
        {job.gradedAs && (
          <p className="mt-1 text-2xs text-text-muted" data-testid="job-graded-as">
            {job.gradedAs}
          </p>
        )}
        {job.formatMismatch && (
          <p className="mt-1 text-xs text-amber-400" data-testid="job-format-mismatch">
            Container mismatch: {job.formatMismatch}
          </p>
        )}
        {outcome === 'generating' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Progress</span>
              <span className="text-xs text-[var(--visual-gen)] font-medium">
                {Math.round(job.progress)}%
              </span>
            </div>
            <MeterBar
              value={job.progress}
              color="var(--visual-gen)"
              height={4}
              ariaLabel="generation progress"
              valueText={`${Math.round(job.progress)}%`}
            />
          </div>
        )}
        {outcome === 'importing' && (
          <div className="mt-2">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-xs text-blue-400 mt-1">
              Importing generated model into Blender scene...
            </p>
          </div>
        )}
        {job.critique && <CritiqueBadge critique={job.critique} fidelity={job.fidelity} />}
        {/* The mesh itself. Asset Forge is where meshes are MADE and it used to show
            a path string; the shared lab viewer renders the real thing. What the
            asset route cannot serve today says so instead of showing nothing. */}
        {preview?.kind === 'servable' && (
          <div className="mt-2" data-testid="job-mesh-preview">
            <p className="text-2xs text-text-muted mb-1">{GLB_PREVIEW_LABEL}</p>
            <GlbPreviewPanel t={FORGE_VIEWER_THEME} url={preview.url} />
          </div>
        )}
        {preview?.kind === 'gap' && (
          <p className="mt-2 text-2xs text-text-muted" data-testid="job-preview-gap">
            {preview.reason}
          </p>
        )}
        {job.renderUrl && (
          <a
            href={job.renderUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="job-render-url"
            className="mt-2 inline-flex items-center gap-1 text-2xs text-text-muted hover:text-text focus-ring rounded"
          >
            <ExternalLink size={10} />
            Provider render of this mesh
          </a>
        )}
        {job.error && (
          <p className="mt-1 text-xs text-red-400">{job.error}</p>
        )}
        {outcome === 'failed' && (
          <button
            onClick={() => retryJob(job.id)}
            className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                       border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        )}
      </div>
      <button
        onClick={() => removeJob(job.id)}
        className="text-text-muted hover:text-text transition-colors"
        title="Remove"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function GenerationQueue() {
  const jobs = useForgeStore((s) => s.jobs);
  const clearCompleted = useForgeStore((s) => s.clearCompleted);
  // Background status polls run in store actions, so they deliberately survive
  // leaving this module (a paid multi-minute generation must not be abandoned).
  // That makes them invisible unless we show them — this is that surface, plus
  // the operator's explicit stop.
  const activePolls = useForgeStore((s) => s.activePolls);
  const stopAllPolling = useForgeStore((s) => s.stopAllPolling);

  // Single shared 1s ticker for all cards' elapsed-time labels.
  // Only runs while at least one job is still in flight (no completedAt),
  // matching the previous per-card behaviour where the timer stopped on completion.
  const hasActive = jobs.some((j) => !j.completedAt);
  const [now, setNow] = useState(() => Date.now());

  // Suspendable: the labels are unreadable while the module is hidden, and `now`
  // is re-read from the clock on resume, so the elapsed values are correct again
  // immediately. (The background STATUS polls are separate and deliberately keep
  // running — see useForgeStore's poller doc block.)
  useSuspendableEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActive]);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-muted">No generation jobs yet.</p>
        <p className="text-xs text-text-muted mt-1">Use the panel above to generate 3D models.</p>
      </div>
    );
  }

  const hasCompleted = jobs.some((j) => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-text">Generation Queue ({jobs.length})</h3>
        {hasCompleted && (
          <button
            onClick={clearCompleted}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
          >
            <Trash2 size={10} />
            Clear completed
          </button>
        )}
      </div>
      {activePolls.length > 0 && (
        <div
          data-testid="forge-active-polls"
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-surface/50"
        >
          <p className="text-xs text-text-muted">
            {activePolls.length} background status {activePolls.length === 1 ? 'poll' : 'polls'} running —
            {' '}keeps tracking while you work in other modules.
          </p>
          <button
            onClick={stopAllPolling}
            data-testid="forge-stop-polls"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors focus-ring rounded"
          >
            <X size={10} />
            Stop tracking
          </button>
        </div>
      )}
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} now={now} />
        ))}
      </div>
    </div>
  );
}
