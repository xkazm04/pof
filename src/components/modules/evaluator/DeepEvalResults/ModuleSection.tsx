import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Play, Zap, Loader2 } from 'lucide-react';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { EvalFinding, FindingSeverity, ModuleFindings } from '@/lib/evaluator/finding-collector';
import type { AttributionMap } from '@/lib/evaluator/git-attribution';
import { MOTION } from '@/lib/constants';
import { EVAL_ACCENT, SEVERITY_CONFIG } from './constants';
import { FindingRow } from './FindingRow';

// ─── Module Section ──────────────────────────────────────────────────────────

export function ModuleSection({
  module: mod,
  isExpanded,
  expandedCategories,
  statusById,
  attribution,
  taggingActive,
  onToggleModule,
  onToggleCategory,
  onFix,
  onBatchFix,
  onRunSingle,
  isFixRunning,
  fixTargetId,
}: {
  module: ModuleFindings;
  isExpanded: boolean;
  expandedCategories: Set<string>;
  statusById?: Record<string, 'new' | 'persisting'>;
  attribution: AttributionMap;
  taggingActive: boolean;
  onToggleModule: () => void;
  onToggleCategory: (key: string) => void;
  onFix: (finding: EvalFinding) => void;
  onBatchFix: () => void;
  onRunSingle: () => void;
  isFixRunning: boolean;
  /** The finding id or `module:<id>` currently being fixed, or null. */
  fixTargetId: string | null;
}) {
  const totalFindings = mod.findings.length;
  const hasCritical = mod.bySeverity.critical > 0;
  const hasHigh = mod.bySeverity.high > 0;
  const isBatchTarget = fixTargetId === `module:${mod.moduleId}`;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Module header */}
      <button
        onClick={onToggleModule}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface bg-surface-deep"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}

        <span className="text-xs font-semibold text-text flex-1">
          {MODULE_LABELS[mod.moduleId] ?? mod.moduleId}
        </span>

        {/* Severity counts */}
        <div className="flex items-center gap-1.5">
          {(Object.entries(mod.bySeverity) as [FindingSeverity, number][])
            .filter(([, count]) => count > 0)
            .map(([sev, count]) => {
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <span
                  key={sev}
                  className="text-2xs font-bold px-1.5 py-0.5 rounded"
                  style={{ color: cfg.color, backgroundColor: cfg.bg }}
                >
                  {count}
                </span>
              );
            })}
        </div>

        <span className="text-xs text-text-muted">{totalFindings} findings</span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {/* Action bar */}
              <div className="flex items-center gap-2 pt-2">
                {(hasCritical || hasHigh) && (
                  <button
                    onClick={onBatchFix}
                    disabled={isFixRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: `${EVAL_ACCENT}12`,
                      color: EVAL_ACCENT,
                      border: `1px solid ${EVAL_ACCENT}25`,
                    }}
                  >
                    {isBatchTarget ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Fix Critical/High ({mod.bySeverity.critical + mod.bySeverity.high})
                  </button>
                )}
                <button
                  onClick={onRunSingle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-surface text-text-muted border border-border hover:text-text"
                >
                  <Play className="w-3 h-3" />
                  Re-evaluate
                </button>
              </div>

              {/* Category groups */}
              {Object.entries(mod.byCategory).map(([category, findings]) => {
                const catKey = `${mod.moduleId}::${category}`;
                const isCatExpanded = expandedCategories.has(catKey);

                return (
                  <div key={catKey} className="rounded-md border border-border/50">
                    <button
                      onClick={() => onToggleCategory(catKey)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface"
                    >
                      {isCatExpanded ? (
                        <ChevronDown className="w-3 h-3 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-muted" />
                      )}
                      <span className="text-xs font-medium text-text-muted">{category}</span>
                      <span className="text-2xs text-text-muted">{findings.length}</span>
                    </button>

                    <AnimatePresence>
                      {isCatExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: MOTION.fast }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-2 space-y-1.5">
                            {findings.map((finding) => (
                              <FindingRow
                                key={finding.id}
                                finding={finding}
                                status={taggingActive ? statusById?.[finding.id] : undefined}
                                commits={finding.file ? attribution[finding.file] : undefined}
                                onFix={() => onFix(finding)}
                                isFixRunning={isFixRunning}
                                isFixTarget={fixTargetId === finding.id}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
