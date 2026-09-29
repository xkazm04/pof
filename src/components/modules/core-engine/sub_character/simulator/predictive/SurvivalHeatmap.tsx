'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_CYAN, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { SweepCellRef, SweepDiff } from '@/lib/combat/sweep-tuning';
import { survivalColor, survivalBg, type BalanceReport, type HeatmapCell } from './data';

const keyOf = (level: number, encounterIndex: number) => `${level}|${encounterIndex}`;

/** Survival delta in whole percentage points (0 when unchanged or no diff). */
const deltaPts = (delta: number | undefined) => Math.round((delta ?? 0) * 100);

/**
 * Level x encounter survival grid, drawn from the report's OWN axes — a config
 * edited after the run can never redraw old cells against new rows. Cells are
 * buttons (select one to tune it); with a diff, each changed cell carries a
 * +/- pts badge against the previous run.
 */
export function SurvivalHeatmap({ report, diff, selected, onSelect }: {
  report: Pick<BalanceReport, 'heatmap' | 'levels' | 'encounters'>;
  diff?: SweepDiff | null;
  selected?: SweepCellRef | null;
  onSelect?: (cell: HeatmapCell) => void;
}) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const cells = useMemo(
    () => new Map(report.heatmap.map(c => [keyOf(c.playerLevel, c.encounterIndex), c])),
    [report.heatmap],
  );
  const deltas = useMemo(
    () => new Map((diff?.cells ?? []).map(d => [keyOf(d.level, d.encounterIndex), d.survivalDelta])),
    [diff],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left text-text-muted px-1.5 py-1 text-xs font-mono uppercase tracking-[0.15em]">
                Lv.
              </th>
              {report.encounters.map(e => (
                <th key={e.index} className="text-center text-text-muted px-1 py-1 text-xs font-mono uppercase tracking-[0.15em] whitespace-nowrap">
                  {e.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.levels.map(level => (
              <tr key={level}>
                <td className="text-text-muted font-bold px-1.5 py-0.5 border-r border-border/20">
                  {level}
                </td>
                {report.encounters.map(enc => {
                  const cell = cells.get(keyOf(level, enc.index));
                  if (!cell) return <td key={enc.index} className="px-1 py-0.5" />;
                  const pct = Math.round(cell.survivalRate * 100);
                  const pts = deltaPts(deltas.get(keyOf(level, enc.index)));
                  const signed = `${pts > 0 ? '+' : ''}${pts}`;
                  const isSelected = selected?.level === level && selected.encounterIndex === enc.index;
                  return (
                    <td key={enc.index} className="p-0.5" style={{ backgroundColor: survivalBg(cell.survivalRate) }}>
                      <button
                        type="button"
                        aria-label={`Lv.${level} vs ${enc.label}: ${pct}% survival${pts !== 0 ? `, ${signed} pts vs previous run` : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => onSelect?.(cell)}
                        onMouseEnter={() => setHovered(cell)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(cell)}
                        onBlur={() => setHovered(null)}
                        className={`w-full rounded px-1 py-0.5 text-center transition-all hover:ring-1 hover:ring-white/30 ${
                          isSelected ? 'ring-2 ring-white/70' : ''
                        } ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className="font-bold tabular-nums" style={{ color: survivalColor(cell.survivalRate) }}>
                          {pct}%
                        </span>
                        {pts !== 0 && (
                          <span
                            aria-hidden
                            className="ml-1 tabular-nums"
                            style={{ color: pts > 0 ? ACCENT_CYAN : ACCENT_ORANGE }}
                          >
                            {signed}
                          </span>
                        )}
                      </button>
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
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-xs font-mono tabular-nums"
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
