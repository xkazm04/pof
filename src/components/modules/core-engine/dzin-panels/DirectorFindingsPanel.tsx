'use client';

import { Target, Filter, AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER,
  OPACITY_8, OPACITY_20,
} from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface DirectorFindingsPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'positive';

const SEV_STYLES: Record<Severity, { icon: typeof AlertOctagon; color: string }> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR },
  high: { icon: AlertTriangle, color: STATUS_BLOCKER },
  medium: { icon: Info, color: STATUS_WARNING },
  low: { icon: Info, color: STATUS_INFO },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS },
};

const FINDINGS = [
  { title: 'Combo chain drops input', severity: 'critical' as Severity, category: 'gameplay-feel', confidence: 92 },
  { title: 'Camera clips through wall', severity: 'high' as Severity, category: 'visual-glitch', confidence: 87 },
  { title: 'Inventory tooltip flicker', severity: 'medium' as Severity, category: 'ux-problem', confidence: 78 },
  { title: 'Smooth dodge animation', severity: 'positive' as Severity, category: 'positive-feedback', confidence: 95 },
  { title: 'Hitbox extends past mesh', severity: 'high' as Severity, category: 'gameplay-feel', confidence: 84 },
  { title: 'Frame drops in loot room', severity: 'medium' as Severity, category: 'performance', confidence: 71 },
] as const;

const SEVERITY_COUNTS: Record<Severity, number> = { critical: 5, high: 14, medium: 28, low: 22, positive: 18 };

/* ── Micro density ──────────────────────────────────────────────────────── */

function FindingsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Target className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{Object.values(SEVERITY_COUNTS).reduce((a, b) => a + b, 0)} findings</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function FindingsCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {(Object.entries(SEVERITY_COUNTS) as [Severity, number][]).map(([sev, count]) => {
        const style = SEV_STYLES[sev];
        const Icon = style.icon;
        return (
          <div key={sev} className="flex items-center gap-2">
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: style.color }} />
            <span className="text-text-muted flex-1 capitalize">{sev}</span>
            <span className="font-mono text-text font-medium">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function FindingsFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Findings explorer showing all discovered issues across playtest sessions, grouped by severity and category.
      </SurfaceCard>

      {/* Severity breakdown bar */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Filter} label="By Severity" color={ACCENT} />
        <div className="flex gap-2 mt-2">
          {(Object.entries(SEVERITY_COUNTS) as [Severity, number][]).map(([sev, count]) => {
            const style = SEV_STYLES[sev];
            return (
              <div
                key={sev}
                className="flex-1 p-2 rounded-lg border text-center"
                style={{ backgroundColor: `${style.color}${OPACITY_8}`, borderColor: `${style.color}${OPACITY_20}` }}
              >
                <span className="text-sm font-bold block" style={{ color: style.color }}>{count}</span>
                <span className="text-2xs capitalize text-text-muted">{sev}</span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Recent findings */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Target} label="Recent Findings" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {FINDINGS.map((f, i) => {
            const style = SEV_STYLES[f.severity];
            const Icon = style.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5"
                style={{ backgroundColor: `${style.color}${OPACITY_8}` }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: style.color }} />
                <span className="text-text flex-1 truncate">{f.title}</span>
                <span className="text-2xs text-text-muted capitalize">{f.category.replace(/-/g, ' ')}</span>
                <span className="text-2xs text-text-muted">{f.confidence}%</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DirectorFindingsPanel({ featureMap, defs }: DirectorFindingsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Findings Explorer" icon={<Target className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <FindingsMicro />}
          {density === 'compact' && <FindingsCompact />}
          {density === 'full' && <FindingsFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
