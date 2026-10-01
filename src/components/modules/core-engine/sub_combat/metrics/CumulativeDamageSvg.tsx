'use client';

import { OVERLAY_WHITE, withOpacity, OPACITY_4, OPACITY_30 } from '@/lib/chart-colors';
import { WEAPON_ROSTER } from '../_shared/data';

/* ── Cumulative Damage SVG ─────────────────────────────────────────────── */

const SECONDS = [0, 1, 2, 3, 4, 5];
/** The same top 6 the DPS Calculator lists; scale from the roster, not a constant. */
const TOP = WEAPON_ROSTER.rows.slice(0, 6);
const HORIZON = SECONDS[SECONDS.length - 1];
const MAX_DMG = (TOP[0]?.dps || 1) * HORIZON;

export function CumulativeDamageSvg() {
  return (
    <svg width="100%" height="150" viewBox="0 0 260 60" className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {[0, 20, 40, 60].map(y => <line key={y} x1="30" y1={y + 5} x2="255" y2={y + 5} stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth="1" />)}
      {SECONDS.map((t) => <text key={t} x={30 + t * 45} y="78" textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>{t}s</text>)}
      {TOP.map((r) => {
        const pts = SECONDS.map(t => ({ x: 30 + t * 45, y: 65 - ((r.dps * t) / MAX_DMG) * 60 }));
        const d = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
        return (
          <g key={r.id}>
            <title>{`${r.name}: ${Math.round(r.dps * HORIZON)} damage in ${HORIZON}s`}</title>
            <path d={d} fill="none" stroke={r.weapon.color} strokeWidth="1.5" opacity="0.8" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={r.weapon.color} />)}
          </g>
        );
      })}
    </svg>
  );
}
