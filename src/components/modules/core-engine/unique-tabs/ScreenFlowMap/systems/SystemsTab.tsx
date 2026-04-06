'use client';

import { useMemo } from 'react';
import { Gauge, Layers, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { HudCompositor } from '../../HudCompositor';
import { ArpgHudPreview } from './ArpgHudPreview';
import { PERFORMANCE_BUDGETS, Z_LAYERS } from '../data';

const ACCENT = ACCENT_PINK;

export function SystemsTab() {
  const sortedBudgets = useMemo(() =>
    [...PERFORMANCE_BUDGETS].sort((a, b) => (b.current / b.max) - (a.current / a.max)),
  []);

  return (
    <motion.div key="systems" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader label="Widget Performance Budget" color={ACCENT} icon={Gauge} />
        <div className="space-y-3">
          {sortedBudgets.map((b, i) => {
            const pct = b.current / b.max;
            const barColor = b.threshold
              ? (b.current >= b.threshold.danger ? STATUS_ERROR : b.current >= b.threshold.warn ? STATUS_WARNING : STATUS_SUCCESS)
              : (b.color ?? ACCENT);
            return (
              <motion.div key={b.label} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text w-36 truncate">{b.label}</span>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                    {b.current}{b.unit ? ` ${b.unit}` : ''} / {b.max}{b.unit ? ` ${b.unit}` : ''}
                  </span>
                  <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: barColor }}>
                    {Math.round(pct * 100)}%
                  </span>
                </div>
                <NeonBar pct={pct * 100} color={barColor} glow />
              </motion.div>
            );
          })}
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader label="Screen Depth / Z-Order" color={ACCENT} icon={Layers} />
          <div className="space-y-3 relative pl-6">
            <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-border/50 rounded-full" />
            {Z_LAYERS.map((layer, i) => (
              <motion.div key={layer.depth} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative">
                <div className="absolute top-1.5 -left-[22px] w-2 h-2 rounded-full border-2 border-surface bg-background" style={{ borderColor: layer.color }} />
                <div className="flex items-start gap-3">
                  <div className="w-12 pt-0.5 text-right flex-shrink-0">
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Z: {layer.depth}</span>
                  </div>
                  <div className="flex-1 bg-surface/50 rounded-md border border-border/30 p-2 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 opacity-60" style={{ backgroundColor: layer.color }} />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold font-mono" style={{ color: layer.color }}>{layer.label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {layer.widgets.map(w => (
                          <span key={w} className="px-1.5 py-0.5 bg-background rounded border border-border/50 text-xs font-mono text-text-muted">{w}</span>
                        ))}
                      </div>
                    </div>
                    {layer.hasOverlap && (
                      <div className="absolute top-1.5 right-1.5" style={{ color: STATUS_WARNING }}><AlertCircle className="w-3 h-3" /></div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </BlueprintPanel>
      </div>

      <ArpgHudPreview />

      <HudCompositor accent={ACCENT} />
    </motion.div>
  );
}
