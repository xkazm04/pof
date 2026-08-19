'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  GitBranch, ChevronRight, ChevronDown, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { useTaskDAGStore } from '@/stores/taskDAGStore';
import { MOTION } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
import { TemplateCard } from './TemplateCard';
import { ModuleSelector } from './ModuleSelector';
import { ActiveWorkflowPanel } from './ActiveWorkflowPanel';
import { ExecutionHistoryRow } from './ExecutionHistoryRow';

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

  // Terminal runs, newest first. A run interrupted by a reload is stored as `failed`
  // (see taskDAGStore.demoteInterrupted) so it lands here and is labelled as
  // interrupted by the row — rather than persisting as a `running` ghost that no
  // surface in the app ever showed.
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
                transition={{ duration: MOTION.base }}
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
            data-testid="pof-dag-history-toggle"
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
                transition={{ duration: MOTION.base }}
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
