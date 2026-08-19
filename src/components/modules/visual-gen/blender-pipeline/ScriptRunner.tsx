'use client';

import { useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { CheckCircle, AlertCircle, Loader2, X, Trash2 } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { useBlenderStore, type ScriptJob, type ScriptStatus } from './useBlenderStore';

const STATUS_CONFIG: Record<ScriptStatus, { icon: typeof Loader2; color: string; label: string }> = {
  idle: { icon: Loader2, color: 'text-text-muted', label: 'Idle' },
  running: { icon: Loader2, color: 'text-[var(--visual-gen)]', label: 'Running' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Done' },
  failed: { icon: AlertCircle, color: 'text-red-400', label: 'Failed' },
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
        />
        <span className="text-xs font-medium text-text flex-1">{job.scriptName}</span>
        <span className="text-xs text-text-muted">{elapsed}s</span>
        <button onClick={() => removeScript(job.id)} className="text-text-muted hover:text-text">
          <X size={12} />
        </button>
      </div>
      {job.output && (
        <pre className="px-3 py-2 text-xs font-mono text-text-muted max-h-32 overflow-y-auto whitespace-pre-wrap">
          {job.output}
        </pre>
      )}
      {job.error && (
        <div className="px-3 py-2 text-xs text-red-400">{job.error}</div>
      )}
    </div>
  );
}

/**
 * THE dispatcher for `/api/blender-mcp/execute`.
 *
 * Every Python script PoF sends to Blender must go through here, because this
 * is also what records it in the Script History panel — the panel presented to
 * the user as the record of what PoF ran in their Blender. Call sites that
 * fetched the route directly were invisible there (the panel would still say
 * "No scripts have been run yet" after a real dispatch), and several of them
 * discarded the `Result` entirely, so a failed script and a successful one were
 * indistinguishable on screen.
 *
 * `src/__tests__/lib/blender-mcp/execute-dispatch-guard.test.ts` enforces this:
 * a NEW raw fetch of the execute route fails the build.
 */
export async function executeViaMCP(scriptName: string, scriptCode: string) {
  const { addScript, updateScript } = useBlenderStore.getState();
  const jobId = addScript(scriptName, []);

  const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: scriptCode }),
  });

  if (result.ok) {
    updateScript(jobId, {
      status: 'completed',
      output: result.data.output,
      completedAt: Date.now(),
    });
  } else {
    updateScript(jobId, {
      status: 'failed',
      error: result.error,
      completedAt: Date.now(),
    });
  }

  return result;
}

export function ScriptRunner() {
  const scripts = useBlenderStore((s) => s.scripts);
  const clearCompleted = useBlenderStore((s) => s.clearCompleted);

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
            onClick={clearCompleted}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <Trash2 size={10} />
            Clear finished
          </button>
        )}
      </div>
      <div className="space-y-2">
        {scripts.map((job) => (
          <ScriptCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
