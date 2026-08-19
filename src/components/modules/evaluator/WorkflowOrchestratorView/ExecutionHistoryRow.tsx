import { Badge } from '@/components/ui/Badge';
import type { StoredExecution } from '@/stores/taskDAGStore';
import { formatDuration } from '@/lib/format';

// ── Execution History Row ────────────────────────────────────────────────────

export function ExecutionHistoryRow({ execution }: { execution: StoredExecution }) {
  // An interrupted run is stored as `failed` (the shared status vocabulary has no
  // word for it), but it did NOT fail — the app reloaded out from under it. Label
  // what actually happened; a plain "Failed" would blame the workflow.
  const interrupted = execution.failureReason === 'reload-interrupted';

  const statusBadge = interrupted
    ? { variant: 'warning' as const, label: 'Interrupted' }
    : {
        completed: { variant: 'success' as const, label: 'Completed' },
        failed: { variant: 'error' as const, label: 'Failed' },
        cancelled: { variant: 'warning' as const, label: 'Cancelled' },
      }[execution.status as 'completed' | 'failed' | 'cancelled'] ?? {
        variant: 'default' as const,
        label: execution.status,
      };

  const startDate = new Date(execution.startedAt);
  const durationMs = execution.completedAt
    ? new Date(execution.completedAt).getTime() - startDate.getTime()
    : null;

  return (
    <div
      data-testid={`pof-dag-history-${execution.id}`}
      data-interrupted={interrupted ? 'true' : undefined}
      className="flex items-center gap-2 text-2xs"
      title={
        interrupted
          ? `Interrupted by an app reload — never resumed. ${execution.completedNodes} of ${execution.totalNodes} nodes had finished.`
          : undefined
      }
    >
      <span className="text-text font-medium truncate flex-1">{execution.workflowName}</span>
      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      {interrupted && <span className="text-text-muted/70">not resumable</span>}
      <span className="text-text-muted">
        {execution.completedNodes}/{execution.totalNodes}
      </span>
      {durationMs !== null && (
        <span className="text-text-muted/50">{formatDuration(durationMs)}</span>
      )}
    </div>
  );
}
