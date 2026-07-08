'use client';

import { Mountain } from 'lucide-react';
import { ACCENT_VIOLET, ACCENT_ORANGE } from '@/lib/chart-colors';
import { SVG_CENTER, MOCK_OBSTACLES } from './constants';

interface CoverObstaclesProps {
  scale: number;
}

export function CoverObstacles({ scale }: CoverObstaclesProps) {
  return (
    <>
      {/* Obstacles */}
      {MOCK_OBSTACLES.map((obs) => {
        const sx = SVG_CENTER + obs.x * scale;
        const sy = SVG_CENTER + obs.y * scale;
        const sw = obs.w * scale;
        const sh = obs.h * scale;

        if (obs.type === 'pillar') {
          return (
            <g key={obs.id}>
              <circle
                cx={sx} cy={sy} r={sw / 2}
                fill={ACCENT_VIOLET}
                fillOpacity={0.3}
                stroke={ACCENT_VIOLET}
                strokeWidth={1}
                opacity={0.7}
              />
              <text
                x={sx} y={sy - sw / 2 - 4}
                textAnchor="middle"
                className="text-[11px] font-mono"
                fill={ACCENT_VIOLET} opacity={0.7}
              >
                {obs.label}
              </text>
            </g>
          );
        }

        if (obs.type === 'elevation') {
          return (
            <g key={obs.id}>
              <rect
                x={sx - sw / 2} y={sy - sh / 2}
                width={sw} height={sh} rx={3}
                fill={ACCENT_ORANGE}
                fillOpacity={0.2}
                stroke={ACCENT_ORANGE}
                strokeWidth={1}
                opacity={0.7}
                strokeDasharray="3 2"
              />
              <g transform={`translate(${sx - 5}, ${sy - 5})`}>
                <Mountain
                  className="w-2.5 h-2.5"
                  style={{ color: ACCENT_ORANGE }}
                />
              </g>
              <text
                x={sx} y={sy + sh / 2 + 8}
                textAnchor="middle"
                className="text-[11px] font-mono"
                fill={ACCENT_ORANGE} opacity={0.7}
              >
                {obs.label} (+{obs.elevation}UU)
              </text>
            </g>
          );
        }

        // Wall
        return (
          <g key={obs.id}>
            <rect
              x={sx - sw / 2} y={sy - sh / 2}
              width={sw} height={sh} rx={2}
              fill={ACCENT_VIOLET}
              fillOpacity={0.25}
              stroke={ACCENT_VIOLET}
              strokeWidth={1}
              opacity={0.7}
            />
            <text
              x={sx} y={sy - sh / 2 - 4}
              textAnchor="middle"
              className="text-[11px] font-mono"
              fill={ACCENT_VIOLET} opacity={0.7}
            >
              {obs.label}
            </text>
          </g>
        );
      })}
    </>
  );
}
