'use client';

import { Link2, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  SectionLabel,
  PipelineFlow,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_VIOLET, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EvalDepsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_VIOLET;

const DEPENDENCY_MODULES = [
  { name: 'arpg-combat', deps: 4, blocked: 1, status: 'ok' as const },
  { name: 'arpg-character', deps: 2, blocked: 0, status: 'ok' as const },
  { name: 'arpg-loot', deps: 5, blocked: 2, status: 'warn' as const },
  { name: 'arpg-inventory', deps: 3, blocked: 0, status: 'ok' as const },
  { name: 'arpg-enemy-ai', deps: 3, blocked: 1, status: 'warn' as const },
  { name: 'arpg-world', deps: 6, blocked: 3, status: 'error' as const },
] as const;

const STATUS_MAP = {
  ok: STATUS_SUCCESS,
  warn: STATUS_WARNING,
  error: STATUS_ERROR,
} as const;

const DEP_PIPELINE = ['Declare', 'Resolve', 'Validate', 'Build', 'Link'] as const;

const totalBlocked = DEPENDENCY_MODULES.reduce((s, m) => s + m.blocked, 0);

/* ── Micro density ──────────────────────────────────────────────────────── */

function DepsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Link2 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{totalBlocked} blocked</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function DepsCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {DEPENDENCY_MODULES.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_MAP[m.status] }}
          />
          <span className="text-text-muted flex-1">{m.name.replace('arpg-', '')}</span>
          <span className="font-mono text-text">{m.deps} deps</span>
          {m.blocked > 0 && (
            <span className="font-mono" style={{ color: STATUS_BLOCKER }}>{m.blocked} blocked</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function DepsFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Cross-module dependency graph showing feature dependencies, blocker chains,
        and resolution status across the ARPG module system.
      </SurfaceCard>

      {/* Module dependency list */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Link2} label="Module Dependencies" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {DEPENDENCY_MODULES.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_MAP[m.status], boxShadow: `0 0 6px ${STATUS_MAP[m.status]}40` }}
              />
              <span className="text-text font-medium flex-1">{m.name.replace('arpg-', '')}</span>
              <span className="font-mono text-text-muted">{m.deps} deps</span>
              {m.blocked > 0 && (
                <span className="inline-flex items-center gap-1 font-mono" style={{ color: STATUS_BLOCKER }}>
                  <AlertTriangle className="w-3 h-3" />
                  {m.blocked}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Blocker summary */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Blocker Summary</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <div>Total blocked features: <span className="font-mono font-bold" style={{ color: STATUS_BLOCKER }}>{totalBlocked}</span></div>
          <div>{DEPENDENCY_MODULES.filter(m => m.status === 'ok').length}/{DEPENDENCY_MODULES.length} modules fully resolved</div>
        </div>
      </SurfaceCard>

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Dependency Resolution Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...DEP_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EvalDepsPanel({ featureMap, defs }: EvalDepsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Dependency Graph" icon={<Link2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <DepsMicro />}
          {density === 'compact' && <DepsCompact />}
          {density === 'full' && <DepsFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
