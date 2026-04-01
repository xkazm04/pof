'use client';

import { Radar } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN, OVERLAY_WHITE } from '@/lib/chart-colors';
import { RadarChart } from '../_shared';
import { BlueprintPanel, SectionHeader, CornerBrackets } from './design';
import { COMPARISON_STATS, deviationColor, type BalanceResult } from './data';

interface ArchetypeBalanceRadarProps {
  balanceResults: BalanceResult[];
  scoreMean: number;
}

export function ArchetypeBalanceRadar({ balanceResults, scoreMean }: ArchetypeBalanceRadarProps) {
  return (
    <BlueprintPanel className="p-4" color={ACCENT_CYAN}>
      <SectionHeader icon={Radar} label="Balance Radar" color={ACCENT_CYAN} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
        {/* ── Left: Scores + Heatmap ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Composite score badges */}
          <div className="flex flex-wrap gap-2">
            {balanceResults.map((br, i) => {
              const delta = br.compositeScore - scoreMean;
              const deltaSign = delta >= 0 ? '+' : '';
              const deltaColor = Math.abs(delta) < 0.03 ? STATUS_SUCCESS
                : Math.abs(delta) < 0.08 ? STATUS_WARNING : STATUS_ERROR;
              return (
                <motion.div
                  key={br.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border overflow-hidden group"
                  style={{ borderColor: `${br.color}25`, backgroundColor: `${br.color}06` }}
                >
                  {/* Hover glow */}
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ backgroundColor: `${br.color}20` }} />

                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 relative z-[1]"
                    style={{ backgroundColor: br.color, boxShadow: `0 0 6px ${br.color}60` }} />
                  <div className="relative z-[1]">
                    <div className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: br.color }}>{br.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-mono font-bold tabular-nums text-text"
                        style={{ textShadow: `0 0 8px ${br.color}30` }}>
                        {(br.compositeScore * 100).toFixed(0)}
                      </span>
                      <span className="text-xs font-mono font-bold tabular-nums" style={{ color: deltaColor }}>
                        ({deltaSign}{(delta * 100).toFixed(1)})
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Deviation heatmap */}
          <div className="relative rounded-lg border border-border/15 p-3 overflow-hidden">
            <CornerBrackets size={8} color={ACCENT_CYAN} />
            <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
              Stat Deviation Heatmap
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b" style={{ borderColor: `${OVERLAY_WHITE}08` }}>
                    <th className="text-left py-1.5 pr-3 text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted w-20">Stat</th>
                    {balanceResults.map(br => (
                      <th key={br.name} className="py-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-center"
                        style={{ color: br.color }}>
                        {br.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_STATS.map((stat, si) => (
                    <motion.tr
                      key={stat.stat}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: si * 0.04 }}
                      className="border-b" style={{ borderColor: `${OVERLAY_WHITE}04` }}
                    >
                      <td className="py-1.5 pr-3 text-xs font-bold text-text-muted">{stat.stat}</td>
                      {balanceResults.map(br => {
                        const dev = br.deviations[si];
                        const color = deviationColor(dev);
                        const sign = dev >= 0 ? '+' : '';
                        return (
                          <td key={br.name} className="py-1.5 px-2 text-center">
                            <motion.span
                              whileHover={{ scale: 1.1 }}
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold tabular-nums min-w-[44px]"
                              style={{ backgroundColor: `${color}12`, color, border: `1px solid ${color}20` }}
                            >
                              {sign}{(dev * 100).toFixed(0)}%
                            </motion.span>
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/10 text-[9px] font-mono text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: `${STATUS_SUCCESS}20`, border: `1px solid ${STATUS_SUCCESS}30` }} />
                <span style={{ color: STATUS_SUCCESS }}>Balanced</span> (&lt;10%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: `${STATUS_WARNING}20`, border: `1px solid ${STATUS_WARNING}30` }} />
                <span style={{ color: STATUS_WARNING }}>Mild</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: `${STATUS_ERROR}20`, border: `1px solid ${STATUS_ERROR}30` }} />
                <span style={{ color: STATUS_ERROR }}>Outlier</span> (&ge;25%)
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Overlay Radar Chart ──────────────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative p-2 rounded-lg border border-border/10">
            <CornerBrackets size={8} color={ACCENT_CYAN} />
            <RadarChart
              data={balanceResults[0]?.normalizedStats.map((v, i) => ({
                axis: COMPARISON_STATS[i].stat,
                value: v,
              })) ?? []}
              size={240}
              accent={balanceResults[0]?.color ?? ACCENT_CYAN}
              overlays={balanceResults.slice(1).map(br => ({
                label: br.name,
                color: br.color,
                data: br.normalizedStats.map((v, i) => ({
                  axis: COMPARISON_STATS[i].stat,
                  value: v,
                })),
              }))}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {balanceResults.map(br => (
              <span key={br.name} className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: br.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: br.color, boxShadow: `0 0 4px ${br.color}60` }} />
                {br.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
