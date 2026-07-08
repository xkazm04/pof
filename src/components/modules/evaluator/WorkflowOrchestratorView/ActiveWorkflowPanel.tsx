import {
  GitBranch, Play, Pause, Square,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowExecution, DAGNodeState } from '@/types/task-dag';
import { MOTION } from '@/lib/constants';
import { STATUS_STYLE } from './constants';

// ── Active Workflow Panel ────────────────────────────────────────────────────

export function ActiveWorkflowPanel({
  execution,
  onPause,
  onResume,
  onCancel,
}: {
  execution: WorkflowExecution;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const progress = execution.totalNodes > 0
    ? Math.round(((execution.completedNodes + execution.failedNodes) / execution.totalNodes) * 100)
    : 0;

  return (
    <SurfaceCard className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <GitBranch className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{execution.workflowName}</div>
          <div className="text-2xs text-text-muted">{execution.currentStepLabel}</div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {execution.status === 'running' && (
            <button
              onClick={onPause}
              className="p-1.5 rounded-lg border border-border text-text-muted hover:text-amber-400 hover:border-amber-400/30 transition-colors"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {execution.status === 'paused' && (
            <button
              onClick={onResume}
              className="p-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
            title="Cancel"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-deep rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-cyan-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: MOTION.slow }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-2xs text-text-muted mb-3">
        <span>{execution.completedNodes}/{execution.totalNodes} completed</span>
        {execution.failedNodes > 0 && (
          <span className="text-red-400">{execution.failedNodes} failed</span>
        )}
        {execution.runningNodeIds.length > 0 && (
          <span className="text-cyan-400">{execution.runningNodeIds.length} running</span>
        )}
        {execution.status === 'paused' && (
          <Badge variant="warning">Paused</Badge>
        )}
      </div>

      {/* Node list */}
      <div className="space-y-1">
        {Object.values(execution.nodeStates).map((nodeState) => (
          <NodeRow key={nodeState.nodeId} state={nodeState} />
        ))}
      </div>
    </SurfaceCard>
  );
}

// ── Node Row ─────────────────────────────────────────────────────────────────

function NodeRow({ state }: { state: DAGNodeState }) {
  const style = STATUS_STYLE[state.status];
  const Icon = style.icon;
  const isAnimating = state.status === 'running' || state.status === 'retrying';

  // Extract readable label from nodeId (format: "moduleId::label-N")
  const parts = state.nodeId.split('::');
  const moduleId = parts.length > 1 ? parts[0] : '';
  const rawLabel = parts.length > 1 ? parts[1] : state.nodeId;
  const label = rawLabel
    .replace(/-\d+$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${style.bg}`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${style.color} ${isAnimating ? 'animate-spin' : ''}`} />
      <span className="text-2xs font-medium text-text truncate">{label}</span>
      {moduleId && (
        <span className="text-2xs text-text-muted/50 truncate">{moduleId}</span>
      )}
      <div className="flex-1" />
      {state.retryCount > 0 && (
        <span className="text-2xs text-amber-400/70">retry {state.retryCount}</span>
      )}
      {state.status === 'completed' && state.success && (
        <CheckCircle2 className="w-3 h-3 text-green-400" />
      )}
      {state.status === 'failed' && (
        <XCircle className="w-3 h-3 text-red-400" />
      )}
    </div>
  );
}
