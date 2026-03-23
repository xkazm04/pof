'use client';

import { STATUS_SUCCESS } from '@/lib/chart-colors';
import type { CharacterGenome } from '@/types/character-genome';
import { COMP_STATS } from './field-data';

/* ── Genome Comparison Table ─────────────────────────────────────────── */

export function GenomeComparisonTable({ genomes, activeId }: {
  genomes: CharacterGenome[];
  activeId: string;
}) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-border/40">
          <th className="text-left py-2 pr-4 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-32">Stat</th>
          {genomes.map((g) => (
            <th key={g.id} className="py-2 px-2 text-[10px] font-mono uppercase tracking-[0.15em] text-center" style={{ color: g.color }}>
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/20">
        {COMP_STATS.map((stat) => {
          const values = genomes.map((g) => stat.getValue(g));
          const bestVal = stat.higherIsBetter ? Math.max(...values) : Math.min(...values);
          const maxVal = Math.max(...values);

          return (
            <tr key={stat.label} className="hover:bg-surface/30 transition-colors">
              <td className="py-2 pr-4 font-mono font-bold text-text-muted">
                {stat.label} {stat.unit && <span className="text-xs opacity-60">({stat.unit})</span>}
              </td>
              {genomes.map((g, i) => {
                const val = values[i];
                const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const isBest = val === bestVal;
                const isActive = g.id === activeId;
                return (
                  <td key={g.id} className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-2 bg-surface-deep rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: g.color,
                            boxShadow: isBest ? `0 0 6px ${g.color}60` : 'none',
                            opacity: isActive ? 1 : 0.7,
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs w-10" style={{
                        color: isBest ? STATUS_SUCCESS : 'var(--text-muted)',
                        fontWeight: isBest ? 700 : 400,
                      }}>
                        {val}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
