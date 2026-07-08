'use client';

import { STATUS_INFO, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { ComboSection } from './types';
import { ACCENT } from './constants';

export function RootMotionPreview({ sections }: { sections: ComboSection[] }) {
  const svgW = 200;
  const svgH = 80;
  const totalDist = sections.reduce((s, sec) => s + sec.rootMotionDistance, 0);

  // No root motion at all → every segment would divide by zero (NaN x-positions)
  // and collapse the layout. Short-circuit with a friendly empty state instead.
  if (totalDist <= 0) {
    return (
      <svg width={svgW} height={svgH} className="overflow-visible">
        <line x1={10} y1={svgH - 10} x2={svgW - 10} y2={svgH - 10} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <circle cx={15} cy={svgH - 16} r={4} fill={ACCENT} />
        <text x={15} y={svgH - 24} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT}>Start</text>
        <text x={svgW / 2} y={svgH / 2 + 4} textAnchor="middle" className="text-[11px] font-mono" fill="var(--text-muted)">
          No root motion (0cm)
        </text>
      </svg>
    );
  }

  const sectionSegments = sections.map((sec, i) => {
    const cumDistBefore = sections.slice(0, i).reduce((s, s2) => s + s2.rootMotionDistance, 0);
    const startX = 15 + (cumDistBefore / totalDist) * (svgW - 30);
    const endX = 15 + ((cumDistBefore + sec.rootMotionDistance) / totalDist) * (svgW - 30);
    return { sec, startX, endX };
  });

  return (
    <svg width={svgW} height={svgH} className="overflow-visible">
      {/* Ground line */}
      <line x1={10} y1={svgH - 10} x2={svgW - 10} y2={svgH - 10} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      {/* Character path */}
      {sectionSegments.map(({ sec, startX, endX }, i) => {
        const y = svgH - 16;
        const color = sec.motionWarpTarget ? ACCENT_EMERALD : STATUS_INFO;
        return (
          <g key={i}>
            <line x1={startX} y1={y} x2={endX} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
            <circle cx={endX} cy={y} r={3} fill={color} />
            <text x={(startX + endX) / 2} y={y - 8} textAnchor="middle" className="text-[11px] font-mono" fill={color}>
              {sec.rootMotionDistance}cm
            </text>
            <text x={(startX + endX) / 2} y={svgH - 2} textAnchor="middle" className="text-[11px] font-mono" fill="var(--text-muted)">
              {sec.label.split(' ')[0]}
            </text>
          </g>
        );
      })}
      {/* Start marker */}
      <circle cx={15} cy={svgH - 16} r={4} fill={ACCENT} />
      <text x={15} y={svgH - 24} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT}>Start</text>
      {/* Total distance */}
      <text x={svgW - 10} y={12} textAnchor="end" className="text-[11px] font-mono font-bold" fill="var(--text-muted)">
        Total: {totalDist}cm
      </text>
    </svg>
  );
}
