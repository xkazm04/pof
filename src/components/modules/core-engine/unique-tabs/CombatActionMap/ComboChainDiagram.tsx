'use client';

import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR } from '@/lib/chart-colors';
import type { FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from '../_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ACCENT, COMBO_SECTIONS } from './data';

export function ComboChainDiagram({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex items-center gap-4 mb-3">
        <SectionHeader label="Combo Chain Analysis" color={ACCENT} icon={Play} />
        <span className="text-2xs px-2 py-0.5 rounded-md ml-auto" style={{ backgroundColor: sc.bg, color: sc.dot }}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-center gap-3 px-2 py-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted border-b border-border/40">
        <span className="w-[100px] flex-shrink-0">Attack</span>
        <span className="w-[100px] flex-shrink-0">Timing</span>
        <span className="w-[100px] flex-shrink-0">Window</span>
        <span className="flex-1">Progress</span>
      </div>

      <div className="space-y-0.5">
        {COMBO_SECTIONS.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors"
          >
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text w-[100px] flex-shrink-0">{s.name}</span>
            <span className="text-2xs font-mono text-text-muted w-[100px] flex-shrink-0">{s.timing}</span>
            <span
              className="text-2xs font-medium w-[100px] flex-shrink-0"
              style={{ color: i === 2 ? STATUS_ERROR : ACCENT }}
            >
              {s.window}
            </span>
            <div className="flex-1">
              <NeonBar pct={s.pct} color={i === 2 ? STATUS_ERROR : ACCENT} />
            </div>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
