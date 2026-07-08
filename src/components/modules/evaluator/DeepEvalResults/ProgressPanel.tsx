import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { EVAL_PASSES, PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { EvalProgress } from '@/lib/evaluator/deep-eval-engine';
import type { EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { SubModuleId } from '@/types/modules';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { EVAL_ACCENT, PASS_STATUS_ICONS } from './constants';

// ─── Progress Panel ──────────────────────────────────────────────────────────

export function ProgressPanel({ progress }: { progress: EvalProgress }) {
  const pct = progress.totalSteps > 0
    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-lg p-4"
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: STATUS_WARNING }} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text">
              {progress.currentModule
                ? `Evaluating ${MODULE_LABELS[progress.currentModule] ?? progress.currentModule} — ${PASS_LABELS[progress.currentPass!] ?? progress.currentPass}`
                : 'Starting...'}
            </span>
            <span className="text-xs text-text-muted">
              {progress.completedSteps}/{progress.totalSteps} passes ({pct}%)
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: EVAL_ACCENT }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: MOTION.base }}
            />
          </div>
        </div>
      </div>

      {/* Per-module pass status grid */}
      <div className="grid grid-cols-6 gap-1.5 text-2xs">
        {/* Header row */}
        <span className="text-text-muted font-semibold">Module</span>
        {EVAL_PASSES.map((pass) => (
          <span key={pass} className="text-text-muted font-semibold text-center">
            {PASS_LABELS[pass]}
          </span>
        ))}
        <span />
        <span />

        {/* Module rows */}
        {Object.entries(progress.passStatuses).map(([moduleId, passes]) => (
          <ModuleProgressRow key={moduleId} moduleId={moduleId as SubModuleId} passes={passes} />
        ))}
      </div>

      {/* Live finding count */}
      {progress.findings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {progress.findings.length} findings so far
          </span>
        </div>
      )}
    </motion.div>
  );
}

function ModuleProgressRow({
  moduleId,
  passes,
}: {
  moduleId: SubModuleId;
  passes: Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>;
}) {
  return (
    <>
      <span className="text-text-muted truncate">
        {MODULE_LABELS[moduleId] ?? moduleId}
      </span>
      {EVAL_PASSES.map((pass) => (
        <span key={pass} className="flex items-center justify-center">
          {PASS_STATUS_ICONS[passes[pass] ?? 'pending']}
        </span>
      ))}
      <span />
      <span />
    </>
  );
}
