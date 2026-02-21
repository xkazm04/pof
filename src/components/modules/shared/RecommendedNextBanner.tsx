'use client';

import { useMemo } from 'react';
import { ArrowRight, AlertTriangle, Compass } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { useNavigationStore } from '@/stores/navigationStore';
import {
  MODULE_PREREQUISITES,
  getRecommendedNextModules,
  getUnmetPrerequisites,
} from '@/lib/feature-definitions';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

/** Build a map of checklist sizes (total items per module) from the registry. */
function getChecklistSizes(): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const [id, mod] of Object.entries(SUB_MODULE_MAP)) {
    if (mod) sizes[id] = mod.checklist?.length ?? 0;
  }
  return sizes;
}

function getModuleLabel(moduleId: SubModuleId): string {
  return SUB_MODULE_MAP[moduleId]?.label ?? moduleId;
}

interface RecommendedNextBannerProps {
  moduleId: SubModuleId;
  accentColor: string;
}

export function RecommendedNextBanner({ moduleId, accentColor }: RecommendedNextBannerProps) {
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const checklistSizes = useMemo(() => getChecklistSizes(), []);

  const prereqs = MODULE_PREREQUISITES[moduleId];
  const unmetPrereqs = useMemo(
    () => getUnmetPrerequisites(moduleId, checklistProgress, checklistSizes),
    [moduleId, checklistProgress, checklistSizes],
  );

  const recommendations = useMemo(
    () => getRecommendedNextModules(moduleId, checklistProgress, checklistSizes),
    [moduleId, checklistProgress, checklistSizes],
  );

  // Don't render if there's nothing to show
  if (unmetPrereqs.length === 0 && recommendations.length === 0) return null;

  // No prerequisites defined for this module = no banner
  if (!prereqs && recommendations.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {/* Unmet prerequisites warning */}
      {unmetPrereqs.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-300">
              Prerequisite{unmetPrereqs.length > 1 ? 's' : ''} not yet complete
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unmetPrereqs.map((p) => (
                <button
                  key={p.moduleId}
                  onClick={() => navigateToModule(p.moduleId)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/15"
                >
                  <span>{getModuleLabel(p.moduleId)}</span>
                  <span className="text-amber-400/60">{p.progress}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommended next modules */}
      {recommendations.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-surface">
          <Compass className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text">Recommended Next</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recommendations.map((r) => (
                <button
                  key={r.moduleId}
                  onClick={() => navigateToModule(r.moduleId)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text hover:text-text transition-colors cursor-pointer border border-border hover:border-text-muted bg-surface-hover"
                >
                  <span>{getModuleLabel(r.moduleId)}</span>
                  <ArrowRight className="w-3 h-3 text-text-muted" />
                </button>
              ))}
            </div>
            <p className="mt-1 text-2xs text-text-muted">
              {recommendations[0].reason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
