'use client';

import { Hexagon } from 'lucide-react';
import { LEVEL_TYPES } from './constants';
import type { LevelType } from './types';
import type { useRovingRadioGroup } from './useProceduralLevelWizard';

interface LevelTypeSelectorProps {
  levelType: LevelType;
  selectLevelType: (lt: LevelType) => void;
  ltNav: ReturnType<typeof useRovingRadioGroup>;
}

export function LevelTypeSelector({ levelType, selectLevelType, ltNav }: LevelTypeSelectorProps) {
  return (
    <div className="space-y-3 relative z-10 bg-black/40 p-4 rounded-xl border border-violet-900/30 shadow-inner">
      <h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest">
        <Hexagon className="w-3 h-3" /> Output Topology
      </h4>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Level type">
        {LEVEL_TYPES.map((lt, idx) => {
          const isActive = levelType === lt.id;
          const Icon = lt.icon;
          return (
            <button
              key={lt.id}
              ref={(el) => { ltNav.refs.current[idx] = el; }}
              role="radio"
              aria-checked={isActive}
              aria-label={`${lt.label}. ${lt.description}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectLevelType(lt.id)}
              onKeyDown={(e) => ltNav.onKeyDown(e, idx)}
              className="focus-ring-outline relative flex flex-col items-center gap-3 p-4 rounded-xl text-center transition-all group overflow-hidden"
              style={{
                backgroundColor: isActive ? `${lt.color}15` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? `${lt.color}60` : 'rgba(139,92,246,0.1)'}`,
                boxShadow: isActive ? `0 0 20px ${lt.color}15` : 'none',
              }}
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-500"
                style={{
                  borderColor: isActive ? lt.color : 'rgba(139,92,246,0.2)',
                  transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-inner"
                  style={{ backgroundColor: isActive ? `${lt.color}20` : 'transparent', transform: isActive ? 'rotate(-180deg)' : 'rotate(0deg)' }}>
                  <Icon className="w-5 h-5" style={{ color: isActive ? lt.color : 'rgba(139,92,246,0.6)' }} />
                </div>
              </div>
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-wider block mb-1 transition-colors"
                  style={{ color: isActive ? lt.color : 'rgba(200,200,240,0.6)' }}
                >
                  {lt.label}
                </span>
                <span className="text-[11px] text-violet-400/50 uppercase tracking-widest leading-tight block px-2">
                  {lt.description.split(' ').slice(0, 3).join(' ')}...
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
