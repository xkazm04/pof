'use client';

import { useState, useMemo } from 'react';
import { Radar, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN, OVERLAY_WHITE,
  OPACITY_5, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_37,
  GLOW_SM, GLOW_MD,
  withOpacity,
  OPACITY_8,
} from '@/lib/chart-colors';
import { RadarChart } from '../../_shared';
import { BlueprintPanel, SectionHeader, CornerBrackets } from '../design';
import { COMPARISON_STATS, deviationColor, type BalanceResult } from '../data';

const TOP_N = 5;

interface ArchetypeBalanceRadarProps {
  balanceResults: BalanceResult[];
  scoreMean: number;
}

export function ArchetypeBalanceRadar({ balanceResults, scoreMean }: ArchetypeBalanceRadarProps) {
  const [showAll, setShowAll] = useState(false);
  const needsTruncation = balanceResults.length >= 10;

  const displayResults = useMemo(() => {
    if (!needsTruncation || showAll) return balanceResults;
    return [...balanceResults]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, TOP_N);
  }, [balanceResults, showAll, needsTruncation]);
  return (
    <BlueprintPanel className="p-4" color={ACCENT_CYAN}>
      <div className="flex items-center gap-3 mb-1">
        <SectionHeader icon={Radar} label="Balance Radar" color={ACCENT_CYAN} />
        {needsTruncation && (
          <button
            onClick={() => setShowAll(p => !p)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold border border-border/30 text-text-muted hover:text-text hover:border-border transition-colors cursor-pointer ml-auto"
          >
            {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAll ? 'Show Top 5' : `Show All (${balanceResults.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
        {/* ── Left: Scores + Heatmap ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Composite score badges */}
          <div className="flex flex-wrap gap-2">
            {displayResults.map((br, i) => {
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
                  style={{ borderColor: withOpacity(br.color, OPACITY_15), backgroundColor: withOpacity(br.color, OPACITY_5) }}
                >
                  {/* Hover glow */}
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ backgroundColor: withOpacity(br.color, OPACITY_12) }} />

                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 relative z-[1]"
                    style={{ backgroundColor: br.color, boxShadow: `0 0 6px ${withOpacity(br.color, OPACITY_37)}` }} />
                  <div className="relative z-[1]">
                    <div className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: br.color }}>{br.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-mono font-bold tabular-nums text-text"
                        style={{ textShadow: `${GLOW_MD} ${withOpacity(br.color, OPACITY_20)}` }}>
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
                  <tr className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_5) }}>
                    <th className="text-left py-1.5 pr-3 text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted w-20">Stat</th>
                    {displayResults.map(br => (
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
                      className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_5) }}
                    >
                      <td className="py-1.5 pr-3 text-xs font-bold text-text-muted">{stat.stat}</td>
                      {displayResults.map(br => {
                        const dev = br.deviations[si];
                        const color = deviationColor(dev);
                        const sign = dev >= 0 ? '+' : '';
                        return (
                          <td key={br.name} className="py-1.5 px-2 text-center">
                            <motion.span
                              whileHover={{ scale: 1.1 }}
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold tabular-nums min-w-[44px]"
                              style={{ backgroundColor: `${withOpacity(color, OPACITY_8)}`, color, border: `1px solid ${withOpacity(color, OPACITY_12)}` }}
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
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_12), border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}` }} />
                <span style={{ color: STATUS_SUCCESS }}>Balanced</span> (&lt;10%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_12), border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_20)}` }} />
                <span style={{ color: STATUS_WARNING }}>Mild</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_12), border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_20)}` }} />
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
              data={displayResults[0]?.normalizedStats.map((v, i) => ({
                axis: COMPARISON_STATS[i].stat,
                value: v,
              })) ?? []}
              size={240}
              accent={displayResults[0]?.color ?? ACCENT_CYAN}
              overlays={displayResults.slice(1).map(br => ({
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
            {displayResults.map(br => (
              <span key={br.name} className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: br.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: br.color, boxShadow: `${GLOW_SM} ${withOpacity(br.color, OPACITY_37)}` }} />
                {br.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
