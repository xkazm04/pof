'use client';

import { Clock, CheckCircle, AlertCircle, Loader2, Trash2, X, Download } from 'lucide-react';
import { useForgeStore, type GenerationJob, type JobStatus } from './useForgeStore';

const STATUS_CONFIG: Record<JobStatus, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-400', label: 'Pending' },
  generating: { icon: Loader2, color: 'text-[var(--visual-gen)]', label: 'Generating' },
  importing: { icon: Download, color: 'text-blue-400', label: 'Importing to Blender...' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Complete' },
  failed: { icon: AlertCircle, color: 'text-red-400', label: 'Failed' },
};

function JobCard({ job }: { job: GenerationJob }) {
  const removeJob = useForgeStore((s) => s.removeJob);
  const config = STATUS_CONFIG[job.status];
  const StatusIcon = config.icon;

  const elapsed = job.completedAt
    ? Math.round((job.completedAt - job.createdAt) / 1000)
    : Math.round((Date.now() - job.createdAt) / 1000);

  const isAnimated = job.status === 'generating' || job.status === 'importing';

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface/50">
      <div className={`mt-0.5 ${config.color}`}>
        <StatusIcon size={16} className={isAnimated ? 'animate-spin' : ''} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text truncate">
            {job.prompt || `Image-to-3D (${job.providerId})`}
          </span>
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          <span>{job.mode === 'text-to-3d' ? 'Text' : 'Image'} → 3D</span>
          <span>·</span>
          <span>{job.providerId}</span>
          <span>·</span>
          <span>{elapsed}s</span>
        </div>
        {job.status === 'generating' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Progress</span>
              <span className="text-xs text-[var(--visual-gen)] font-medium">
                {Math.round(job.progress)}%
              </span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--visual-gen)] rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}
        {job.status === 'importing' && (
          <div className="mt-2">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-xs text-blue-400 mt-1">
              Importing generated model into Blender scene...
            </p>
          </div>
        )}
        {job.error && (
          <p className="mt-1 text-xs text-red-400">{job.error}</p>
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
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
