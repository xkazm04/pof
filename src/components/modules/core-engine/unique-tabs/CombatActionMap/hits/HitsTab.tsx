'use client';

import { useState, useMemo } from 'react';
import { Crosshair, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, STATUS_NEUTRAL, HEATMAP_HIGH, HEATMAP_MID, HEATMAP_LOW,
  OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_6, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { HeatmapGrid } from '../../_shared';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '../../_design';
import {
  ACCENT, TRACE_FRAMES, HIT_STATS,
  DMG_TYPES, ARMOR_TYPES, EFFECTIVENESS_DATA,
  PROJECTILE_PATHS,
} from '../data';
import { WEAPONS } from '../data-metrics';
import type { Weapon, WeaponCategory } from '../data-metrics';

const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const WEAPONS_BY_CAT = WEAPON_CATEGORIES.map(cat => ({
  category: cat,
  weapons: WEAPONS.filter(w => w.category === cat),
}));

/** Derive per-weapon hit stats from weapon properties (deterministic). */
function deriveHitStats(wp: Weapon) {
  const speed = parseFloat(wp.attackSpeed);
  const crit = parseInt(wp.critChance);
  const [lo, hi] = wp.baseDamage.split('-').map(Number);
  const avgDmg = (lo + hi) / 2;
  // Fast weapons have higher hit rate; heavy weapons hit harder per swing
  const hitRate = Math.min(95, Math.round(70 + (1.5 - speed) * 20));
  const hitsPerSwing = speed < 1.0 ? 2.5 : speed < 1.4 ? 1.8 : 1.2;
  const traceCoverage = Math.min(95, Math.round(60 + avgDmg * 1.2));
  return { hitRate, hitsPerSwing, traceCoverage, crit, avgDmg };
}

export function HitsTab() {
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);

  const selectedWeapon = useMemo(
    () => selectedWeaponId ? WEAPONS.find(w => w.id === selectedWeaponId) ?? null : null,
    [selectedWeaponId],
  );

  const weaponStats = useMemo(
    () => selectedWeapon ? deriveHitStats(selectedWeapon) : null,
    [selectedWeapon],
  );

  return (
    <motion.div key="hits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* Per-Weapon Hit Stats */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Per-Weapon Hit Analysis" color={ACCENT} icon={Crosshair} />
        <div className="mt-2 mb-3">
          <select
            value={selectedWeaponId ?? ''}
            onChange={(e) => setSelectedWeaponId(e.target.value || null)}
            className="w-full max-w-xs bg-surface-deep border border-border/30 rounded px-2 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-border/60"
          >
            <option value="">Select a weapon...</option>
            {WEAPONS_BY_CAT.map(({ category, weapons }) => (
              <optgroup key={category} label={category}>
                {weapons.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.tier})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {weaponStats && selectedWeapon && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Hit Rate', value: `${weaponStats.hitRate}%`, pct: weaponStats.hitRate, color: ACCENT },
              { label: 'Hits/Swing', value: weaponStats.hitsPerSwing.toFixed(1), pct: weaponStats.hitsPerSwing / 3 * 100, color: selectedWeapon.color },
              { label: 'Trace Coverage', value: `${weaponStats.traceCoverage}%`, pct: weaponStats.traceCoverage, color: selectedWeapon.color },
              { label: 'Crit Chance', value: `${weaponStats.crit}%`, pct: weaponStats.crit * 5, color: selectedWeapon.color },
              { label: 'Avg Damage', value: weaponStats.avgDmg.toFixed(0), pct: weaponStats.avgDmg / 40 * 100, color: selectedWeapon.color },
            ].map(s => (
              <div key={s.label} className="rounded border p-2" style={{ borderColor: withOpacity(s.color, OPACITY_15), backgroundColor: withOpacity(s.color, OPACITY_5) }}>
                <div className="text-xs font-mono text-text-muted uppercase tracking-[0.1em] mb-1">{s.label}</div>
                <div className="text-sm font-mono font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                <NeonBar pct={Math.min(100, s.pct)} color={s.color} />
              </div>
            ))}
          </div>
        )}
        {!selectedWeapon && (
          <p className="text-xs text-text-muted font-mono">Select a weapon above to see per-weapon hit analysis.</p>
        )}
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Hit Detection Debug */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="Hit Detection Debug" color={ACCENT} icon={Crosshair} />
          <div className="mt-3 flex gap-4 flex-wrap items-start">
            <HitDetectionSvg />
            <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
              {HIT_STATS.map((stat, i) => (
                <GlowStat key={stat.label} label={stat.label} value={stat.value} color={stat.color} delay={i * 0.08} />
              ))}
            </div>
          </div>
        </BlueprintPanel>

        {/* Damage Type Effectiveness */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="Damage Type Effectiveness" color={ACCENT} icon={Flame} />
          <div className="mt-3">
            <HeatmapGrid rows={DMG_TYPES} cols={ARMOR_TYPES} cells={EFFECTIVENESS_DATA} lowColor="#7f1d1d" highColor="#065f46" accent={ACCENT} />
            <div className="flex items-center gap-4 mt-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: HEATMAP_HIGH }} /> Effective</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: HEATMAP_MID }} /> Neutral</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: HEATMAP_LOW }} /> Resisted</span>
            </div>
          </div>
        </BlueprintPanel>

        {/* Projectile Trajectory Planner */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="Projectile Trajectory Planner" color={ACCENT} icon={Target} />
          <div className="mt-3">
            <ProjectileSvg />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PROJECTILE_PATHS.map((path) => (
                <div key={path.label} className="px-2 py-1.5 rounded bg-surface/50 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: path.color }} />
                    <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: path.color }}>{path.label}</span>
                  </div>
                  <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted space-y-0.5">
                    <div>Speed: {path.speed} u/s</div>
                    <div>Flight: {path.flightTime}</div>
                    <div>Range: {path.maxRange}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BlueprintPanel>
      </div>
    </motion.div>
  );
}

/* ── Hit Detection SVG ─────────────────────────────────────────────────── */

function HitDetectionSvg() {
  return (
    <svg width="300" height="188" viewBox="0 0 160 100" className="overflow-visible flex-shrink-0">
      <path d="M 20,100 Q 50,20 90,15 Q 130,10 160,30" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth="28" strokeLinecap="round" />
      {TRACE_FRAMES.map((frame, i) => (
        <g key={i}>
          <circle cx={frame.cx} cy={frame.cy} r={frame.r} fill={frame.hit ? withOpacity(STATUS_ERROR, OPACITY_20) : withOpacity(OVERLAY_WHITE, OPACITY_5)} stroke={frame.hit ? STATUS_ERROR : STATUS_NEUTRAL} strokeWidth="1.5" strokeDasharray={frame.hit ? 'none' : '3 2'} />
          {frame.hit && <circle cx={frame.cx} cy={frame.cy} r={frame.r + 3} fill="none" stroke={STATUS_ERROR} strokeWidth="0.5" opacity="0.4" />}
          <text x={frame.cx} y={frame.cy + 3} textAnchor="middle" className="text-xs font-mono" fill={frame.hit ? STATUS_ERROR : STATUS_NEUTRAL}>
            {frame.hit ? 'HIT' : 'MISS'}
          </text>
        </g>
      ))}
      <path d={`M ${TRACE_FRAMES[0].cx},${TRACE_FRAMES[0].cy} ${TRACE_FRAMES.slice(1).map(f => `L ${f.cx},${f.cy}`).join(' ')}`} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_15)} strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
}

/* ── Projectile SVG ────────────────────────────────────────────────────── */

function ProjectileSvg() {
  return (
    <svg width="338" height="150" viewBox="0 0 180 80" className="w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
      <line x1="5" y1="90" x2="195" y2="90" stroke={withOpacity(OVERLAY_WHITE, OPACITY_10)} strokeWidth="1" />
      <circle cx="180" cy="25" r="6" fill="none" stroke={STATUS_ERROR} strokeWidth="1" opacity="0.5" />
      <circle cx="180" cy="25" r="3" fill={withOpacity(STATUS_ERROR, OPACITY_30)} />
      <text x="180" y="18" textAnchor="middle" className="text-xs font-mono" fill={STATUS_ERROR}>TARGET</text>
      {PROJECTILE_PATHS.map((path) => {
        const d = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
        return (
          <g key={path.label}>
            <path d={d} fill="none" stroke={path.color} strokeWidth="1.5" opacity="0.7" />
            {path.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2" fill={path.color} opacity={i === 0 || i === path.points.length - 1 ? 1 : 0.4} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
