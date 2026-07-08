'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Swords, ChevronDown, ChevronRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import { SliderParam } from './SliderParam';
import { ELEMENT_COLORS, ELEMENT_ICONS } from './constants';
import type { CombatConfig, DamageElement } from './types';

export function CombatPanel({ showCombat, setShowCombat, combat, updateCombat }: {
  showCombat: boolean;
  setShowCombat: Dispatch<SetStateAction<boolean>>;
  combat: CombatConfig;
  updateCombat: (updates: Partial<CombatConfig>) => void;
}) {
  return (
    <SurfaceCard level={2} className="p-2.5 space-y-2">
      <button
        onClick={() => setShowCombat(prev => !prev)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
          <span className="text-xs font-bold text-text uppercase tracking-wider">Combat</span>
        </div>
        {showCombat ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>

      {showCombat && (
        <div className="space-y-1.5">
          <SliderParam label="DPS" value={combat.dps} min={100} max={10000} step={100} onChange={v => updateCombat({ dps: v })} />
          <SliderParam label="Atk/sec" value={combat.attacksPerSecond} min={0.5} max={15} step={0.5} onChange={v => updateCombat({ attacksPerSecond: v })} />
          <SliderParam label="Crit Rate" value={combat.critRate} min={0} max={1} step={0.05} onChange={v => updateCombat({ critRate: v })} />
          <SliderParam label="Crit Mult" value={combat.critMultiplier} min={1} max={5} step={0.25} onChange={v => updateCombat({ critMultiplier: v })} unit="x" />
          <SliderParam label="Mobs" value={combat.mobCount} min={1} max={8} step={1} onChange={v => updateCombat({ mobCount: v })} />
          <SliderParam label="Heal %" value={combat.healPercent} min={0} max={0.5} step={0.05} onChange={v => updateCombat({ healPercent: v })} />

          {/* Element mix */}
          <div className="space-y-1 pt-1">
            <span className="text-2xs text-text-muted font-bold uppercase tracking-wider">Element Mix</span>
            {(['physical', 'fire', 'ice', 'lightning'] as DamageElement[]).map(el => {
              const Icon = ELEMENT_ICONS[el];
              return (
                <div key={el} className="flex items-center gap-1.5">
                  <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: ELEMENT_COLORS[el] }} />
                  <span className="text-xs text-text-muted w-14 shrink-0">{el}</span>
                  <input
                    type="range" min={0} max={1} step={0.1} value={combat.elementWeights[el]}
                    onChange={(e) => updateCombat({
                      elementWeights: { ...combat.elementWeights, [el]: Number(e.target.value) },
                    })}
                    className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${ELEMENT_COLORS[el]} ${combat.elementWeights[el] * 100}%, rgba(255,255,255,0.1) ${combat.elementWeights[el] * 100}%)`,
                    }}
                  />
                  <span className="text-xs font-mono text-text-muted w-6 text-right">{(combat.elementWeights[el] * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
