'use client';

import { useState } from 'react';
import { OVERLAY_WHITE, withOpacity, OPACITY_4, OPACITY_30, OPACITY_50 } from '@/lib/chart-colors';
import { ACCENT } from '../_shared/data';
import { WEAPONS, parseDamageMidpoint } from '../_shared/data-metrics';
import type { Weapon, WeaponCategory } from '../_shared/data-metrics';

const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];

function weaponDps(w: Weapon): number {
  const mid = parseDamageMidpoint(w.baseDamage);
  const speed = parseFloat(w.attackSpeed);
  const crit = parseInt(w.critChance);
  return mid / speed * (1 + crit / 100);
}

/* ── Grouped DPS Bar Chart ────────────────────────────────────────────── */

const DPS_GROUPS = WEAPON_CATEGORIES.map(cat => {
  const weapons = WEAPONS.filter(w => w.category === cat);
  const dpsList = weapons.map(w => ({ weapon: w, dps: weaponDps(w) })).sort((a, b) => b.dps - a.dps);
  const avgDps = dpsList.reduce((s, d) => s + d.dps, 0) / dpsList.length;
  return { category: cat, weapons: dpsList, avgDps };
});
const DPS_GLOBAL_MAX = Math.max(...WEAPONS.map(w => weaponDps(w)));

export function GroupedDpsBarChart() {
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
