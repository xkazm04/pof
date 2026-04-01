'use client';

import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_STALE,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import { CollapsibleSection } from '@/components/modules/core-engine/unique-tabs/_shared';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { ELEMENT_COLORS, ELEMENT_TAGS } from './types';
import type { ElementType } from './types';
import { DamagePipelineFlow } from './DamagePipelineFlow';
import { HealPipelineFlow } from './HealPipelineFlow';
import { DirectHealthFlow } from './DirectHealthFlow';
import { ExecutionBreakdownPanel } from './ExecutionBreakdownPanel';

export function DamagePipelineDiagram() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <BlueprintPanel className="p-3" color={ELEMENT_COLORS.Physical}>
        <SectionHeader icon={Flame} label="PostGameplayEffectExecute Pipeline" color={ELEMENT_COLORS.Physical} />

        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3 max-w-2xl leading-relaxed"
          data-testid="damage-pipeline-diagram">
          The complete damage/heal flow from{' '}
          <code className="font-mono text-text">UARPGAttributeSet::PostGameplayEffectExecute</code>.
          Three entry points converge on health modification with element-type detection,
          dual broadcast patterns, and duplicate death prevention.
        </p>

        {/* Element color legend */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {(Object.entries(ELEMENT_COLORS) as [ElementType, string][]).map(([element, color]) => (
            <div key={element} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `${color}${OPACITY_15}`, border: `1.5px solid ${color}` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color }}>
                {element}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {/* 1. Damage pipeline */}
          <CollapsibleSection variant="bordered"
            title="IncomingDamage Path (meta attribute)"
            color={ELEMENT_COLORS.Physical}
            defaultOpen
            testId="pipeline-section-damage">
            <DamagePipelineFlow />

            <div className="mt-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}` }}
              data-testid="element-detection-detail">
              <div className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text mb-1.5">
                DamageType Detection Order (from AssetTags)
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ELEMENT_TAGS.map((et, i) => (
                  <div key={et.tag} className="flex items-center gap-1">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{
                      backgroundColor: `${ELEMENT_COLORS[et.element]}${OPACITY_15}`,
                      color: ELEMENT_COLORS[et.element],
                      border: `1px solid ${ELEMENT_COLORS[et.element]}30`,
                    }}>
                      {et.tag}
                    </span>
                    {i < ELEMENT_TAGS.length - 1 && (
                      <span className="text-text-muted font-mono text-xs">
                        {i < ELEMENT_TAGS.length - 2 ? '\u2192' : '\u2192 fallback'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* 2. Heal pipeline */}
          <CollapsibleSection variant="bordered"
            title="IncomingHeal Path (meta attribute)"
            color={ELEMENT_COLORS.Heal}
            testId="pipeline-section-heal">
            <HealPipelineFlow />
          </CollapsibleSection>

          {/* 3. Direct Health modification */}
          <CollapsibleSection variant="bordered"
            title="Direct Health Modification (non-execution)"
            color={STATUS_STALE}
            testId="pipeline-section-direct">
            <DirectHealthFlow />
            <div className="mt-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted px-2 py-1.5 rounded-lg bg-surface-deep/50 border border-border/30">
              Backward-compatible path for <code className="font-mono text-text">GE_Heal</code> and other effects
              that modify Health directly without going through an execution calculation.
              Negative magnitude triggers the same death/hitreact logic as the IncomingDamage path.
            </div>
          </CollapsibleSection>

          {/* 4. Execution Calculation Breakdown */}
          <CollapsibleSection variant="bordered"
            title="Execution Calculation (ARPGDamageExecution)"
            color={ELEMENT_COLORS.Physical}
            testId="pipeline-section-execution">
            <ExecutionBreakdownPanel />
          </CollapsibleSection>
        </div>

        {/* Dual broadcast pattern note */}
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-mono"
          style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
          data-testid="dual-broadcast-note">
          <span className="font-bold shrink-0 mt-0.5 uppercase tracking-[0.15em]">Dual Broadcast:</span>
          <span className="text-text-muted">
            All three paths fire both <code className="font-mono text-text">OnDamageNumberRequested</code> (per-instance delegate) and{' '}
            <code className="font-mono text-text">OnDamageNumberRequestedGlobal</code> (static delegate) for floating damage/heal numbers.
          </span>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
