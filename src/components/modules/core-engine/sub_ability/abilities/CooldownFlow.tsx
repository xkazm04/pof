'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  ACCENT_PURPLE_BOLD, ACCENT_GREEN, STATUS_WARNING,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_25,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../../unique-tabs/_shared';
import { useSpellbookData } from '../_shared/context';
import { CooldownWheel } from './CooldownWheel';

export function CooldownFlow() {
  const { COOLDOWN_ABILITIES } = useSpellbookData();
  const [selectedCooldownAbility, setSelectedCooldownAbility] = useState(0);

  return (
    <SurfaceCard level={2} className="p-3 relative overflow-hidden">
      <div className="absolute right-0 bottom-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }} />
      <SectionLabel icon={Clock} label="Cooldown Flow" color={ACCENT_PURPLE_BOLD} />
      <div className="flex flex-wrap gap-1.5 mb-3 mt-3">
        {COOLDOWN_ABILITIES.map((ability, i) => (
          <button key={ability.name} onClick={() => setSelectedCooldownAbility(i)}
            className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all cursor-pointer ${
              selectedCooldownAbility === i ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
            }`}
            style={selectedCooldownAbility === i ? {
              backgroundColor: withOpacity(ability.color, OPACITY_8),
              borderColor: withOpacity(ability.color, OPACITY_25),
              color: ability.color,
            } : {
              backgroundColor: 'transparent',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}>
            {ability.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 justify-center flex-wrap">
        <CooldownWheel ability={COOLDOWN_ABILITIES[selectedCooldownAbility]} index={0} />
        <div className="text-sm text-text-muted space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold" style={{ color: COOLDOWN_ABILITIES[selectedCooldownAbility].color }}>
              {COOLDOWN_ABILITIES[selectedCooldownAbility].name}
            </span>
          </div>
          <div className="text-sm font-mono">Cooldown: {COOLDOWN_ABILITIES[selectedCooldownAbility].cd}s</div>
          <div className="text-sm font-mono">Remaining: {COOLDOWN_ABILITIES[selectedCooldownAbility].remaining}s</div>
          <div className="text-sm font-mono">
            Status: {COOLDOWN_ABILITIES[selectedCooldownAbility].remaining === 0 ? (
              <span className="font-bold" style={{ color: ACCENT_GREEN }}>Ready</span>
            ) : (
              <span className="font-bold" style={{ color: STATUS_WARNING }}>On Cooldown</span>
            )}
          </div>
        </div>
      </div>
      {/* All cooldowns overview */}
      <div className="flex items-center gap-4 justify-center flex-wrap mt-4 pt-3 border-t border-border/30">
        {COOLDOWN_ABILITIES.map((ab, i) => (
          <CooldownWheel key={ab.name} ability={ab} index={i} />
        ))}
      </div>
    </SurfaceCard>
  );
}
