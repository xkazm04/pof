'use client';

import { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  OPACITY_8, OPACITY_10,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/* ── Shared STATUS_COLORS ─────────────────────────────────────────────────── */

export const STATUS_COLORS: Record<FeatureStatus, { dot: string; bg: string; label: string }> = {
  implemented: { dot: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_8}`, label: 'Implemented' },
  improved: { dot: STATUS_IMPROVED, bg: `${STATUS_IMPROVED}${OPACITY_8}`, label: 'Improved' },
  partial: { dot: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, label: 'Partial' },
  missing: { dot: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_8}`, label: 'Missing' },
  unknown: { dot: '#64748b', bg: '#64748b18', label: 'Unknown' },
};

/* ── StatusDot ────────────────────────────────────────────────────────────── */

export function StatusDot({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];
  const isActive = status === 'implemented' || status === 'improved';
  return (
    <span className="flex items-center gap-1.5">
      <motion.span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: sc.dot, boxShadow: isActive ? `0 0 6px ${sc.dot}` : 'none' }}
        animate={isActive ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-2xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
    </span>
  );
}

/* ── TabHeader ────────────────────────────────────────────────────────────── */

interface TabHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  implemented: number;
  total: number;
  accent: string;
  children?: ReactNode;
}

export function TabHeader({ icon: Icon, title, implemented, total, accent, children }: TabHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between pb-3 border-b border-border/40"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: accent }} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity blur-md" style={{ backgroundColor: accent }} />
          <Icon className="w-5 h-5 relative z-10" style={{ color: accent, filter: `drop-shadow(0 0 4px ${accent}80)` }} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-text tracking-wide">{title}</span>
          <span className="text-xs text-text-muted mt-0.5">
            <span className="font-mono font-medium" style={{ color: implemented === total ? STATUS_SUCCESS : accent }}>{implemented}</span>
            <span className="opacity-60">/{total} deployed</span>
          </span>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/* ── PipelineFlow ─────────────────────────────────────────────────────────── */

interface PipelineStep {
  label: string;
  status?: FeatureStatus;
}

interface PipelineFlowProps {
  steps: (string | PipelineStep)[];
  accent: string;
  showStatus?: boolean;
}

export function PipelineFlow({ steps, accent, showStatus }: PipelineFlowProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((step, i, arr) => {
        const label = typeof step === 'string' ? step : step.label;
        const status = typeof step === 'string' ? undefined : step.status;
        const sc = status ? STATUS_COLORS[status] : undefined;
        const isLast = i === arr.length - 1;

        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-1.5"
          >
            <div
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md"
              style={{
                backgroundColor: `${accent}15`,
                color: accent,
                border: `1px solid ${accent}30`,
                boxShadow: `inset 0 0 10px ${accent}10`
              }}
            >
              {showStatus && sc && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}` }} />
              )}
              {label}
            </div>
            {!isLast && (
              <div className="relative w-5 h-[2px] bg-border overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-current"
                  style={{ color: accent }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── SectionLabel ─────────────────────────────────────────────────────────── */

interface SectionLabelProps {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color?: string;
}

export function SectionLabel({ icon: Icon, label, color }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted font-bold uppercase tracking-widest">
      {Icon && <Icon className="w-3.5 h-3.5" style={color ? { color, filter: `drop-shadow(0 0 3px ${color}80)` } : undefined} />}
      {label}
    </div>
  );
}

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

  return (
    <SurfaceCard level={2} className="relative overflow-hidden group">
      {/* Subtle animated gradient background on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}15 0%, transparent 70%)` }}
      />

      <button
        onClick={() => onToggle(name)}
        className="relative z-10 w-full text-left px-3 py-2.5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted transition-colors group-hover:text-text" />
          </motion.div>
          <span className="text-xs font-semibold text-text truncate group-hover:text-text-bright transition-colors">{name}</span>
          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0 bg-surface px-2 py-0.5 rounded-md border border-border/50 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}80` }} />
            <span className="text-2xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ opacity: { duration: 0.2 }, height: { duration: 0.3, type: "spring", bounce: 0 } }}
            className="relative z-10 overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 bg-surface/30">
              <p className="text-xs text-text-muted leading-relaxed mt-2.5">
                {def?.description ?? row?.description ?? 'No description available for this feature.'}
              </p>

              {row?.filePaths && row.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {row.filePaths.slice(0, 3).map((fp) => (
                    <span
                      key={fp}
                      className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${accent}10`, color: accent, border: `1px solid ${accent}30` }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {fp.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {row?.qualityScore != null && (
                  <div className="flex items-center gap-1.5 bg-surface px-2 py-1 rounded-md text-2xs font-mono border border-border/50">
                    <span className="text-text-muted">Quality:</span>
                    <span className={row.qualityScore >= 8 ? "text-emerald-400" : row.qualityScore >= 5 ? "text-amber-400" : "text-red-400"}>
                      {row.qualityScore}/10
                    </span>
                  </div>
                )}

                {row?.nextSteps && (
                  <div className="text-2xs truncate ml-auto border-l-2 pl-2 max-w-[60%]" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                    <span className="opacity-70 font-semibold mr-1">Next:</span>{row.nextSteps}
                  </div>
                )}
              </div>

              {def?.dependsOn && def.dependsOn.length > 0 && (
                <div className="text-2xs text-text-muted font-mono pt-1">
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

export function FeatureGrid({ featureNames, featureMap, defs, expanded, onToggle, accent }: FeatureGridProps) {
  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-2"
    >
      {featureNames.map((name) => (
        <motion.div key={name} variants={itemVariants}>
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

/* ── LoadingSpinner ───────────────────────────────────────────────────────── */

export function LoadingSpinner({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <motion.div
        className="w-10 h-10 rounded-full"
        style={{
          border: `2px solid ${accent}30`,
          borderTopColor: accent,
          filter: `drop-shadow(0 0 8px ${accent}60)`
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
