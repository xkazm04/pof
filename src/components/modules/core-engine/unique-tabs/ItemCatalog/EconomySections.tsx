'use client';

import { FlaskConical, MapPin, BarChart3, PieChart } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_MUTED } from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import {
  ACCENT, RARITY_COLORS,
  SAMPLE_RECIPE, CRYSTAL_STAFF_SOURCES,
  RARITY_DIST, LUCK_SCORE,
} from './data';

/* ── Crafting Recipe Section ───────────────────────────────────────────── */

export function CraftingRecipeSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}60, transparent)` }} />
      <SectionHeader icon={FlaskConical} label="Crafting Recipe Preview" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Recipe card showing materials, output, and affix probability ranges.</p>
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-3">
            {SAMPLE_RECIPE.materials.map(mat => (
              <div key={mat.name} className="flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg border"
                style={{ borderColor: `${RARITY_COLORS[mat.rarity] ?? STATUS_MUTED}40`, backgroundColor: `${RARITY_COLORS[mat.rarity] ?? STATUS_MUTED}08` }}>
                <span className="text-text font-bold">{mat.quantity}x</span>
                <span className="text-text-muted">{mat.name}</span>
                <span className="text-[10px] opacity-60" style={{ color: RARITY_COLORS[mat.rarity] }}>{mat.rarity}</span>
              </div>
            ))}
          </div>
          <div className="text-text-muted text-lg font-bold">&rarr;</div>
          <div className="p-3 rounded-lg border-2 text-center min-w-[120px]"
            style={{ borderColor: `${RARITY_COLORS[SAMPLE_RECIPE.outputRarity]}60`, backgroundColor: `${RARITY_COLORS[SAMPLE_RECIPE.outputRarity]}10` }}>
            <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${RARITY_COLORS[SAMPLE_RECIPE.outputRarity]}40` }}>{SAMPLE_RECIPE.output}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS[SAMPLE_RECIPE.outputRarity] }}>{SAMPLE_RECIPE.outputRarity}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[150px]">
          <div className="space-y-1">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-text-muted">Success Rate</span>
              <span className="text-emerald-400 font-bold">{(SAMPLE_RECIPE.successRate * 100).toFixed(0)}%</span>
            </div>
            <NeonBar pct={SAMPLE_RECIPE.successRate * 100} color={STATUS_SUCCESS} glow />
          </div>
          <p className="text-sm font-mono text-text-muted">Cost: <span className="text-amber-400 font-bold" style={{ textShadow: `0 0 12px ${STATUS_WARNING}40` }}>{SAMPLE_RECIPE.cost}g</span></p>
          <div className="mt-1 space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Output Affixes</p>
            {SAMPLE_RECIPE.affixChances.map(ac => (
              <div key={ac.affix} className="flex items-center gap-2 text-sm font-mono">
                <div className="flex-1">
                  <NeonBar pct={ac.chance * 100} color={ac.color} height={4} />
                </div>
                <span className="text-text-muted w-20 truncate">{ac.affix}</span>
                <span style={{ color: ac.color }}>{(ac.chance * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-surface-hover/30"
          style={{ borderColor: `${ACCENT}40`, color: ACCENT, backgroundColor: `${ACCENT}10` }}
          onClick={() => { }}>Simulate 100 Crafts</button>
        <span className="text-[10px] font-mono text-text-muted italic">(Static preview)</span>
      </div>
    </BlueprintPanel>
  );
}

/* ── Drop Source Section ───────────────────────────────────────────────── */

export function DropSourceSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={MapPin} label="Item Drop Source Map" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Trace drop sources for Crystal Staff: enemies, loot tables, and zones.</p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="p-3 rounded-lg border-2 text-center min-w-[110px] flex-shrink-0"
          style={{ borderColor: `${RARITY_COLORS.Rare}60`, backgroundColor: `${RARITY_COLORS.Rare}10` }}>
          <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${RARITY_COLORS.Rare}40` }}>Crystal Staff</p>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS.Rare }}>Rare Staff</p>
        </div>
        <div className="text-text-muted text-lg font-bold">&larr;</div>
        <div className="space-y-3 flex-1 min-w-[200px]">
          {CRYSTAL_STAFF_SOURCES.map(src => (
            <motion.div key={src.name} className="flex items-center gap-3 px-3 py-2 rounded-lg border"
              style={{ borderColor: `${src.color}30`, backgroundColor: `${src.color}08` }}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${src.color}20`, color: src.color }}>
                {src.type === 'enemy' ? 'Enemy' : src.type === 'loot_table' ? 'Loot Table' : 'Zone'}
              </span>
              <span className="text-sm font-mono text-text flex-1">{src.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16"><NeonBar pct={src.dropRate * 100 * 5} color={src.color} height={4} /></div>
                <span className="text-sm font-mono font-bold" style={{ color: src.color, textShadow: `0 0 12px ${src.color}40` }}>
                  {(src.dropRate * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Rarity Distribution Section ───────────────────────────────────────── */

export function RarityDistributionSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={BarChart3} label="Rarity Distribution Analyzer" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Compare expected vs actual inventory rarity at Level 14.</p>
      <div className="space-y-3">
        {RARITY_DIST.map(r => {
          const maxPct = Math.max(r.expected, r.actual);
          const barScale = maxPct > 0 ? 100 / maxPct : 100;
          return (
            <div key={r.rarity} className="space-y-1">
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="font-bold" style={{ color: r.color, textShadow: `0 0 12px ${r.color}40` }}>{r.rarity}</span>
                <span className="text-text-muted">Expected {(r.expected * 100).toFixed(0)}% | Actual {(r.actual * 100).toFixed(0)}%</span>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 space-y-0.5">
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${r.color}12` }}>
                    <div className="h-full rounded-full opacity-50" style={{ width: `${r.expected * barScale}%`, backgroundColor: r.color }} />
                  </div>
                  <NeonBar pct={r.actual * barScale} color={r.color} height={8} />
                </div>
                <div className="w-8 flex flex-col items-center justify-center text-[11px] font-mono">
                  {r.actual > r.expected
                    ? <span className="text-red-400">{'\u25B2'}</span>
                    : r.actual < r.expected
                      ? <span className="text-emerald-400">{'\u25BC'}</span>
                      : <span className="text-text-muted">=</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 text-sm font-mono text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm opacity-50" style={{ backgroundColor: STATUS_MUTED }} /> Expected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_MUTED }} /> Actual</span>
        </div>
        {/* Luck Score */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-deep border" style={{ borderColor: `${ACCENT}20` }}>
          <div className="relative w-10 h-10">
            <svg width={40} height={40} viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none"
                stroke={LUCK_SCORE >= 80 ? STATUS_SUCCESS : LUCK_SCORE >= 50 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - LUCK_SCORE / 100)}`}
                transform="rotate(-90 24 24)" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-mono font-bold text-text">{LUCK_SCORE}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-text">Luck Score</p>
            <p className="text-[10px] font-mono text-text-muted">Based on deviation from expected rarity distribution at Level 14</p>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
