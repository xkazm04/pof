'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  GitBranch, Play, Pause, Square, RotateCcw,
  ChevronRight, ChevronDown, CheckCircle2, XCircle,
  Clock, Loader2, SkipForward, AlertTriangle,
  Rocket, Wrench, ClipboardCheck, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { useTaskDAGStore } from '@/stores/taskDAGStore';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { WorkflowTemplate, WorkflowExecution, DAGNodeState, DAGNodeStatus } from '@/types/task-dag';
import type { SubModuleId } from '@/types/modules';

// ── Icons for templates ──────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Wrench,
  Rocket,
  Zap,
};

// ── Node status styling ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<DAGNodeStatus, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-text-muted/50', bg: 'bg-text-muted/5' },
  queued: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  running: { icon: Loader2, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  skipped: { icon: SkipForward, color: 'text-text-muted/40', bg: 'bg-text-muted/5' },
  retrying: { icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-400/10' },
};

// ── Available modules for selection ──────────────────────────────────────────

const AVAILABLE_MODULES = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

// ── Main Component ───────────────────────────────────────────────────────────

export function WorkflowOrchestratorView() {
  const templates = useTaskDAGStore((s) => s.getTemplates)();
  const activeExecution = useTaskDAGStore((s) => s.activeExecution);
  const executions = useTaskDAGStore((s) => s.executions);
  const startWorkflow = useTaskDAGStore((s) => s.startWorkflow);
  const pauseWorkflow = useTaskDAGStore((s) => s.pauseWorkflow);
  const resumeWorkflow = useTaskDAGStore((s) => s.resumeWorkflow);
  const cancelWorkflow = useTaskDAGStore((s) => s.cancelWorkflow);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleToggleModule = useCallback((moduleId: SubModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  }, []);

  const handleStart = useCallback(() => {
    if (!selectedTemplate || selectedModules.length === 0) return;
    startWorkflow(selectedTemplate, selectedModules);
    setSelectedTemplate(null);
    setSelectedModules([]);
  }, [selectedTemplate, selectedModules, startWorkflow]);

  const isActive = activeExecution && (
    activeExecution.status === 'running' || activeExecution.status === 'paused'
  );

  const pastExecutions = useMemo(
    () => executions.filter((e) =>
      e.status === 'completed' || e.status === 'failed' || e.status === 'cancelled'
    ).reverse().slice(0, 10),
    [executions],
  );

  return (
    <div className="space-y-6">
      {/* Active Workflow */}
      {isActive && activeExecution && (
        <ActiveWorkflowPanel
          execution={activeExecution}
          onPause={pauseWorkflow}
          onResume={resumeWorkflow}
          onCancel={cancelWorkflow}
        />
      )}

      {/* Template Selection (only when no active workflow) */}
      {!isActive && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-text">Workflow Templates</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                isSelected={selectedTemplate === tpl.id}
                onClick={() => setSelectedTemplate(
                  selectedTemplate === tpl.id ? null : tpl.id
                )}
              />
            ))}
          </div>

          {/* Module Selection */}
          <AnimatePresence>
            {selectedTemplate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ModuleSelector
                  selected={selectedModules}
                  onToggle={handleToggleModule}
                  onStart={handleStart}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Execution History */}
      {pastExecutions.length > 0 && (
        <SurfaceCard className="overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
          >
            {showHistory
              ? <ChevronDown className="w-4 h-4 text-text-muted" />
              : <ChevronRight className="w-4 h-4 text-text-muted" />
            }
            <Clock className="w-4 h-4 text-text-muted" />
            <span className="text-sm font-medium text-text">History</span>
            <Badge>{pastExecutions.length}</Badge>
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-4 py-3 space-y-2">
                  {pastExecutions.map((exec) => (
                    <ExecutionHistoryRow key={exec.id} execution={exec} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>
      )}
    </div>
  );
}

// ── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: WorkflowTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.icon] ?? GitBranch;

  return (
    <SurfaceCard
      interactive
      className={`p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-cyan-500/40 bg-cyan-500/5'
          : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-cyan-500/20' : 'bg-surface-deep'
        }`}>
          <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-text-muted'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{template.name}</div>
          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{template.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{template.nodes.length} steps</Badge>
            {template.estimatedMinutesPerModule && (
              <span className="text-2xs text-text-muted">
                ~{template.estimatedMinutesPerModule}min/module
              </span>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Module Selector ──────────────────────────────────────────────────────────

function ModuleSelector({
  selected,
  onToggle,
  onStart,
}: {
  selected: string[];
  onToggle: (id: SubModuleId) => void;
  onStart: () => void;
}) {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      // Deselect all
      for (const m of selected) onToggle(m as SubModuleId);
    } else {
      for (const m of AVAILABLE_MODULES) {
        if (!selected.includes(m)) onToggle(m);
      }
    }
    setSelectAll(!selectAll);
  }, [selectAll, selected, onToggle]);

  return (
    <SurfaceCard className="p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-text">Select Module(s)</span>
        <div className="flex-1" />
        <button
          onClick={handleSelectAll}
          className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {selectAll ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {AVAILABLE_MODULES.map((moduleId) => {
          const isActive = selected.includes(moduleId);
          return (
            <button
              key={moduleId}
              onClick={() => onToggle(moduleId)}
              className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                  : 'bg-surface border-border text-text-muted hover:text-text hover:border-border-bright'
              }`}
            >
              {moduleId}
            </button>
          );
        })}
      </div>

      <button
        onClick={onStart}
        disabled={selected.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-3.5 h-3.5" />
        Start Workflow ({selected.length} module{selected.length !== 1 ? 's' : ''})
      </button>
    </SurfaceCard>
  );
}

// ── Active Workflow Panel ────────────────────────────────────────────────────

function ActiveWorkflowPanel({
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
          transition={{ duration: 0.3 }}
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

// ── Execution History Row ────────────────────────────────────────────────────

function ExecutionHistoryRow({ execution }: { execution: WorkflowExecution }) {
  const statusBadge = {
    completed: { variant: 'success' as const, label: 'Completed' },
    failed: { variant: 'error' as const, label: 'Failed' },
    cancelled: { variant: 'warning' as const, label: 'Cancelled' },
  }[execution.status as 'completed' | 'failed' | 'cancelled'] ?? { variant: 'default' as const, label: execution.status };

  const startDate = new Date(execution.startedAt);
  const duration = execution.completedAt
    ? Math.round((new Date(execution.completedAt).getTime() - startDate.getTime()) / 1000)
    : null;

  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-text font-medium truncate flex-1">{execution.workflowName}</span>
      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      <span className="text-text-muted">
        {execution.completedNodes}/{execution.totalNodes}
      </span>
      {duration !== null && (
        <span className="text-text-muted/50">{formatDuration(duration)}</span>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
