'use client';

import { OVERLAY_WHITE, withOpacity, OPACITY_4, OPACITY_30 } from '@/lib/chart-colors';
import { DPS_STRATEGIES, DPS_MAX, CUMULATIVE_POINTS } from '../_shared/data';

/* ── Cumulative Damage SVG ─────────────────────────────────────────────── */

export function CumulativeDamageSvg() {
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
