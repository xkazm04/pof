'use client';

import { BookOpen, Layers, GitMerge } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, ACCENT_CYAN, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalPatternLibraryPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.evaluator;

const PATTERNS = [
  { name: 'GAS Ability Pipeline', modules: ['combat', 'character'], usage: 12, maturity: 'stable' as const },
  { name: 'Feature Status Tracking', modules: ['evaluator', 'all'], usage: 8, maturity: 'stable' as const },
  { name: 'Subsystem Lifecycle', modules: ['world', 'save'], usage: 6, maturity: 'evolving' as const },
  { name: 'Tag-Based Filtering', modules: ['combat', 'loot', 'enemy-ai'], usage: 9, maturity: 'stable' as const },
  { name: 'Data Table Loader', modules: ['loot', 'inventory'], usage: 4, maturity: 'evolving' as const },
  { name: 'Event Dispatch Bus', modules: ['combat', 'world', 'ui'], usage: 7, maturity: 'stable' as const },
] as const;

const OVERLAPS = [
  { pattern: 'Attribute Getter', modules: ['combat', 'character'], risk: 'low' as const, desc: 'Both modules fetch GAS attributes — shared base class recommended' },
  { pattern: 'Damage Pipeline', modules: ['combat', 'enemy-ai'], risk: 'medium' as const, desc: 'Duplicate damage calc logic — refactor into shared execution context' },
  { pattern: 'Item Resolution', modules: ['loot', 'inventory'], risk: 'low' as const, desc: 'Similar item lookup paths — could unify under shared resolver' },
] as const;

const MATURITY_COLORS = { stable: STATUS_SUCCESS, evolving: STATUS_WARNING } as const;
const RISK_COLORS = { low: STATUS_INFO, medium: STATUS_WARNING } as const;

const stableCount = PATTERNS.filter(p => p.maturity === 'stable').length;

/* ── Micro density ──────────────────────────────────────────────────────── */

function PatternMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <BookOpen className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{PATTERNS.length} patterns</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function PatternCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {PATTERNS.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: MATURITY_COLORS[p.maturity] }}
          />
          <span className="text-text truncate flex-1">{p.name}</span>
          <span className="font-mono text-text-muted">{p.usage}x</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function PatternFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Pattern library cataloging reusable UE5 patterns across modules, with
        cross-module overlap detection and deduplication recommendations.
      </SurfaceCard>

      {/* Pattern catalog */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={BookOpen} label="Pattern Catalog" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {PATTERNS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: MATURITY_COLORS[p.maturity], boxShadow: `0 0 6px ${MATURITY_COLORS[p.maturity]}40` }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-text font-medium truncate">{p.name}</div>
                <div className="text-text-muted text-[10px]">{p.modules.join(', ')}</div>
              </div>
              <span className="font-mono text-text-muted">{p.usage}x</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: MATURITY_COLORS[p.maturity], backgroundColor: MATURITY_COLORS[p.maturity] + OPACITY_8 }}>{p.maturity}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Cross-module overlaps */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={GitMerge} label="Cross-Module Overlaps" color={ACCENT_CYAN} />
        <div className="space-y-2 mt-2">
          {OVERLAPS.map((o, i) => {
            const color = RISK_COLORS[o.risk];
            return (
              <motion.div
                key={o.pattern}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-lg border px-3 py-2"
                style={{ backgroundColor: color + OPACITY_8, borderColor: color + OPACITY_20 }}
              >
                <div className="flex items-center gap-2 text-xs mb-1">
                  <Layers className="w-3 h-3 flex-shrink-0" style={{ color }} />
                  <span className="font-medium text-text">{o.pattern}</span>
                  <span className="text-text-muted ml-auto">{o.modules.join(' + ')}</span>
                </div>
                <div className="text-xs text-text-muted pl-5">{o.desc}</div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Library Summary</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <div>{stableCount}/{PATTERNS.length} patterns stable, {OVERLAPS.length} overlaps detected</div>
          <div>Total usage: <span className="font-mono font-bold text-text">{PATTERNS.reduce((s, p) => s + p.usage, 0)}</span> references across modules</div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalPatternLibraryPanel({ featureMap, defs }: EvalPatternLibraryPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Pattern Library" icon={<BookOpen className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <PatternMicro />}
          {density === 'compact' && <PatternCompact />}
          {density === 'full' && <PatternFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
