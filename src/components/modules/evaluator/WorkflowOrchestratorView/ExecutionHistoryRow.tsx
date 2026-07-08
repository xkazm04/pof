import { Badge } from '@/components/ui/Badge';
import type { WorkflowExecution } from '@/types/task-dag';
import { formatDuration } from '@/lib/format';

// ── Execution History Row ────────────────────────────────────────────────────

export function ExecutionHistoryRow({ execution }: { execution: WorkflowExecution }) {
  const statusBadge = {
    completed: { variant: 'success' as const, label: 'Completed' },
    failed: { variant: 'error' as const, label: 'Failed' },
    cancelled: { variant: 'warning' as const, label: 'Cancelled' },
  }[execution.status as 'completed' | 'failed' | 'cancelled'] ?? { variant: 'default' as const, label: execution.status };

  const startDate = new Date(execution.startedAt);
  const durationMs = execution.completedAt
    ? new Date(execution.completedAt).getTime() - startDate.getTime()
    : null;

  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-text font-medium truncate flex-1">{execution.workflowName}</span>
      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      <span className="text-text-muted">
        {execution.completedNodes}/{execution.totalNodes}
      </span>
      {durationMs !== null && (
        <span className="text-text-muted/50">{formatDuration(durationMs)}</span>
      )}
    </div>
  );
}
