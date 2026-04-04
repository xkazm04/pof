'use client';

import { Keyboard, Gamepad2, MousePointer, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_INFO, ACCENT_CYAN, ACCENT_EMERALD, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface InputSystemPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const INPUT_ACTIONS = [
  { action: 'IA_Move', key: 'WASD', gamepad: 'Left Stick', context: 'Default', type: 'Axis2D' as const },
  { action: 'IA_Look', key: 'Mouse', gamepad: 'Right Stick', context: 'Default', type: 'Axis2D' as const },
  { action: 'IA_Attack', key: 'LMB', gamepad: 'RT', context: 'Combat', type: 'Digital' as const },
  { action: 'IA_Dodge', key: 'Space', gamepad: 'A', context: 'Combat', type: 'Digital' as const },
  { action: 'IA_Interact', key: 'E', gamepad: 'X', context: 'Default', type: 'Digital' as const },
  { action: 'IA_Inventory', key: 'I', gamepad: 'DPad Up', context: 'UI', type: 'Digital' as const },
  { action: 'IA_Ability1', key: '1', gamepad: 'LB', context: 'Combat', type: 'Digital' as const },
  { action: 'IA_Ability2', key: '2', gamepad: 'RB', context: 'Combat', type: 'Digital' as const },
] as const;

const INPUT_CONTEXTS = [
  { name: 'IMC_Default', priority: 0, actions: 5, active: true },
  { name: 'IMC_Combat', priority: 1, actions: 4, active: true },
  { name: 'IMC_UI', priority: 2, actions: 3, active: false },
  { name: 'IMC_Vehicle', priority: 1, actions: 4, active: false },
] as const;

function contextColor(name: string): string {
  if (name === 'IMC_Default') return STATUS_SUCCESS;
  if (name === 'IMC_Combat') return ACCENT_CYAN;
  if (name === 'IMC_UI') return ACCENT_EMERALD;
  return STATUS_INFO;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function InputMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Keyboard className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{INPUT_ACTIONS.length} binds</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function InputCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Input Actions</span>
        <span className="font-mono text-text">{INPUT_CONTEXTS.length} contexts</span>
      </div>
      {INPUT_ACTIONS.slice(0, 5).map((a) => (
        <div key={a.action} className="flex items-center gap-2">
          <Keyboard className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text flex-1 truncate">{a.action}</span>
          <span className="font-mono text-text-muted text-2xs">{a.key}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function InputFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Enhanced Input System configuration: input actions, mapping contexts, keyboard and gamepad bindings.
      </SurfaceCard>

      {/* Mapping Contexts */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Settings} label="Mapping Contexts" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {INPUT_CONTEXTS.map((ctx, i) => (
            <motion.div
              key={ctx.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{ctx.name}</span>
                  <span
                    className="text-2xs px-1 py-0.5 rounded"
                    style={{
                      backgroundColor: `${ctx.active ? STATUS_SUCCESS : 'var(--text-muted)'}${OPACITY_15}`,
                      color: ctx.active ? STATUS_SUCCESS : 'var(--text-muted)',
                    }}
                  >
                    {ctx.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-2xs text-text-muted">
                  Priority: {ctx.priority} &middot; {ctx.actions} actions
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Key Bindings */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Gamepad2} label="Key Bindings" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {INPUT_ACTIONS.map((action, i) => (
            <motion.div
              key={action.action}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-1.5 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: contextColor(`IMC_${action.context}`) }}
              />
              <span className="text-text font-medium flex-1 truncate">{action.action}</span>
              <span className="flex items-center gap-1">
                <Keyboard className="w-3 h-3 text-text-muted" />
                <span className="font-mono text-text text-2xs min-w-[3rem]">{action.key}</span>
              </span>
              <span className="flex items-center gap-1">
                <MousePointer className="w-3 h-3 text-text-muted" />
                <span className="font-mono text-text text-2xs min-w-[4rem]">{action.gamepad}</span>
              </span>
              <span
                className="text-2xs px-1 py-0.5 rounded"
                style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
              >
                {action.type}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function InputSystemPanel({ featureMap, defs }: InputSystemPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Input System" icon={<Keyboard className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <InputMicro />}
          {density === 'compact' && <InputCompact />}
          {density === 'full' && <InputFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
