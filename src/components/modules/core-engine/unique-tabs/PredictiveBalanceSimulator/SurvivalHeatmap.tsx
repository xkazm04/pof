'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { survivalColor, survivalBg, type HeatmapCell } from './data';

export function SurvivalHeatmap({ cells, levels, enemies }: {
  cells: HeatmapCell[]; levels: number[]; enemies: string[];
}) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const getCell = (level: number, enemy: string) =>
    cells.find(c => c.playerLevel === level && c.enemyLabel === enemy);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left text-text-muted px-1.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em]">
                Lv.
              </th>
              {enemies.map(e => (
                <th key={e} className="text-center text-text-muted px-1 py-1 text-[10px] font-mono uppercase tracking-[0.15em] whitespace-nowrap">
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(level => (
              <tr key={level}>
                <td className="text-text-muted font-bold px-1.5 py-0.5 border-r border-border/20">
                  {level}
                </td>
                {enemies.map(enemy => {
                  const cell = getCell(level, enemy);
                  if (!cell) return <td key={enemy} className="px-1 py-0.5" />;
                  const pct = Math.round(cell.survivalRate * 100);
                  return (
                    <td
                      key={enemy}
                      className="text-center px-1 py-0.5 cursor-default transition-all hover:ring-1 hover:ring-white/30"
                      style={{ backgroundColor: survivalBg(cell.survivalRate) }}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="font-bold" style={{ color: survivalColor(cell.survivalRate) }}>
                        {pct}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-xs font-mono"
          >
            <span className="text-text-muted">Lv.{hovered.playerLevel} vs {hovered.enemyLabel}</span>
            <span style={{ color: survivalColor(hovered.survivalRate) }} className="font-bold">
              {(hovered.survivalRate * 100).toFixed(0)}% survival
            </span>
            <span className="text-text-muted">{hovered.avgTTK.toFixed(1)}s TTK</span>
            <span className="text-text-muted">{hovered.avgDPS.toFixed(1)} DPS</span>
            <span className="text-text-muted">{hovered.avgEHP.toFixed(0)} EHP</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
