'use client';

import { Crosshair, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, STATUS_NEUTRAL, HEATMAP_HIGH, HEATMAP_MID, HEATMAP_LOW } from '@/lib/chart-colors';
import { HeatmapGrid } from '../_shared';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import {
  ACCENT, TRACE_FRAMES, HIT_STATS,
  DMG_TYPES, ARMOR_TYPES, EFFECTIVENESS_DATA,
  PROJECTILE_PATHS,
} from './data';

export function HitsTab() {
  return (
    <motion.div key="hits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
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
            <div className="flex items-center gap-4 mt-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
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
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: path.color }}>{path.label}</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted space-y-0.5">
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
      <path d="M 20,100 Q 50,20 90,15 Q 130,10 160,30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="28" strokeLinecap="round" />
      {TRACE_FRAMES.map((frame, i) => (
        <g key={i}>
          <circle cx={frame.cx} cy={frame.cy} r={frame.r} fill={frame.hit ? `${STATUS_ERROR}30` : 'rgba(255,255,255,0.05)'} stroke={frame.hit ? STATUS_ERROR : STATUS_NEUTRAL} strokeWidth="1.5" strokeDasharray={frame.hit ? 'none' : '3 2'} />
          {frame.hit && <circle cx={frame.cx} cy={frame.cy} r={frame.r + 3} fill="none" stroke={STATUS_ERROR} strokeWidth="0.5" opacity="0.4" />}
          <text x={frame.cx} y={frame.cy + 3} textAnchor="middle" className="text-[11px] font-mono" fill={frame.hit ? STATUS_ERROR : STATUS_NEUTRAL} style={{ fontSize: 11 }}>
            {frame.hit ? 'HIT' : 'MISS'}
          </text>
        </g>
      ))}
      <path d={`M ${TRACE_FRAMES[0].cx},${TRACE_FRAMES[0].cy} ${TRACE_FRAMES.slice(1).map(f => `L ${f.cx},${f.cy}`).join(' ')}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
}

/* ── Projectile SVG ────────────────────────────────────────────────────── */

function ProjectileSvg() {
  return (
    <svg width="338" height="150" viewBox="0 0 180 80" className="w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
      <line x1="5" y1="90" x2="195" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <circle cx="180" cy="25" r="6" fill="none" stroke={STATUS_ERROR} strokeWidth="1" opacity="0.5" />
      <circle cx="180" cy="25" r="3" fill={`${STATUS_ERROR}50`} />
      <text x="180" y="18" textAnchor="middle" className="text-[11px] font-mono" fill={STATUS_ERROR} style={{ fontSize: 11 }}>TARGET</text>
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
