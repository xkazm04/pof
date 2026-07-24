import { useMemo, useState } from 'react';
import {
  GitBranch, Play, Pause, Square,
  CheckCircle2, XCircle, ChevronRight, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowExecution, DAGNodeState } from '@/types/task-dag';
import { MOTION } from '@/lib/constants';
import { STATUS_STYLE } from './constants';

// ── Node label helpers (nodeId format: "moduleId::label-N") ──────────────────

function splitNodeId(nodeId: string): { moduleId: string; rawLabel: string } {
  const parts = nodeId.split('::');
  return parts.length > 1
    ? { moduleId: parts[0], rawLabel: parts[1] }
    : { moduleId: '', rawLabel: nodeId };
}

function humanizeLabel(rawLabel: string): string {
  return rawLabel
    .replace(/-\d+$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Module grouping ──────────────────────────────────────────────────────────

interface ModuleGroup {
  moduleId: string;
  nodes: DAGNodeState[];
  total: number;
  done: number; // completed + skipped + failed (terminal)
  failed: number;
  running: number;
  allFinished: boolean;
}

function groupByModule(nodeStates: Record<string, DAGNodeState>): ModuleGroup[] {
  const map = new Map<string, DAGNodeState[]>();
  for (const state of Object.values(nodeStates)) {
    const { moduleId } = splitNodeId(state.nodeId);
    const key = moduleId || '(ungrouped)';
    const list = map.get(key);
    if (list) list.push(state);
    else map.set(key, [state]);
  }
  return Array.from(map, ([moduleId, nodes]) => {
    const failed = nodes.filter((n) => n.status === 'failed').length;
    const running = nodes.filter(
      (n) => n.status === 'running' || n.status === 'retrying',
    ).length;
    const done = nodes.filter(
      (n) => n.status === 'completed' || n.status === 'skipped' || n.status === 'failed',
    ).length;
    return {
      moduleId,
      nodes,
      total: nodes.length,
      done,
      failed,
      running,
      allFinished: done === nodes.length,
    };
  });
}

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

  const groups = useMemo(
    () => groupByModule(execution.nodeStates),
    [execution.nodeStates],
  );
  const isMultiModule = groups.length > 1;

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

      {/* Node list — grouped by module when more than one is involved */}
      {isMultiModule ? (
        <div className="space-y-1.5">
          {groups.map((group) => (
            <ModuleGroupSection key={group.moduleId} group={group} />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {(groups[0]?.nodes ?? []).map((nodeState) => (
            <NodeRow key={nodeState.nodeId} state={nodeState} showModule={false} />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

// ── Module Group Section (collapsible; auto-collapses when finished) ──────────

function ModuleGroupSection({ group }: { group: ModuleGroup }) {
  // Default open while there's active work; collapse once every node is terminal.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? !group.allFinished;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-surface-deep/40 hover:bg-surface-hover/40 transition-colors"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        }
        <span className="text-2xs font-semibold text-text truncate">{group.moduleId}</span>
        <div className="flex-1" />
        {group.running > 0 && (
          <span className="text-2xs text-cyan-400">{group.running} running</span>
        )}
        {group.failed > 0 && (
          <span className="text-2xs text-red-400">{group.failed} failed</span>
        )}
        <span className="text-2xs text-text-muted tabular-nums">
          {group.done}/{group.total}
        </span>
        {group.allFinished && group.failed === 0 && (
          <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="p-1 space-y-1">
              {group.nodes.map((nodeState) => (
                <NodeRow key={nodeState.nodeId} state={nodeState} showModule={false} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Node Row ─────────────────────────────────────────────────────────────────

function NodeRow({ state, showModule = true }: { state: DAGNodeState; showModule?: boolean }) {
  const style = STATUS_STYLE[state.status];
  const Icon = style.icon;
  const isAnimating = state.status === 'running' || state.status === 'retrying';

  const { moduleId, rawLabel } = splitNodeId(state.nodeId);
  const label = humanizeLabel(rawLabel);

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${style.bg}`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${style.color} ${isAnimating ? 'animate-spin' : ''}`} />
      <span className="text-2xs font-medium text-text truncate">{label}</span>
      {showModule && moduleId && (
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
