'use client';

import { BarChart3, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '../_design';
import {
  ACCENT, DPS_STRATEGIES, DPS_MAX, CUMULATIVE_POINTS,
  SANKEY_COLUMNS, SANKEY_FLOWS, KPI_CARDS,
} from './data';

export function MetricsTab() {
  return (
    <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* DPS Calculator */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="DPS Calculator" color={ACCENT} icon={BarChart3} />
          <div className="mt-3 space-y-1.5">
            {DPS_STRATEGIES.map((strat, idx) => (
              <motion.div key={strat.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text w-[130px] flex-shrink-0 truncate">{strat.name}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-[50px] flex-shrink-0">{strat.time}</span>
                <div className="flex-1">
                  <NeonBar pct={(strat.dps / DPS_MAX) * 100} color={strat.color} />
                </div>
                <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: strat.color }}>{strat.dps} DPS</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Cumulative Damage (5s)</span>
            <div className="bg-surface-deep/30 rounded-lg p-2 mt-2 min-h-[200px]">
              <CumulativeDamageSvg />
            </div>
          </div>
        </BlueprintPanel>

        <div className="space-y-4">
          {/* Combat Flow Sankey */}
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Combat Flow Sankey" color={ACCENT} icon={Activity} />
            <div className="mt-3 flex justify-between relative h-[150px]">
              <SankeyFlowSvg />
              {SANKEY_COLUMNS.map((col) => (
                <div key={col.label} className="flex flex-col h-full justify-between" style={{ zIndex: 1, width: '25%' }}>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted text-center mb-2">{col.label}</span>
                  {col.items.map((item) => (
                    <div key={item.id} className="flex-1 flex flex-col justify-center items-center py-1 relative">
                      <div className="w-full rounded border py-1.5 px-1 relative overflow-hidden backdrop-blur-sm" style={{ borderColor: `${item.color}40`, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: item.color }} />
                        <div className="text-xs font-mono leading-tight text-center text-text shadow-sm truncate relative z-10">{item.label}</div>
                        <div className="text-xs font-mono font-bold text-center mt-0.5 relative z-10" style={{ color: item.color }}>{item.pct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </BlueprintPanel>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4">
            {KPI_CARDS.map((kpi, idx) => (
              <BlueprintPanel key={idx} color={kpi.barColor ?? kpi.trendColor ?? ACCENT} className="p-3">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{kpi.label}</span>
                <div className="mt-1 flex items-end justify-between">
                  <span className="text-lg font-mono font-bold text-text-strong">{kpi.value}</span>
                  {kpi.trend && <span className="text-xs font-mono font-bold" style={{ color: kpi.trendColor }}>{kpi.trend}</span>}
                </div>
                {kpi.barPct !== undefined && kpi.barColor && (
                  <div className="mt-2">
                    <NeonBar pct={kpi.barPct} color={kpi.barColor} glow />
                  </div>
                )}
              </BlueprintPanel>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Cumulative Damage SVG ─────────────────────────────────────────────── */

function CumulativeDamageSvg() {
  return (
    <svg width="100%" height="150" viewBox="0 0 260 60" className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {[0, 20, 40, 60].map(y => <line key={y} x1="30" y1={y + 5} x2="255" y2={y + 5} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
      {CUMULATIVE_POINTS.map((t) => <text key={t} x={30 + t * 45} y="78" textAnchor="middle" className="text-xs font-mono" fill="rgba(255,255,255,0.3)">{t}s</text>)}
      {DPS_STRATEGIES.map((strat) => {
        const maxDmg = DPS_MAX * 5;
        const pts = CUMULATIVE_POINTS.map(t => ({ x: 30 + t * 45, y: 65 - ((strat.dps * t) / maxDmg) * 60 }));
        const d = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
        return (
          <g key={strat.name}>
            <path d={d} fill="none" stroke={strat.color} strokeWidth="1.5" opacity="0.8" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={strat.color} />)}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Sankey Flow SVG overlay ───────────────────────────────────────────── */

function SankeyFlowSvg() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      {SANKEY_FLOWS.map((flow, i) => {
        const colWidth = 100 / (SANKEY_COLUMNS.length - 1);
        const fromColIdx = SANKEY_COLUMNS.findIndex(c => c.items.some(it => it.id === flow.source));
        const toColIdx = SANKEY_COLUMNS.findIndex(c => c.items.some(it => it.id === flow.target));
        if (fromColIdx === -1 || toColIdx === -1) return null;
        const fromItemIdx = SANKEY_COLUMNS[fromColIdx].items.findIndex(it => it.id === flow.source);
        const toItemIdx = SANKEY_COLUMNS[toColIdx].items.findIndex(it => it.id === flow.target);
        const x1 = `${fromColIdx * colWidth + 5}%`;
        const x2 = `${toColIdx * colWidth - 5}%`;
        const y1 = `${(fromItemIdx + 0.5) * (100 / SANKEY_COLUMNS[fromColIdx].items.length)}%`;
        const y2 = `${(toItemIdx + 0.5) * (100 / SANKEY_COLUMNS[toColIdx].items.length)}%`;
        return (
          <path key={i} d={`M ${x1} ${y1} C ${fromColIdx * colWidth + 25}% ${y1}, ${toColIdx * colWidth - 25}% ${y2}, ${x2} ${y2}`} fill="none" stroke={flow.color} strokeWidth={Math.max(1, (flow.value / 100) * 20)} strokeOpacity="0.15" />
        );
      })}
    </svg>
  );
}
