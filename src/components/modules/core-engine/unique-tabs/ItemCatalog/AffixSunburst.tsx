'use client';

import type { ProbabilityEntry } from '@/types/unique-tab-improvements';
import { ACCENT } from './data';
import { STATUS_SUBDUED } from '@/lib/chart-colors';

/* ── Affix Sunburst SVG Component ──────────────────────────────────────── */

export function AffixSunburst({ tree, size }: { tree: ProbabilityEntry; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 30;
  const ring1Inner = 40;
  const ring1Outer = 80;
  const ring2Inner = 85;
  const ring2Outer = 120;

  const describeArc = (
    cxA: number, cyA: number, rInner: number, rOuter: number,
    startAngle: number, endAngle: number,
  ): string => {
    const cos1 = Math.cos(startAngle);
    const sin1 = Math.sin(startAngle);
    const cos2 = Math.cos(endAngle);
    const sin2 = Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1o = cxA + rOuter * cos1;
    const y1o = cyA + rOuter * sin1;
    const x2o = cxA + rOuter * cos2;
    const y2o = cyA + rOuter * sin2;
    const x1i = cxA + rInner * cos1;
    const y1i = cyA + rInner * sin1;
    const x2i = cxA + rInner * cos2;
    const y2i = cyA + rInner * sin2;
    return `M${x1o},${y1o} A${rOuter},${rOuter} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${rInner},${rInner} 0 ${large} 0 ${x1i},${y1i} Z`;
  };

  const arcs: { d: string; fill: string; label: string; midAngle: number; midR: number }[] = [];

  if (tree.children) {
    let cumAngle = -Math.PI / 2;
    for (const child of tree.children) {
      const angle = child.probability * 2 * Math.PI;
      const midAngle = cumAngle + angle / 2;
      const midR = (ring1Inner + ring1Outer) / 2;
      arcs.push({
        d: describeArc(cx, cy, ring1Inner, ring1Outer, cumAngle, cumAngle + angle),
        fill: child.color ?? STATUS_SUBDUED,
        label: `${child.label} (${(child.probability * 100).toFixed(0)}%)`,
        midAngle, midR,
      });
      if (child.children && child.children.length > 0) {
        let childCum = cumAngle;
        for (const grandchild of child.children) {
          const childAngle = grandchild.probability * angle;
          const gcMidAngle = childCum + childAngle / 2;
          const gcMidR = (ring2Inner + ring2Outer) / 2;
          arcs.push({
            d: describeArc(cx, cy, ring2Inner, ring2Outer, childCum, childCum + childAngle),
            fill: grandchild.color ?? child.color ?? STATUS_SUBDUED,
            label: `${grandchild.label} (${(grandchild.probability * 100).toFixed(0)}%)`,
            midAngle: gcMidAngle, midR: gcMidR,
          });
          childCum += childAngle;
        }
      }
      cumAngle += angle;
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <circle cx={cx} cy={cy} r={innerR} fill={`${tree.color ?? ACCENT}20`} stroke={tree.color ?? ACCENT} strokeWidth="1.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        className="text-sm font-bold font-mono" fill={tree.color ?? ACCENT} style={{ fontSize: 12 }}>
        {tree.label}
      </text>
      {arcs.map((arc, i) => (
        <g key={i}>
          <path d={arc.d} fill={`${arc.fill}40`} stroke={arc.fill} strokeWidth="1"
            className="hover:opacity-80 transition-opacity cursor-default">
            <title>{arc.label}</title>
          </path>
        </g>
      ))}
      {arcs.filter((_, i) => i < (tree.children?.length ?? 0)).map((arc, i) => {
        const lx = cx + (arc.midR + 5) * Math.cos(arc.midAngle);
        const ly = cy + (arc.midR + 5) * Math.sin(arc.midAngle);
        return (
          <text key={`label-${i}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            className="text-[11px] font-mono fill-[var(--text-muted)] pointer-events-none" style={{ fontSize: 11 }}>
            {arc.label.split('(')[0].trim()}
          </text>
        );
      })}
    </svg>
  );
}
