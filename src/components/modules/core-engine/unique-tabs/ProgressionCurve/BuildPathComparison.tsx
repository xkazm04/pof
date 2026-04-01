'use client';

import { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { RadarChart } from '../_shared';
import { ACCENT, BUILD_PRESETS, BUILD_STATS } from './data';

export function BuildPathComparison() {
  const [buildVisibility, setBuildVisibility] = useState<Record<string, boolean>>({
    Warrior: true, Mage: false, Rogue: false,
  });

  const activeBuilds = BUILD_PRESETS.filter(b => buildVisibility[b.name]);
  const primaryBuild = activeBuilds[0];

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={Crosshair} label="Build Path Comparison" color={ACCENT} />

      <div className="flex items-center gap-3 mt-2.5 mb-2.5">
        {BUILD_PRESETS.map(b => {
          const Icon = b.icon;
          const active = buildVisibility[b.name];
          return (
            <button
              key={b.name}
              onClick={() => setBuildVisibility(prev => ({ ...prev, [b.name]: !prev[b.name] }))}
              aria-pressed={active}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
              style={{
                backgroundColor: active ? `${b.color}${OPACITY_15}` : 'transparent',
                borderColor: active ? `${b.color}${OPACITY_30}` : 'var(--border)',
                color: active ? b.color : 'var(--text-muted)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {b.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex items-center justify-center">
          {primaryBuild ? (
            <RadarChart
              data={primaryBuild.radarData}
              accent={primaryBuild.color}
              overlays={activeBuilds.slice(1).map(b => ({ data: b.radarData, color: b.color, label: b.name }))}
              size={200}
            />
          ) : (
            <div className="text-xs text-text-muted py-8">Select at least one build to compare</div>
          )}
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_repeat(3,60px)] gap-1 text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-2">
            <span>Stat</span>
            {BUILD_PRESETS.map(b => (
              <span key={b.name} className="text-center" style={{ color: buildVisibility[b.name] ? b.color : 'var(--text-muted)', opacity: buildVisibility[b.name] ? 1 : 0.4 }}>
                {b.name.slice(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
          {BUILD_STATS.map(stat => (
            <div key={stat} className="grid grid-cols-[1fr_repeat(3,60px)] gap-1 text-xs font-mono py-1 border-t border-border/20">
              <span className="text-text-muted">{stat}</span>
              {BUILD_PRESETS.map(b => (
                <span
                  key={b.name}
                  className="text-center font-bold"
                  style={{ color: buildVisibility[b.name] ? b.color : 'var(--text-muted)', opacity: buildVisibility[b.name] ? 1 : 0.3 }}
                >
                  {b.stats[stat]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
