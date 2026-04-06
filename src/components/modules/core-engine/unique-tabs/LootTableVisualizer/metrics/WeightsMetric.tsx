'use client';

import { RARITY_TIERS, TOTAL_WEIGHT } from '../data';
import { withOpacity, OPACITY_25 } from '@/lib/chart-colors';

const CX = 14;
const CY = 14;
const R = 12;

/** Pre-compute pie slice paths outside render to avoid mutable reassignment */
const SLICES = (() => {
  let cumAngle = -Math.PI / 2;
  return RARITY_TIERS.map((tier) => {
    const sliceAngle = (tier.weight / TOTAL_WEIGHT) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(cumAngle);
    const y1 = CY + R * Math.sin(cumAngle);
    cumAngle += sliceAngle;
    const x2 = CX + R * Math.cos(cumAngle);
    const y2 = CY + R * Math.sin(cumAngle);
    const large = sliceAngle > Math.PI ? 1 : 0;
    return {
      name: tier.name,
      weight: tier.weight,
      color: tier.color,
      d: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`,
    };
  });
})();

export function WeightsMetric() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 28 28"
      aria-hidden="true"
      className="block"
    >
      {SLICES.map((s) => (
        <path
          key={s.name}
          d={s.d}
          fill={s.color}
          stroke="transparent"
          style={{ filter: `drop-shadow(0 0 2px ${withOpacity(s.color, OPACITY_25)})` }}
        >
          <title>{s.name}: {s.weight}%</title>
        </path>
      ))}
    </svg>
  );
}
