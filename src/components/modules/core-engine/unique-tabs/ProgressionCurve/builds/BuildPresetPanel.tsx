'use client';

import { Settings2 } from 'lucide-react';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, BUILD_PRESETS, BUILD_STATS } from '../data';

import { withOpacity, OPACITY_15, OPACITY_12, OPACITY_50, OPACITY_5, OPACITY_10 } from '@/lib/chart-colors';
interface BuildPresetPanelProps {
  activeBuild: number;
  setActiveBuild: (idx: number) => void;
}

export function BuildPresetPanel({ activeBuild, setActiveBuild }: BuildPresetPanelProps) {
  const currentBuild = BUILD_PRESETS[activeBuild];

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader label="Build Preset" icon={Settings2} color={ACCENT} />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {BUILD_PRESETS.map((bp, idx) => {
          const Icon = bp.icon;
          const isActive = activeBuild === idx;
          return (
            <button key={bp.name} onClick={() => setActiveBuild(idx)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border"
              style={{
                borderColor: isActive ? bp.color : `${withOpacity(bp.color, OPACITY_15)}`,
                backgroundColor: isActive ? `${withOpacity(bp.color, OPACITY_12)}` : 'transparent',
                color: isActive ? bp.color : `${withOpacity(bp.color, OPACITY_50)}`,
              }}>
              <Icon className="w-3.5 h-3.5" />
              {bp.name}
            </button>
          );
        })}
      </div>
      {/* Active build stats */}
      <div className="rounded-md border p-2.5" style={{ borderColor: `${withOpacity(currentBuild.color, OPACITY_12)}`, backgroundColor: `${withOpacity(currentBuild.color, OPACITY_5)}` }}>
        <div className="flex items-center gap-2 mb-2">
          {(() => { const Icon = currentBuild.icon; return <Icon className="w-4 h-4" style={{ color: currentBuild.color }} />; })()}
          <span className="text-sm font-mono font-bold" style={{ color: currentBuild.color }}>{currentBuild.name}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {BUILD_STATS.map((stat) => (
            <div key={stat} className="text-center">
              <div className="text-[10px] font-mono text-text-muted uppercase">{stat.slice(0, 3)}</div>
              <div className="text-xs font-mono font-bold" style={{ color: currentBuild.color }}>{currentBuild.stats[stat]}</div>
              <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${withOpacity(currentBuild.color, OPACITY_10)}` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${currentBuild.stats[stat]}%`, backgroundColor: currentBuild.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
