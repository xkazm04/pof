'use client';

import { ACCENT, STAT_LABELS } from './constants';

/* ── Affix Saturation Heatmap ─────────────────────────────────────────── */

interface AffixBracket {
  level: number;
  affixSaturation: Record<string, number>;
}

export function AffixHeatmap({ brackets }: { brackets: AffixBracket[] }) {
  const allStats = Array.from(
    new Set(brackets.flatMap((b) => Object.keys(b.affixSaturation))),
  ).sort();

  if (allStats.length === 0) {
    return <p className="text-xs text-text-muted italic">No affix data</p>;
  }

  const maxVal = Math.max(
    ...brackets.flatMap((b) => Object.values(b.affixSaturation)),
    0.01,
  );

  const cellSize = 22;
  const labelW = 50;
  const width = labelW + brackets.length * (cellSize + 1);
  const height = allStats.length * (cellSize + 1) + 20;

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Row labels */}
        {allStats.map((stat, ri) => (
          <text
            key={stat} x={labelW - 4}
            y={ri * (cellSize + 1) + cellSize / 2 + 4}
            textAnchor="end" className="fill-[var(--text-muted)]"
            style={{ fontSize: 11 }}
          >
            {STAT_LABELS[stat] ?? stat}
          </text>
        ))}

        {/* Cells */}
        {brackets.map((b, ci) => (
          <g key={b.level}>
            {allStats.map((stat, ri) => {
              const val = b.affixSaturation[stat] ?? 0;
              const intensity = val / maxVal;
              return (
                <rect
                  key={stat}
                  x={labelW + ci * (cellSize + 1)}
                  y={ri * (cellSize + 1)}
                  width={cellSize} height={cellSize} rx={2}
                  fill={ACCENT}
                  opacity={0.1 + intensity * 0.8}
                >
                  <title>Lv{b.level} {stat}: {(val * 100).toFixed(1)}%</title>
                </rect>
              );
            })}
            {ci % Math.max(1, Math.floor(brackets.length / 8)) === 0 && (
              <text
                x={labelW + ci * (cellSize + 1) + cellSize / 2}
                y={allStats.length * (cellSize + 1) + 14}
                textAnchor="middle" className="fill-[var(--text-muted)]"
                style={{ fontSize: 11 }}
              >
                {b.level}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
