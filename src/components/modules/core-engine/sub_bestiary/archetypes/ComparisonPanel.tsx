'use client';

import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { RadarChart } from '../../unique-tabs/_shared';
import type { ArchetypeConfig } from '../_shared/data';
import { RADAR_DATA } from '../_shared/data';

import { ACCENT_EMERALD, ACCENT_RED, withOpacity, OPACITY_12, OPACITY_25 } from '@/lib/chart-colors';

interface ComparisonPanelProps {
  enemies: ArchetypeConfig[];
  accent: string;
}

export function ComparisonPanel({ enemies, accent }: ComparisonPanelProps) {
  /* Unified stat labels across all enemies */
  const allStatLabels = [...new Set(enemies.flatMap(e => e.stats.map(s => s.label)))];

  return (
    <BlueprintPanel color={accent} className="p-4 mb-4">
      <SectionHeader icon={Target} label={`Comparing ${enemies.length} Enemies`} color={accent} />
      <div className={`mt-3 grid gap-6 ${
        enemies.length === 2 ? 'grid-cols-1 md:grid-cols-2'
          : enemies.length === 3 ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      }`}>
        {enemies.map((arch) => (
          <div key={arch.id} className="space-y-3">
            {/* Archetype header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: withOpacity(arch.color, OPACITY_12) }}
              >
                <arch.icon className="w-3.5 h-3.5" style={{ color: arch.color }} />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold block truncate" style={{ color: arch.color }}>
                  {arch.label}
                </span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                  {arch.category} / {arch.role} / {arch.tier}
                </span>
              </div>
            </div>

            {/* Stat bars with cross-enemy diff */}
            <div className="space-y-2">
              {allStatLabels.map(label => {
                const stat = arch.stats.find(s => s.label === label);

                /* This enemy simply doesn't define this stat — say so instead of
                   drawing a 0-length bar and a fabricated negative diff. */
                if (!stat) {
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-10 text-right flex-shrink-0">
                        {label}
                      </span>
                      <span className="flex-1 text-xs font-mono text-text-subtle"
                        title={`${arch.label} has no ${label} stat — not comparable`}>
                        &mdash; not defined
                      </span>
                    </div>
                  );
                }

                const value = stat.value;
                /* Average only over the enemies that actually carry this stat. */
                const peerValues = enemies
                  .filter(e => e.id !== arch.id)
                  .map(e => e.stats.find(s => s.label === label)?.value)
                  .filter((v): v is number => v !== undefined);
                const avgOther = peerValues.length > 0
                  ? Math.round(peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length)
                  : null;
                const diff = avgOther === null ? 0 : value - avgOther;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-10 text-right flex-shrink-0">
                      {label}
                    </span>
                    <div className="flex-1">
                      <NeonBar pct={value} color={arch.color} />
                    </div>
                    <span className="text-sm font-mono font-bold text-text w-6 text-right">
                      {value}
                    </span>
                    {avgOther !== null && diff !== 0 && (
                      <span className="text-xs font-mono font-bold w-8 text-right"
                        style={{ color: diff > 0 ? ACCENT_EMERALD : ACCENT_RED }}
                        title={`vs ${avgOther} — average of the ${peerValues.length} other selected ${peerValues.length === 1 ? 'enemy that defines' : 'enemies that define'} ${label}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Abilities */}
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">
                Abilities
              </div>
              <div className="flex flex-wrap gap-1">
                {arch.abilities.map(ab => (
                  <span
                    key={ab}
                    className="text-xs font-bold px-1.5 py-0.5 rounded border bg-surface text-text"
                    style={{ borderColor: withOpacity(arch.color, OPACITY_25) }}
                  >
                    {ab}
                  </span>
                ))}
              </div>
            </div>

            {/* Radar mini */}
            {RADAR_DATA[arch.id] && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex justify-center mt-2"
              >
                <RadarChart data={RADAR_DATA[arch.id]} size={120} accent={arch.color} showLabels />
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
