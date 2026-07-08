import { useState, useCallback } from 'react';
import {
  Zap, CheckCircle2, Sparkles, ArrowDown, ArrowUp,
  ShieldCheck, FileCode2, Loader2, Wand2, Shuffle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { PromptOptimizationResult } from '@/types/prompt-evolution';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import { MODULE_COLORS, ACCENT_EMERALD_DARK } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { ACCENT } from './constants';
import { EmptyState } from './EmptyState';

// ── Optimizer Panel ──────────────────────────────────────────────────────────

const DIFF_TYPE_CONFIG: Record<string, { icon: typeof Wand2; color: string; label: string }> = {
  'add-context': { icon: ShieldCheck, color: MODULE_COLORS.core, label: 'Context' },
  'restructure': { icon: Shuffle, color: MODULE_COLORS.systems, label: 'Restructure' },
  'add-verification': { icon: CheckCircle2, color: ACCENT_EMERALD_DARK, label: 'Verification' },
  'shorten': { icon: ArrowUp, color: MODULE_COLORS.content, label: 'Shorten' },
  'lengthen': { icon: ArrowDown, color: MODULE_COLORS.content, label: 'Lengthen' },
  'imperative-rewrite': { icon: Zap, color: MODULE_COLORS.evaluator, label: 'Imperative' },
};

export function OptimizerPanel({
  selectedModuleId,
  lastOptimization,
  isOptimizing,
  onOptimize,
}: {
  selectedModuleId: string | null;
  lastOptimization: PromptOptimizationResult | null;
  isOptimizing: boolean;
  onOptimize: (moduleId: SubModuleId, prompt: string) => Promise<PromptOptimizationResult | null>;
}) {
  const [inputPrompt, setInputPrompt] = useState('');

  const handleOptimize = useCallback(async () => {
    if (!selectedModuleId || !inputPrompt.trim()) return;
    await onOptimize(selectedModuleId as SubModuleId, inputPrompt.trim());
  }, [selectedModuleId, inputPrompt, onOptimize]);

  return (
    <div className="space-y-5">
      {/* Input section */}
      <SurfaceCard level={2} className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-xs font-semibold text-text">Prompt Optimizer</h3>
          <span className="text-xs text-text-muted">Paste a prompt to auto-optimize based on session history</span>
        </div>

        <textarea
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Paste your CLI prompt here to see how the optimizer would improve it..."
          rows={6}
          className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-text placeholder:text-text-muted resize-none font-mono leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleOptimize}
            disabled={!selectedModuleId || !inputPrompt.trim() || isOptimizing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            {isOptimizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {isOptimizing ? 'Optimizing...' : 'Optimize Prompt'}
          </button>
          {!selectedModuleId && (
            <span className="text-xs text-text-muted">Select a module first</span>
          )}
        </div>
      </SurfaceCard>

      {/* Results section */}
      <AnimatePresence mode="wait">
        {lastOptimization && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/50">
              {lastOptimization.wasModified ? (
                <>
                  <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text">
                      {lastOptimization.diffs.length} optimization{lastOptimization.diffs.length !== 1 ? 's' : ''} applied
                    </p>
                    <p className="text-xs text-text-muted">
                      Based on {lastOptimization.sampleSize} historical sessions
                      {lastOptimization.predictedImprovement > 0 && (
                        <> — predicted +{Math.round(lastOptimization.predictedImprovement * 100)}% success rate</>
                      )}
                    </p>
                  </div>
                  <ProgressRing
                    value={Math.min(Math.round(lastOptimization.predictedImprovement * 200), 100)}
                    size={36}
                    strokeWidth={3}
                    color={ACCENT}
                    label={`+${Math.round(lastOptimization.predictedImprovement * 100)}%`}
                  />
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-text-muted" />
                  <p className="text-xs text-text-muted">
                    No optimizations needed — your prompt already follows best practices
                    {lastOptimization.sampleSize > 0 && ` (based on ${lastOptimization.sampleSize} sessions)`}
                  </p>
                </>
              )}
            </div>

            {/* Diffs breakdown */}
            {lastOptimization.diffs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-text flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  Changes Applied
                </h4>
                {lastOptimization.diffs.map((diff, i) => {
                  const config = DIFF_TYPE_CONFIG[diff.type] ?? { icon: Wand2, color: ACCENT, label: diff.type };
                  const DiffIcon = config.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <SurfaceCard level={2} className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${config.color}15`, color: config.color }}
                          >
                            <DiffIcon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-text">{diff.description}</span>
                              <span
                                className="px-1.5 py-0.5 text-[11px] font-medium rounded"
                                style={{ backgroundColor: `${config.color}15`, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed">{diff.reason}</p>
                          </div>
                        </div>
                      </SurfaceCard>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Before / After — real word-level diff (unified / split toggle) */}
            {lastOptimization.wasModified && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-text flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  Before / After
                  <span className="text-xs text-text-muted font-normal">
                    {lastOptimization.original.length} → {lastOptimization.optimized.length} chars
                  </span>
                </h4>
                <PromptDiffView
                  before={lastOptimization.original}
                  after={lastOptimization.optimized}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state when no optimization has been run yet */}
      {!lastOptimization && !isOptimizing && (
        <EmptyState
          icon={Wand2}
          title="Self-Learning Optimizer"
          description="Paste a prompt above and select a module to see how the optimizer rewrites it based on historical success patterns. Every CLI interaction improves future suggestions."
        />
      )}
    </div>
  );
}
