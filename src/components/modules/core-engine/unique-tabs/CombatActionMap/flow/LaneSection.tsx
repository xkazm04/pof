'use client';

import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_WARNING, ACCENT_EMERALD,
  withOpacity, OPACITY_8, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../../_design';
import type { LaneConfig } from '../data';
import { ACCENT } from '../data';

interface LaneSectionProps {
  lane: LaneConfig;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

export function LaneSection({ lane, featureMap, defs, expanded, onToggle }: LaneSectionProps) {
  const LaneIcon = lane.icon;

  return (
    <BlueprintPanel color={lane.color} className="p-3">
      <SectionHeader label={lane.label} color={lane.color} icon={LaneIcon} />

      <div className="space-y-0.5">
        {lane.featureNames.map((name) => {
          const row = featureMap.get(name);
          const def = defs.find((d) => d.featureName === name);
          const status: FeatureStatus = row?.status ?? 'unknown';
          const sc = STATUS_COLORS[status];
          const isExpanded = expanded === name;

          return (
            <div key={name}>
              <button
                onClick={() => onToggle(name)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/50 transition-colors text-left cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text w-[180px] flex-shrink-0 truncate">{name}</span>
                <span className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.dot }}>{sc.label}</span>
                {row?.qualityScore != null && (
                  <span className="text-2xs font-mono px-1 rounded-sm border flex-shrink-0"
                    style={{ color: ACCENT_EMERALD, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_10), borderColor: withOpacity(ACCENT_EMERALD, OPACITY_20) }}>
                    Q{row.qualityScore}
                  </span>
                )}
                {row?.filePaths && row.filePaths.length > 0 && (
                  <span className="text-2xs text-text-muted flex-shrink-0">{row.filePaths.length} files</span>
                )}
                <span className="ml-auto flex-shrink-0">
                  {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-text-muted" />
                    : <ChevronRight className="w-3 h-3 text-text-muted" />}
                </span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-8 pb-2 space-y-3">
                      <p className="text-2xs text-text-muted leading-relaxed">
                        {def?.description ?? row?.description ?? 'No description'}
                      </p>
                      {row?.filePaths && row.filePaths.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {row.filePaths.slice(0, 3).map((fp) => (
                            <span key={fp} className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}>
                              <ExternalLink className="w-2.5 h-2.5" />
                              {fp.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      )}
                      {row?.nextSteps && (
                        <p className="text-2xs border-l-2 pl-2" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                          <span className="font-semibold opacity-70 mr-1">Next:</span>{row.nextSteps}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
