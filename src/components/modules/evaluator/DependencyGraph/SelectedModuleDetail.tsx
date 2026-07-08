import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { MODULE_LABELS } from '@/lib/module-registry';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER, OPACITY_5, statusBorder } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import type { SelectedFeatureDetail } from './types';

interface SelectedModuleDetailProps {
  selectedModule: string | null;
  selectedDetails: SelectedFeatureDetail[] | null;
}

export function SelectedModuleDetail({ selectedModule, selectedDetails }: SelectedModuleDetailProps) {
  return (
    <AnimatePresence>
      {selectedModule && selectedDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: MOTION.base }}
          className="overflow-hidden"
        >
          <SurfaceCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-text">
                {MODULE_LABELS[selectedModule] ?? selectedModule}
              </span>
              <span className="text-xs text-text-muted">
                {selectedDetails.filter((f) => f.isBlocked).length} blocked features
              </span>
            </div>

            <div className="space-y-1">
              {selectedDetails
                .filter((f) => f.deps.length > 0)
                .map((feat) => (
                  <div
                    key={feat.featureName}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
                  >
                    {/* Status indicator */}
                    <span
                      className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                      style={{
                        backgroundColor:
                          feat.status === 'implemented'
                            ? STATUS_SUCCESS
                            : feat.status === 'partial'
                              ? STATUS_WARNING
                              : feat.status === 'missing'
                                ? STATUS_ERROR
                                : 'var(--text-muted)',
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#d0d4e8] truncate">
                          {feat.featureName}
                        </span>
                        {feat.isBlocked && (
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_BLOCKER }} />
                        )}
                      </div>

                      {/* Dependency pills */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {feat.deps.map((dep) => {
                          const isBlocker = feat.blockers.some((b) => b.key === dep.key);
                          const isCross = dep.moduleId !== selectedModule;
                          return (
                            <span
                              key={dep.key}
                              className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded border"
                              style={
                                isBlocker
                                  ? { backgroundColor: `${STATUS_ERROR}${OPACITY_5}`, borderColor: statusBorder(STATUS_ERROR), color: STATUS_BLOCKER }
                                  : { backgroundColor: `${STATUS_SUCCESS}${OPACITY_5}`, borderColor: statusBorder(STATUS_SUCCESS, 0.12), color: 'var(--text-muted)' }
                              }
                            >
                              {isCross && (
                                <span className="text-2xs text-text-muted">
                                  {MODULE_LABELS[dep.moduleId] ?? dep.moduleId}/
                                </span>
                              )}
                              {dep.featureName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </SurfaceCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
