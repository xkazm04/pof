'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_20, OPACITY_50,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from './constants';

/* ── FeatureCard ──────────────────────────────────────────────────────────── */

interface FeatureCardProps {
  name: string;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  accent: string;
}

export function FeatureCard({ name, featureMap, defs, expanded, onToggle, accent }: FeatureCardProps) {
  const row = featureMap.get(name);
  const def = defs.find((d) => d.featureName === name);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const isExpanded = expanded === name;
  const prefersReduced = useReducedMotion();

  return (
    <SurfaceCard level={2} className="relative overflow-hidden group">
      {/* Subtle animated gradient background on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${withOpacity(accent, OPACITY_8)} 0%, transparent 70%)` }}
      />

      <button
        onClick={() => onToggle(name)}
        className="relative z-10 w-full text-left px-2.5 py-1.5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-3 h-3 text-text-muted transition-colors group-hover:text-text" />
          </motion.div>
          <span className="text-sm font-semibold text-text truncate group-hover:text-text-bright transition-colors">{name}</span>
          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0 bg-surface px-2 py-0.5 rounded-md border border-border/50 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `${GLOW_SM} ${withOpacity(sc.dot, OPACITY_50)}` }} />
            <span className="text-xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { opacity: { duration: 0.2 }, height: { duration: 0.3, type: "spring", bounce: 0 } }}
            className="relative z-10 overflow-hidden"
          >
            <div className="px-2.5 pb-2 space-y-1.5 border-t border-border/40 bg-surface/30">
              <p className="text-sm text-text-muted leading-relaxed mt-1.5">
                {def?.description ?? row?.description ?? 'No description available for this feature.'}
              </p>

              {row?.filePaths && row.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {row.filePaths.slice(0, 3).map((fp) => (
                    <span
                      key={fp}
                      className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: withOpacity(accent, OPACITY_5), color: accent, border: `1px solid ${withOpacity(accent, OPACITY_20)}` }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {fp.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {row?.qualityScore != null && (
                  <div className="flex items-center gap-1.5 bg-surface px-2 py-1 rounded-md text-xs font-mono border border-border/50">
                    <span className="text-text-muted">Quality:</span>
                    <span style={{ color: row.qualityScore >= 8 ? STATUS_SUCCESS : row.qualityScore >= 5 ? STATUS_WARNING : STATUS_ERROR }}>
                      {row.qualityScore}/10
                    </span>
                  </div>
                )}

                {row?.nextSteps && (
                  <div className="text-xs truncate ml-auto border-l-2 pl-2 max-w-[60%]" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                    <span className="opacity-70 font-semibold mr-1">Next:</span>{row.nextSteps}
                  </div>
                )}
              </div>

              {def?.dependsOn && def.dependsOn.length > 0 && (
                <div className="text-xs text-text-muted font-mono pt-1">
                  <span className="opacity-50 font-semibold mr-1">Deps:</span> {def.dependsOn.map((d) => d.replace(/.*::/, '')).join(', ')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/* ── FeatureGrid ──────────────────────────────────────────────────────────── */

interface FeatureGridProps {
  featureNames: string[];
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  accent: string;
}

const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const reducedGridVariants = {
  hidden: {},
  visible: {},
};

const reducedItemVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

export function FeatureGrid({ featureNames, featureMap, defs, expanded, onToggle, accent }: FeatureGridProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      variants={prefersReduced ? reducedGridVariants : gridVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-1.5"
    >
      {featureNames.map((name) => (
        <motion.div key={name} variants={prefersReduced ? reducedItemVariants : itemVariants}>
          <FeatureCard
            name={name}
            featureMap={featureMap}
            defs={defs}
            expanded={expanded}
            onToggle={onToggle}
            accent={accent}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
