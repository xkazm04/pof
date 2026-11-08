'use client';

import { useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { CheckCircle, AlertCircle, Loader2, X, Trash2 } from 'lucide-react';
import { SUCCESS_TEXT, ERROR_TEXT } from '@/lib/blender-mcp/status-tokens';
import { useBlenderStore, SCRIPT_HISTORY_CAP, type ScriptJob, type ScriptStatus } from './useBlenderStore';

const STATUS_CONFIG: Record<ScriptStatus, { icon: typeof Loader2; color: string; label: string }> = {
  idle: { icon: Loader2, color: 'text-text-muted', label: 'Idle' },
  running: { icon: Loader2, color: 'text-[var(--visual-gen)]', label: 'Running' },
  completed: { icon: CheckCircle, color: SUCCESS_TEXT, label: 'Done' },
  failed: { icon: AlertCircle, color: ERROR_TEXT, label: 'Failed' },
};

function ScriptCard({ job }: { job: ScriptJob }) {
  const removeScript = useBlenderStore((s) => s.removeScript);
  const config = STATUS_CONFIG[job.status];
  const StatusIcon = config.icon;
  const [now, setNow] = useState(() => Date.now());

  // Suspendable: elapsed label only; `now` is re-read on resume so the value is
  // correct again immediately.
  useSuspendableEffect(() => {
    if (job.completedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [job.completedAt]);

  const elapsed = job.completedAt
    ? ((job.completedAt - job.startedAt) / 1000).toFixed(1)
    : ((now - job.startedAt) / 1000).toFixed(0);

  return (
    <div className="rounded-lg border border-border bg-surface/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <StatusIcon
          size={14}
          className={`${config.color} ${job.status === 'running' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-text flex-1">{job.scriptName}</span>
        <span className={`text-xs ${config.color}`}>{config.label}</span>
        <span className="text-xs text-text-muted">{elapsed}s</span>
        <button
          type="button"
          onClick={() => removeScript(job.id)}
          aria-label={`Remove ${job.scriptName} from the list`}
          className="focus-ring rounded text-text-muted hover:text-text"
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
      {job.output && (
        <pre className="px-3 py-2 text-xs font-mono text-text-muted max-h-32 overflow-y-auto whitespace-pre-wrap">
          {job.output}
        </pre>
      )}
      {job.error && (
        <div className={`px-3 py-2 text-xs ${ERROR_TEXT}`}>{job.error}</div>
      )}
    </div>
  );
}

/** The dispatcher lives in `@/lib/blender-mcp/dispatch`; re-exported for compatibility. */
export { executeViaMCP } from '@/lib/blender-mcp/dispatch';

export function ScriptRunner() {
  const scripts = useBlenderStore((s) => s.scripts);
  const clearCompleted = useBlenderStore((s) => s.clearCompleted);
  const droppedCount = useBlenderStore((s) => s.droppedCount);

  if (scripts.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-text-muted">
          No scripts have been dispatched from this session yet.
        </p>
        <p className="text-xs text-text-muted mt-1">
          This lists scripts PoF sent through the Blender MCP dispatcher, in this
          browser session only — it is not a log of everything that ran in Blender.
        </p>
      </div>
    );
  }

  const hasCompleted = scripts.some((s) => s.status === 'completed' || s.status === 'failed');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-text">
          Dispatched scripts ({scripts.length})
        </h3>
        {hasCompleted && (
          <button
            type="button"
            onClick={clearCompleted}
            className="focus-ring rounded flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <Trash2 size={10} aria-hidden="true" />
            Clear finished
          </button>
        )}
      </div>
      {droppedCount > 0 && (
        <p className="text-xs text-text-muted" data-testid="script-history-dropped">
          {droppedCount} older {droppedCount === 1 ? 'script was' : 'scripts were'} dropped (history keeps the newest {SCRIPT_HISTORY_CAP}).
        </p>
      )}
      <div className="space-y-2">
        {scripts.map((job) => (
          <ScriptCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
