import { motion, AnimatePresence } from 'framer-motion';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';
import { MOTION } from '@/lib/constants';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_INFO } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';

export function ModuleSelectorPanel({
  showModuleSelector,
  selectedModuleIds,
  setSelectedModuleIds,
  toggleSelectedModule,
}: {
  showModuleSelector: boolean;
  selectedModuleIds: Set<string>;
  setSelectedModuleIds: (ids: Set<string>) => void;
  toggleSelectedModule: (moduleId: SubModuleId) => void;
}) {
  return (
    <AnimatePresence>
      {showModuleSelector && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: MOTION.base }}
          className="overflow-hidden"
        >
          <SurfaceCard className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Select Modules to Evaluate
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedModuleIds(new Set(getEvaluableModuleIds()))}
                  className="text-2xs transition-colors hover:brightness-125"
                  style={{ color: STATUS_INFO }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedModuleIds(new Set())}
                  className="text-2xs text-text-muted hover:text-text transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {getEvaluableModuleIds().map((id) => {
                const selected = selectedModuleIds.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSelectedModule(id as SubModuleId)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all border ${
                      selected
                        ? 'text-text bg-border border-border-bright'
                        : 'text-text-muted bg-background border-border hover:text-text-muted'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-sm border transition-colors ${
                        selected ? '' : 'border-border-bright'
                      }`}
                      style={selected ? { backgroundColor: EVAL_ACCENT, borderColor: EVAL_ACCENT } : undefined}
                    />
                    {MODULE_LABELS[id] ?? id}
                  </button>
                );
              })}
            </div>
          </SurfaceCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
