'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN, ACCENT_ORANGE } from '@/lib/chart-colors';
import { SliderParam } from './SliderParam';
import type { PhysicsConfig, PhysicsMode, StackMode } from './types';

export function PhysicsPanel({ showPhysics, setShowPhysics, physics, updatePhysics }: {
  showPhysics: boolean;
  setShowPhysics: Dispatch<SetStateAction<boolean>>;
  physics: PhysicsConfig;
  updatePhysics: (updates: Partial<PhysicsConfig>) => void;
}) {
  return (
    <SurfaceCard level={2} className="p-2.5 space-y-2">
      <button
        onClick={() => setShowPhysics(prev => !prev)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-bold text-text uppercase tracking-wider">Physics</span>
        </div>
        {showPhysics ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>

      {showPhysics && (
        <div className="space-y-1.5">
          <SliderParam label="Lifetime" value={physics.lifetime} min={0.3} max={3} step={0.1} onChange={v => updatePhysics({ lifetime: v })} unit="s" />
          <SliderParam label="Float Dist" value={physics.floatDistance} min={20} max={200} step={5} onChange={v => updatePhysics({ floatDistance: v })} unit="px" />
          <SliderParam label="H-Spread" value={physics.horizontalSpread} min={0} max={80} step={5} onChange={v => updatePhysics({ horizontalSpread: v })} unit="px" />
          <SliderParam label="Fade Start" value={physics.fadeStart} min={0} max={0.9} step={0.05} onChange={v => updatePhysics({ fadeStart: v })} />
          <SliderParam label="Crit Scale" value={physics.critScaleBurst} min={1} max={2.5} step={0.1} onChange={v => updatePhysics({ critScaleBurst: v })} unit="x" />

          {/* Physics mode selector */}
          <div className="space-y-1">
            <span className="text-2xs text-text-muted">Mode</span>
            <div className="grid grid-cols-2 gap-1">
              {(['linear', 'gravity', 'fountain', 'directional'] as PhysicsMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => updatePhysics({ physicsMode: mode })}
                  className="px-2 py-1 rounded text-xs font-mono font-bold uppercase transition-all"
                  style={{
                    backgroundColor: physics.physicsMode === mode ? `${ACCENT_CYAN}20` : 'transparent',
                    color: physics.physicsMode === mode ? ACCENT_CYAN : 'var(--text-muted)',
                    border: `1px solid ${physics.physicsMode === mode ? `${ACCENT_CYAN}50` : 'transparent'}`,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {(physics.physicsMode === 'gravity' || physics.physicsMode === 'fountain' || physics.physicsMode === 'directional') && (
            <SliderParam label="Gravity" value={physics.gravity} min={0} max={500} step={10} onChange={v => updatePhysics({ gravity: v })} unit="px/s²" />
          )}

          {/* Toggles */}
          <div className="space-y-1 pt-1">
            <label className="flex items-center gap-2 text-2xs text-text-muted cursor-pointer">
              <input type="checkbox" checked={physics.collisionAvoidance} onChange={(e) => updatePhysics({ collisionAvoidance: e.target.checked })} className="rounded" />
              Collision Avoidance
            </label>
            {physics.collisionAvoidance && (
              <SliderParam label="Coll Radius" value={physics.collisionRadius} min={8} max={50} step={2} onChange={v => updatePhysics({ collisionRadius: v })} unit="px" />
            )}
            <label className="flex items-center gap-2 text-2xs text-text-muted cursor-pointer">
              <input type="checkbox" checked={physics.trailEnabled} onChange={(e) => updatePhysics({ trailEnabled: e.target.checked })} className="rounded" />
              Particle Trail
            </label>
            {physics.trailEnabled && (
              <SliderParam label="Trail Len" value={physics.trailLength} min={2} max={8} step={1} onChange={v => updatePhysics({ trailLength: v })} />
            )}
          </div>

          {/* Stack mode */}
          <div className="space-y-1">
            <span className="text-2xs text-text-muted">Stacking</span>
            <div className="grid grid-cols-3 gap-1">
              {(['none', 'accumulate', 'merge'] as StackMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => updatePhysics({ stackMode: mode })}
                  className="px-1.5 py-1 rounded text-xs font-mono font-bold transition-all"
                  style={{
                    backgroundColor: physics.stackMode === mode ? `${ACCENT_ORANGE}20` : 'transparent',
                    color: physics.stackMode === mode ? ACCENT_ORANGE : 'var(--text-muted)',
                    border: `1px solid ${physics.stackMode === mode ? `${ACCENT_ORANGE}50` : 'transparent'}`,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {physics.stackMode !== 'none' && (
            <SliderParam label="Stack Win" value={physics.stackWindowMs} min={50} max={500} step={25} onChange={v => updatePhysics({ stackWindowMs: v })} unit="ms" />
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
