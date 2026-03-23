'use client';

import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { RadarChart } from '../_shared';
import type { ArchetypeConfig } from './data';
import { RADAR_DATA } from './data';

interface ComparisonPanelProps {
  selected: ArchetypeConfig;
  compare: ArchetypeConfig;
  accent: string;
}

export function ComparisonPanel({ selected, compare, accent }: ComparisonPanelProps) {
  return (
    <BlueprintPanel color={accent} className="p-4 mb-4">
      <SectionHeader icon={Target} label="Side-by-Side Comparison" color={accent} />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
        {[selected, compare].map((arch) => (
          <div key={arch.id} className="space-y-3">
            {/* Archetype header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: `${arch.color}20` }}
              >
                <arch.icon className="w-3.5 h-3.5" style={{ color: arch.color }} />
              </div>
              <span className="text-sm font-bold" style={{ color: arch.color }}>
                {arch.label}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                {arch.class} / {arch.role}
              </span>
            </div>

            {/* Stat bars */}
            <div className="space-y-2">
              {arch.stats.map(stat => {
                const otherArch = arch.id === selected.id ? compare : selected;
                const otherStat = otherArch.stats.find(s => s.label === stat.label);
                const diff = otherStat ? stat.value - otherStat.value : 0;
                return (
                  <div key={stat.label} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-14 text-right flex-shrink-0">
                      {stat.label}
                    </span>
                    <div className="flex-1">
                      <NeonBar pct={stat.value} color={arch.color} />
                    </div>
                    <span className="text-sm font-mono font-bold text-text w-8 text-right">
                      {stat.value}
                    </span>
                    {diff !== 0 && (
                      <span className={`text-xs font-mono font-bold w-10 text-right ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Abilities */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">
                Abilities
              </div>
              <div className="flex flex-wrap gap-1">
                {arch.abilities.map(ab => (
                  <span
                    key={ab}
                    className="text-xs font-bold px-1.5 py-0.5 rounded border bg-surface text-text"
                    style={{ borderColor: `${arch.color}40` }}
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
                <RadarChart data={RADAR_DATA[arch.id]} size={140} accent={arch.color} showLabels />
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
