'use client';

import { useState, useMemo, useCallback } from 'react';
import { BarChart3, Activity, Swords } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import {
  ACCENT, DPS_STRATEGIES, DPS_MAX, CUMULATIVE_POINTS,
  SANKEY_COLUMNS, SANKEY_FLOWS, KPI_CARDS,
} from '../data';
import { WEAPONS, COMBO_SEQUENCES, parseDamageMidpoint } from '../data-metrics';
import type { Weapon, WeaponCategory } from '../data-metrics';
import { StatInfluencePanel } from './StatInfluencePanel';
import { AbilityQuickPicker } from '../../CharacterBlueprint/input/AbilityQuickPicker';

import { OVERLAY_WHITE, withOpacity, OPACITY_4, OPACITY_8, OPACITY_10, OPACITY_30, OPACITY_50 } from '@/lib/chart-colors';

const MAX_COMPARE = 4;
const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const WEAPONS_BY_CATEGORY = WEAPON_CATEGORIES.map(cat => ({
  category: cat,
  weapons: WEAPONS.filter(w => w.category === cat),
}));

function weaponDps(w: Weapon): number {
  const mid = parseDamageMidpoint(w.baseDamage);
  const speed = parseFloat(w.attackSpeed);
  const crit = parseInt(w.critChance);
  return mid / speed * (1 + crit / 100);
}

export function MetricsTab() {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const compared = useMemo(
    () => compareIds.map(id => WEAPONS.find(w => w.id === id)!).filter(Boolean),
    [compareIds],
  );

  const comparedDps = useMemo(
    () => compared.map(w => ({ weapon: w, dps: weaponDps(w) })).sort((a, b) => b.dps - a.dps),
    [compared],
  );

  const compareDpsMax = comparedDps.length > 0 ? comparedDps[0].dps : 1;

  /** Combos for compared weapons (by category). */
  const comparedCombos = useMemo(() => {
    if (compared.length === 0) return [];
    const cats = new Set(compared.map(w => w.category));
    return COMBO_SEQUENCES.filter(c => cats.has(c.weaponCategory));
  }, [compared]);

  return (
    <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* Weapon Comparison Selector */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label={`Weapon DPS Comparison (${compareIds.length}/${MAX_COMPARE})`} color={ACCENT} icon={Swords} />
        <p className="text-xs text-text-muted font-mono mb-2">Select 2-4 weapons to compare DPS side-by-side.</p>
        <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2">
          {WEAPONS_BY_CATEGORY.map(({ category, weapons }) => (
            <div key={category}>
              <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1 sticky top-0 bg-surface-deep/80 backdrop-blur-sm py-0.5 px-1">{category} ({weapons.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
                {weapons.map(w => {
                  const sel = compareIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleCompare(w.id)}
                      disabled={!sel && compareIds.length >= MAX_COMPARE}
                      className="px-2 py-1.5 rounded border text-xs font-mono text-left transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                      style={{
                        borderColor: sel ? withOpacity(w.color, OPACITY_30) : 'var(--border)',
                        backgroundColor: sel ? withOpacity(w.color, OPACITY_10) : 'transparent',
                        color: sel ? w.color : 'var(--text-muted)',
                      }}
                    >
                      <div className="truncate font-bold" style={{ color: sel ? w.color : 'var(--text)' }}>{w.name}</div>
                      <div className="text-2xs">{w.tier}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {comparedDps.length >= 2 && (
          <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
            {comparedDps.map(({ weapon, dps }) => (
              <div key={weapon.id} className="flex items-center gap-2 px-1 py-0.5">
                <span className="text-xs font-mono text-text w-[140px] flex-shrink-0 truncate">{weapon.name}</span>
                <div className="flex-1"><NeonBar pct={(dps / compareDpsMax) * 100} color={weapon.color} /></div>
                <span className="text-xs font-mono font-bold w-[60px] text-right" style={{ color: weapon.color }}>{dps.toFixed(0)} DPS</span>
              </div>
            ))}
          </div>
        )}
        {comparedCombos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 block">Related Combos ({comparedCombos.length})</span>
            <div className="space-y-1">
              {comparedCombos.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs font-mono px-1 py-0.5">
                  <span className="text-text w-[130px] truncate">{c.name}</span>
                  <span className="text-text-muted w-[60px]">{c.weaponCategory}</span>
                  <span className="text-text-muted w-[40px]">{c.hits}h</span>
                  <div className="flex-1"><NeonBar pct={(c.dps / DPS_MAX) * 100} color={ACCENT} /></div>
                  <span className="font-bold w-[55px] text-right" style={{ color: ACCENT }}>{c.dps} DPS</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BlueprintPanel>

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
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">DPS by Weapon Category</span>
            <div className="bg-surface-deep/30 rounded-lg p-2 mt-2">
              <GroupedDpsBarChart />
            </div>
            <details className="mt-2">
              <summary className="text-xs font-mono text-text-muted cursor-pointer hover:text-text transition-colors">Cumulative Damage (5s)</summary>
              <div className="bg-surface-deep/30 rounded-lg p-2 mt-1">
                <CumulativeDamageSvg />
              </div>
            </details>
          </div>
        </BlueprintPanel>

        <div className="space-y-4">
          {/* Combat Flow Sankey */}
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Combat Flow Sankey" color={ACCENT} icon={Activity} />
            <div className="mt-3">
              <ProportionalSankey />
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
      {/* Stat Influence */}
      <StatInfluencePanel moduleId="combat-action-map" />
      {/* Ability Reference */}
      <AbilityQuickPicker />
    </motion.div>
  );
}

/* ── Cumulative Damage SVG ─────────────────────────────────────────────── */

function CumulativeDamageSvg() {
  return (
    <svg width="100%" height="150" viewBox="0 0 260 60" className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {[0, 20, 40, 60].map(y => <line key={y} x1="30" y1={y + 5} x2="255" y2={y + 5} stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth="1" />)}
      {CUMULATIVE_POINTS.map((t) => <text key={t} x={30 + t * 45} y="78" textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>{t}s</text>)}
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

/* ── Proportional Sankey SVG ───────────────────────────────────────────── */

const SANKEY_SVG_W = 380;
const SANKEY_SVG_H = 190;
const SANKEY_NODE_W = 60;
const SANKEY_MARGIN = 18;
const SANKEY_GAP = 4;

const SANKEY_COL_X = Array.from(
  { length: SANKEY_COLUMNS.length },
  (_, i) => 25 + i * ((SANKEY_SVG_W - SANKEY_NODE_W - 50) / (SANKEY_COLUMNS.length - 1)),
);

interface SankeyNode { x: number; y: number; h: number; color: string; label: string; pct: number }

const SANKEY_NODE_MAP = new Map<string, SankeyNode>();
for (let ci = 0; ci < SANKEY_COLUMNS.length; ci++) {
  const items = SANKEY_COLUMNS[ci].items;
  const totalGap = (items.length - 1) * SANKEY_GAP;
  const usableH = SANKEY_SVG_H - SANKEY_MARGIN - totalGap;
  let y = SANKEY_MARGIN;
  for (const item of items) {
    const h = Math.max(10, (item.pct / 100) * usableH);
    SANKEY_NODE_MAP.set(item.id, { x: SANKEY_COL_X[ci], y, h, color: item.color ?? ACCENT, label: item.label, pct: item.pct });
    y += h + SANKEY_GAP;
  }
}

/* Pre-compute flow band paths at module scope */
const SANKEY_FLOW_PATHS: { d: string; color: string }[] = (() => {
  const rightY = new Map<string, number>();
  const leftY = new Map<string, number>();
  for (const [id, node] of SANKEY_NODE_MAP) {
    rightY.set(id, node.y);
    leftY.set(id, node.y);
  }
  const paths: { d: string; color: string }[] = [];
  for (const flow of SANKEY_FLOWS) {
    const src = SANKEY_NODE_MAP.get(flow.source);
    const tgt = SANKEY_NODE_MAP.get(flow.target);
    if (!src || !tgt) continue;
    const srcH = (flow.value / src.pct) * src.h;
    const tgtH = (flow.value / tgt.pct) * tgt.h;
    const x1 = src.x + SANKEY_NODE_W;
    const y1 = rightY.get(flow.source)!;
    rightY.set(flow.source, y1 + srcH);
    const x2 = tgt.x;
    const y2 = leftY.get(flow.target)!;
    leftY.set(flow.target, y2 + tgtH);
    const mx = (x1 + x2) / 2;
    paths.push({
      d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2} L ${x2} ${y2 + tgtH} C ${mx} ${y2 + tgtH}, ${mx} ${y1 + srcH}, ${x1} ${y1 + srcH} Z`,
      color: flow.color ?? ACCENT,
    });
  }
  return paths;
})();

function ProportionalSankey() {
  return (
    <svg width="100%" height={SANKEY_SVG_H + 10} viewBox={`0 0 ${SANKEY_SVG_W} ${SANKEY_SVG_H + 10}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {/* Column labels */}
      {SANKEY_COLUMNS.map((col, ci) => (
        <text key={col.label} x={SANKEY_COL_X[ci] + SANKEY_NODE_W / 2} y={12} textAnchor="middle" style={{ fontSize: 9 }} className="font-mono font-bold uppercase" fill="var(--text-muted)">{col.label}</text>
      ))}
      {/* Flow bands */}
      {SANKEY_FLOW_PATHS.map((fp, i) => (
        <path key={i} d={fp.d} fill={fp.color} opacity={0.18} />
      ))}
      {/* Nodes */}
      {Array.from(SANKEY_NODE_MAP.entries()).map(([id, node]) => (
        <g key={id}>
          <rect x={node.x} y={node.y} width={SANKEY_NODE_W} height={node.h} rx={2}
            fill={withOpacity(node.color, OPACITY_8)} stroke={node.color} strokeWidth={0.5} strokeOpacity={0.5} />
          {node.h >= 16 ? (
            <>
              <text x={node.x + SANKEY_NODE_W / 2} y={node.y + node.h / 2 - 1} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono" fill={node.color}>{node.label}</text>
              <text x={node.x + SANKEY_NODE_W / 2} y={node.y + node.h / 2 + 9} textAnchor="middle" style={{ fontSize: 7 }} className="font-mono font-bold" fill={node.color}>{node.pct}%</text>
            </>
          ) : (
            <text x={node.x + SANKEY_NODE_W + 4} y={node.y + node.h / 2 + 3} style={{ fontSize: 7 }} className="font-mono" fill={node.color}>{node.label} {node.pct}%</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Grouped DPS Bar Chart ────────────────────────────────────────────── */

const DPS_GROUPS = WEAPON_CATEGORIES.map(cat => {
  const weapons = WEAPONS.filter(w => w.category === cat);
  const dpsList = weapons.map(w => ({ weapon: w, dps: weaponDps(w) })).sort((a, b) => b.dps - a.dps);
  const avgDps = dpsList.reduce((s, d) => s + d.dps, 0) / dpsList.length;
  return { category: cat, weapons: dpsList, avgDps };
});
const DPS_GLOBAL_MAX = Math.max(...WEAPONS.map(w => weaponDps(w)));

function GroupedDpsBarChart() {
  const [hoveredWeapon, setHoveredWeapon] = useState<Weapon | null>(null);

  const svgW = 520;
  const svgH = 200;
  const mTop = 10, mRight = 10, mBottom = 22, mLeft = 36;
  const chartW = svgW - mLeft - mRight;
  const chartH = svgH - mTop - mBottom;
  const groupW = chartW / DPS_GROUPS.length;

  return (
    <div className="relative">
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = mTop + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line x1={mLeft} y1={y} x2={svgW - mRight} y2={y} stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} />
              <text x={mLeft - 4} y={y + 3} textAnchor="end" style={{ fontSize: 7 }} className="font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>{Math.round(DPS_GLOBAL_MAX * pct)}</text>
            </g>
          );
        })}
        {/* Bars by category */}
        {DPS_GROUPS.map((group, gi) => {
          const gx = mLeft + gi * groupW;
          const barW = Math.max(2, (groupW - 6) / group.weapons.length - 1);
          return (
            <g key={group.category}>
              <text x={gx + groupW / 2} y={svgH - 4} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono uppercase" fill="var(--text-muted)">{group.category}</text>
              {group.weapons.map((entry, bi) => {
                const barH = Math.max(1, (entry.dps / DPS_GLOBAL_MAX) * chartH);
                const x = gx + 3 + bi * (barW + 1);
                const y = mTop + chartH - barH;
                const isHov = hoveredWeapon?.id === entry.weapon.id;
                return (
                  <rect key={entry.weapon.id} x={x} y={y} width={barW} height={barH} rx={1}
                    fill={isHov ? entry.weapon.color : withOpacity(entry.weapon.color, OPACITY_50)}
                    onMouseEnter={() => setHoveredWeapon(entry.weapon)}
                    onMouseLeave={() => setHoveredWeapon(null)}
                    style={{ cursor: 'pointer' }} />
                );
              })}
              {/* Category avg line */}
              <line x1={gx + 2} y1={mTop + chartH - (group.avgDps / DPS_GLOBAL_MAX) * chartH}
                x2={gx + groupW - 2} y2={mTop + chartH - (group.avgDps / DPS_GLOBAL_MAX) * chartH}
                stroke={ACCENT} strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />
            </g>
          );
        })}
      </svg>
      {/* Hover tooltip */}
      {hoveredWeapon && (
        <div className="absolute top-1 right-1 p-2 rounded border text-xs font-mono z-10" style={{
          backgroundColor: 'var(--surface-deep)',
          borderColor: withOpacity(hoveredWeapon.color, OPACITY_30),
        }}>
          <div className="font-bold" style={{ color: hoveredWeapon.color }}>{hoveredWeapon.name}</div>
          <div className="text-text-muted mt-1 space-y-0.5">
            <div>Damage: {hoveredWeapon.baseDamage}</div>
            <div>Speed: {hoveredWeapon.attackSpeed}</div>
            <div>Crit: {hoveredWeapon.critChance}</div>
            <div className="font-bold mt-1" style={{ color: hoveredWeapon.color }}>DPS: {weaponDps(hoveredWeapon).toFixed(1)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
