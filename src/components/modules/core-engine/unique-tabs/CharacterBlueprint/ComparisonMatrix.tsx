'use client';

import { BarChart3, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, ACCENT_VIOLET, OVERLAY_WHITE } from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, NeonBar } from './design';
import { COMPARISON_STATS, COMPARISON_CHARACTERS, type ComparisonCharacter } from './data';

interface ComparisonMatrixProps {
  selectedCharacters: Set<string>;
  visibleCharacters: ComparisonCharacter[];
  onToggleCharacter: (name: string) => void;
}

export function ComparisonMatrix({ selectedCharacters, visibleCharacters, onToggleCharacter }: ComparisonMatrixProps) {
  return (
    <BlueprintPanel className="p-4" color={ACCENT_VIOLET}>
      <SectionHeader icon={BarChart3} label="Character Comparison" color={ACCENT_VIOLET} />

      {/* ── Character selector pills ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {COMPARISON_CHARACTERS.map((ch, i) => {
          const active = selectedCharacters.has(ch.name);
          return (
            <motion.button
              key={ch.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * MOTION_CONFIG.stagger }}
              onClick={() => onToggleCharacter(ch.name)}
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-all cursor-pointer overflow-hidden"
              style={active ? {
                backgroundColor: `${ch.color}10`,
                borderColor: `${ch.color}35`,
                color: ch.color,
              } : {
                backgroundColor: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
                opacity: 0.5,
              }}
            >
              {active && (
                <span className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ch.color}40, transparent)` }} />
              )}
              <motion.span
                className="w-2 h-2 rounded-full flex-shrink-0"
                animate={{ scale: active ? 1 : 0.6 }}
                style={{
                  backgroundColor: active ? ch.color : 'var(--text-muted)',
                  boxShadow: active ? `0 0 6px ${ch.color}` : 'none',
                }}
              />
              {ch.name}
            </motion.button>
          );
        })}
      </div>

      {/* ── Comparison table ──────────────────────────────────────────── */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: `${OVERLAY_WHITE}08` }}>
              <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted w-24">Stat</th>
              {visibleCharacters.map(ch => (
                <th key={ch.name} className="py-2 px-3 text-xs font-bold uppercase tracking-[0.15em] text-center"
                  style={{ color: ch.color }}>
                  {ch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_STATS.map((stat, si) => {
              const values = visibleCharacters.map(ch => ch.values[si]);
              const maxV = Math.max(...values);
              return (
                <motion.tr
                  key={stat.stat}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: si * MOTION_CONFIG.stagger }}
                  className="border-b hover:bg-surface/20 transition-colors"
                  style={{ borderColor: `${OVERLAY_WHITE}04` }}
                >
                  <td className="py-3 pr-4 font-bold text-text-muted">
                    {stat.stat}
                    {stat.unit && <span className="text-[9px] opacity-50 ml-0.5">({stat.unit})</span>}
                  </td>
                  {visibleCharacters.map(ch => {
                    const val = ch.values[si];
                    const barPct = (val / stat.maxVal) * 100;
                    const isBest = val === maxV && visibleCharacters.length > 1;
                    return (
                      <td key={ch.name} className="py-3 px-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <NeonBar pct={barPct} color={ch.color} height={6} glow={isBest} />
                          <span className="flex items-center gap-1 tabular-nums" style={{
                            color: isBest ? STATUS_SUCCESS : 'var(--text)',
                            fontWeight: isBest ? 700 : 500,
                          }}>
                            {isBest && <Crown className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} />}
                            {val}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/10 text-xs font-mono text-text-muted">
        <Crown className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
        <span className="font-bold" style={{ color: STATUS_SUCCESS }}>Crown</span> = highest in stat
        <span className="ml-auto">{visibleCharacters.length} of {COMPARISON_CHARACTERS.length} visible</span>
      </div>
    </BlueprintPanel>
  );
}
