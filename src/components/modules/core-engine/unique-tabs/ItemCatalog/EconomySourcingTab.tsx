'use client';

import { PieChart } from 'lucide-react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import {
  ACCENT,
  INVENTORY_GROUPS, INVENTORY_TOTAL, INVENTORY_USED, INVENTORY_GOLD_VALUE,
  INVENTORY_BY_RARITY, CLEANUP_SUGGESTIONS,
} from './data';
import { CraftingRecipeSection, DropSourceSection, RarityDistributionSection } from './EconomySections';

/* ── Inventory Capacity Section ────────────────────────────────────────── */

function InventoryCapacitySection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={PieChart} label="Inventory Capacity Planner" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Slots by type, rarity breakdown, total value, and cleanup suggestions.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut chart */}
        <div className="flex flex-col items-center gap-2">
          <svg width={110} height={110} viewBox="0 0 140 140">
            {(() => {
              const cx = 70, cy = 70, outerR = 55, innerR = 35;
              let cumAngle = -Math.PI / 2;
              return INVENTORY_GROUPS.map(g => {
                const angle = (g.count / INVENTORY_TOTAL) * 2 * Math.PI;
                const x1o = cx + outerR * Math.cos(cumAngle), y1o = cy + outerR * Math.sin(cumAngle);
                const x1i = cx + innerR * Math.cos(cumAngle), y1i = cy + innerR * Math.sin(cumAngle);
                cumAngle += angle;
                const x2o = cx + outerR * Math.cos(cumAngle), y2o = cy + outerR * Math.sin(cumAngle);
                const x2i = cx + innerR * Math.cos(cumAngle), y2i = cy + innerR * Math.sin(cumAngle);
                const large = angle > Math.PI ? 1 : 0;
                const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
                return <path key={g.type} d={d} fill={g.color} opacity={0.8} stroke="var(--surface)" strokeWidth="1.5" />;
              });
            })()}
            {(() => {
              const cx = 70, cy = 70, outerR = 55, innerR = 35;
              const usedAngle = (INVENTORY_USED / INVENTORY_TOTAL) * 2 * Math.PI;
              const emptyAngle = 2 * Math.PI - usedAngle;
              const startAngle = -Math.PI / 2 + usedAngle;
              if (emptyAngle <= 0) return null;
              const x1o = cx + outerR * Math.cos(startAngle), y1o = cy + outerR * Math.sin(startAngle);
              const x1i = cx + innerR * Math.cos(startAngle), y1i = cy + innerR * Math.sin(startAngle);
              const endAngle = startAngle + emptyAngle;
              const x2o = cx + outerR * Math.cos(endAngle), y2o = cy + outerR * Math.sin(endAngle);
              const x2i = cx + innerR * Math.cos(endAngle), y2i = cy + innerR * Math.sin(endAngle);
              const large = emptyAngle > Math.PI ? 1 : 0;
              const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
              return <path d={d} fill="rgba(255,255,255,0.05)" stroke="var(--surface)" strokeWidth="1.5" />;
            })()}
            <text x="70" y="66" textAnchor="middle" className="text-sm font-bold fill-text font-mono" style={{ fontSize: 14 }}>{INVENTORY_USED}/{INVENTORY_TOTAL}</text>
            <text x="70" y="80" textAnchor="middle" className="text-[11px] fill-[var(--text-muted)] font-mono" style={{ fontSize: 11 }}>slots</text>
          </svg>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {INVENTORY_GROUPS.map(g => (
              <span key={g.type} className="text-[11px] font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: g.color }} />{g.type} ({g.count})
              </span>
            ))}
          </div>
        </div>
        {/* Rarity bars */}
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">By Rarity</p>
          {INVENTORY_BY_RARITY.map(r => (
            <div key={r.rarity} className="space-y-0.5">
              <div className="flex justify-between text-sm font-mono">
                <span style={{ color: r.color }}>{r.rarity}</span>
                <span className="text-text-muted">{r.count}</span>
              </div>
              <NeonBar pct={(r.count / INVENTORY_USED) * 100} color={r.color} />
            </div>
          ))}
          <p className="text-sm font-mono text-text-muted mt-2">
            Total Value: <span className="text-amber-400 font-bold" style={{ textShadow: `0 0 12px ${STATUS_WARNING}40` }}>{INVENTORY_GOLD_VALUE}g</span>
          </p>
        </div>
        {/* Cleanup suggestions */}
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Auto-Cleanup Suggestions</p>
          {CLEANUP_SUGGESTIONS.map((sug, i) => (
            <motion.div key={i} className="flex items-start gap-2 text-sm font-mono p-2 rounded-lg bg-surface-deep border" style={{ borderColor: `${ACCENT}15` }}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>
              <span className="text-text-muted">{sug}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Main Tab ──────────────────────────────────────────────────────────── */

export function EconomySourcingTab() {
  return (
    <motion.div key="economy-sourcing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CraftingRecipeSection />
        <DropSourceSection />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RarityDistributionSection />
        <InventoryCapacitySection />
      </div>
    </motion.div>
  );
}
