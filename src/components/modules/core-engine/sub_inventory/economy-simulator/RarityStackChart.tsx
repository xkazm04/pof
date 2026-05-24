'use client';

import type { ItemRarity } from '@/types/economy-simulator';
import { RARITY_COLORS, RARITY_LABELS } from './constants';

/* ── Rarity Stacked Bar Chart ─────────────────────────────────────────── */

interface RarityBracket {
  level: number;
  rarityDistribution: Record<ItemRarity, number>;
}

export function RarityStackChart({ brackets }: { brackets: RarityBracket[] }) {
  const width = 520;
  const height = 160;
  const pad = { top: 10, right: 20, bottom: 25, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const barWidth = Math.max(2, cw / brackets.length - 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {brackets.map((b, i) => {
        const bx = pad.left + (i / brackets.length) * cw;
        let cumY = 0;
        return (
          <g key={b.level}>
            {RARITY_LABELS.map((rarity) => {
              const pct = b.rarityDistribution[rarity] ?? 0;
              const barH = pct * ch;
              const by = pad.top + ch - cumY - barH;
              cumY += barH;
              return (
                <rect
                  key={rarity} x={bx} y={by} width={barWidth}
                  height={Math.max(0, barH)}
                  fill={RARITY_COLORS[rarity]} opacity={0.8}
                >
                  <title>Lv{b.level} {rarity}: {(pct * 100).toFixed(1)}%</title>
                </rect>
              );
            })}
            {i % Math.max(1, Math.floor(brackets.length / 8)) === 0 && (
              <text
                x={bx + barWidth / 2} y={height - 5}
                textAnchor="middle" className="fill-[var(--text-muted)]"
                style={{ fontSize: 11 }}
              >
                {b.level}
              </text>
            )}
          </g>
        );
      })}

      {/* Y axis */}
      {[0, 0.5, 1].map((pct) => (
        <text
          key={pct} x={pad.left - 5} y={pad.top + ch * (1 - pct) + 4}
          textAnchor="end" className="fill-[var(--text-muted)]" style={{ fontSize: 11 }}
        >
          {Math.round(pct * 100)}%
        </text>
      ))}
    </svg>
  );
}

/* ── Rarity Legend ────────────────────────────────────────────────────── */

export function RarityLegend() {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {RARITY_LABELS.map((r) => (
        <div key={r} className="flex items-center gap-1 text-xs font-mono">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RARITY_COLORS[r] }} />
          <span className="capitalize" style={{ color: RARITY_COLORS[r] }}>{r}</span>
        </div>
      ))}
    </div>
  );
}
