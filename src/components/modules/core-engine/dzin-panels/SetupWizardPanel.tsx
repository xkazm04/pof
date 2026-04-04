'use client';

import { Rocket, FolderOpen, Check, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SetupWizardPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.setup;

const WIZARD_STEPS = [
  { id: 1, label: 'Select Engine Version', description: 'Choose UE 5.5 / 5.6 / 5.7', status: 'done' as const },
  { id: 2, label: 'Project Location', description: 'Set project root & source path', status: 'done' as const },
  { id: 3, label: 'Module Configuration', description: 'API macro, build target, MSVC toolchain', status: 'active' as const },
  { id: 4, label: 'Feature Selection', description: 'Pick starter modules (combat, loot, AI…)', status: 'pending' as const },
  { id: 5, label: 'Scaffold & Verify', description: 'Generate source tree, run first build', status: 'pending' as const },
] as const;

const RECENT_PROJECTS = [
  { name: 'PoF-Dzin-Full', engine: '5.7.3', path: 'C:/Users/kazda/kiro/pof', lastOpened: '2026-04-01' },
  { name: 'DarkSoulsLike', engine: '5.6.1', path: 'C:/Projects/DarkSoulsLike', lastOpened: '2026-03-28' },
  { name: 'ARPGPrototype', engine: '5.5.4', path: 'C:/Projects/ARPGPrototype', lastOpened: '2026-03-20' },
] as const;

function stepColor(status: string): string {
  if (status === 'done') return STATUS_SUCCESS;
  if (status === 'active') return ACCENT;
  return 'var(--text-muted)';
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function WizardMicro() {
  const done = WIZARD_STEPS.filter((s) => s.status === 'done').length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Rocket className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{done}/{WIZARD_STEPS.length} steps</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function WizardCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Setup Wizard</span>
        <span className="font-mono text-text">Step 3/5</span>
      </div>
      {WIZARD_STEPS.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stepColor(s.status) }}
          />
          <span className="text-text-muted flex-1 truncate">{s.label}</span>
          {s.status === 'done' && <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />}
          {s.status === 'active' && <ArrowRight className="w-3 h-3" style={{ color: ACCENT }} />}
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function WizardFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Project creation wizard — walk through engine selection, project location, module config, feature selection, and scaffolding.
      </SurfaceCard>

      {/* Wizard Steps */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Rocket} label="Wizard Steps" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {WIZARD_STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 text-xs"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-bold"
                style={{ backgroundColor: `${stepColor(step.status)}${OPACITY_15}`, color: stepColor(step.status) }}
              >
                {step.status === 'done' ? <Check className="w-3 h-3" /> : step.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text">{step.label}</div>
                <div className="text-text-muted text-2xs">{step.description}</div>
              </div>
              {step.status === 'active' && (
                <span
                  className="text-2xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
                >
                  current
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Recent Projects */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FolderOpen} label="Recent Projects" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {RECENT_PROJECTS.map((proj, i) => (
            <motion.div
              key={proj.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-text">{proj.name}</span>
                  <span className="text-2xs px-1 py-0.5 rounded" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_15}`, color: STATUS_WARNING }}>
                    UE {proj.engine}
                  </span>
                </div>
                <div className="text-2xs text-text-muted truncate">{proj.path} · {proj.lastOpened}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SetupWizardPanel({ featureMap, defs }: SetupWizardPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Setup Wizard" icon={<Rocket className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <WizardMicro />}
          {density === 'compact' && <WizardCompact />}
          {density === 'full' && <WizardFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
