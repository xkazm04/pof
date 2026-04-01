'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { MODULE_COLORS, OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeatureStatus, FeatureRow } from '@/types/feature-matrix';
import { STATUS_COLORS } from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, RARITY_COLORS, EQUIPMENT_SLOTS, AFFIX_EXAMPLES } from './data';

/* ── Affix Table + Equipment Slots ─────────────────────────────────────── */

interface AffixSlotPanelsProps {
  featureMap: Map<string, FeatureRow>;
}

export function AffixSlotPanels({ featureMap }: AffixSlotPanelsProps) {
  const [affixOpen, setAffixOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Affix table collapsible */}
      <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
        <button onClick={() => setAffixOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left focus:outline-none">
          <motion.div animate={{ rotate: affixOpen ? 90 : 0 }}><ChevronRight className="w-4 h-4 text-text-muted" /></motion.div>
          <span className="text-sm font-bold text-text">Affix System Definitions</span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border shadow-sm ml-auto"
            style={{ backgroundColor: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].bg, color: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot, borderColor: `${STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot}40` }}>
            {STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].label}
          </span>
        </button>
        <AnimatePresence>
          {affixOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-border/40 overflow-x-auto bg-surface/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-surface-deep/50">
                      {['Affix', 'Modifier', 'Tier', 'Rarity'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {AFFIX_EXAMPLES.map((affix, i) => (
                      <motion.tr key={affix.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="hover:bg-surface-hover/20 transition-colors">
                        <td className="px-4 py-2 font-mono text-text font-medium">{affix.name}</td>
                        <td className="px-4 py-2 text-text-muted">{affix.stat}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded-md font-mono text-sm uppercase font-bold border shadow-sm"
                            style={{ backgroundColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}${OPACITY_10}` : `${MODULE_COLORS.systems}${OPACITY_10}`, color: affix.tier === 'Prefix' ? MODULE_COLORS.core : MODULE_COLORS.systems, borderColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}40` : `${MODULE_COLORS.systems}40` }}>
                            {affix.tier}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium" style={{ color: RARITY_COLORS[affix.rarity] }}>{affix.rarity}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BlueprintPanel>

      {/* Equipment Slots Status */}
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader label="Equipment Slot Topology" color={ACCENT} />
        <div className="mt-2.5 flex flex-wrap gap-2">
          {EQUIPMENT_SLOTS.map(slot => {
            const slotStatus: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[slotStatus];
            return (
              <div key={slot.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm shadow-sm border"
                style={{ backgroundColor: `${sc.dot}${OPACITY_10}`, borderColor: `${sc.dot}${OPACITY_20}` }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                <span className="text-text font-medium">{slot.label}</span>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>
    </div>
  );
}
