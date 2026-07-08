'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  ACCENT_CYAN, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_20,
} from '@/lib/chart-colors';
import {
  MIN_POINTS, MAX_POINTS, MIN_DISTANCE, MAX_DISTANCE,
  PROJECT_DOWN, PROJECT_UP,
} from './constants';

interface AttackRingControlsProps {
  numPoints: number;
  setNumPoints: Dispatch<SetStateAction<number>>;
  attackDist: number;
  setAttackDist: Dispatch<SetStateAction<number>>;
  innerRing: boolean;
  setInnerRing: Dispatch<SetStateAction<boolean>>;
}

export function AttackRingControls({ numPoints, setNumPoints, attackDist, setAttackDist, innerRing, setInnerRing }: AttackRingControlsProps) {
  return (
    <div className="w-full xl:w-56 space-y-3 flex-shrink-0">
      {/* NumberOfPoints slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-text-muted">NumberOfPoints</span>
          <span className="text-xs font-mono font-bold" style={{ color: ACCENT_CYAN }}>{numPoints}</span>
        </div>
        <input
          type="range"
          min={MIN_POINTS}
          max={MAX_POINTS}
          step={1}
          value={numPoints}
          onChange={e => setNumPoints(Number(e.target.value))}
          data-testid="attack-ring-num-points"
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${ACCENT_CYAN} 0%, ${ACCENT_CYAN} ${((numPoints - MIN_POINTS) / (MAX_POINTS - MIN_POINTS)) * 100}%, rgba(255,255,255,0.1) ${((numPoints - MIN_POINTS) / (MAX_POINTS - MIN_POINTS)) * 100}%, rgba(255,255,255,0.1) 100%)`,
          }}
        />
        <div className="flex justify-between text-[11px] font-mono text-text-muted mt-0.5">
          <span>{MIN_POINTS}</span>
          <span>ClampMin={MIN_POINTS}, ClampMax={MAX_POINTS}</span>
          <span>{MAX_POINTS}</span>
        </div>
      </div>

      {/* AttackDistance slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-text-muted">AttackDistance</span>
          <span className="text-xs font-mono font-bold" style={{ color: ACCENT_CYAN }}>{attackDist}u</span>
        </div>
        <input
          type="range"
          min={MIN_DISTANCE}
          max={MAX_DISTANCE}
          step={10}
          value={attackDist}
          onChange={e => setAttackDist(Number(e.target.value))}
          data-testid="attack-ring-distance"
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${ACCENT_CYAN} 0%, ${ACCENT_CYAN} ${((attackDist - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * 100}%, rgba(255,255,255,0.1) ${((attackDist - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * 100}%, rgba(255,255,255,0.1) 100%)`,
          }}
        />
        <div className="flex justify-between text-[11px] font-mono text-text-muted mt-0.5">
          <span>{MIN_DISTANCE}</span>
          <span>ClampMin={MIN_DISTANCE}</span>
          <span>{MAX_DISTANCE}</span>
        </div>
      </div>

      {/* Inner ring toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-text-muted">bGenerateInnerRing</div>
          <div className="text-[11px] text-text-muted">Inner ring at {Math.round(attackDist * 0.5)}u (50%)</div>
        </div>
        <button
          onClick={() => setInnerRing(v => !v)}
          data-testid="attack-ring-inner-toggle"
          className="text-xs font-mono font-bold px-2.5 py-1 rounded border transition-all"
          style={{
            backgroundColor: innerRing ? `${ACCENT_VIOLET}${OPACITY_20}` : 'transparent',
            color: innerRing ? ACCENT_VIOLET : 'var(--text-muted)',
            borderColor: innerRing ? `${ACCENT_VIOLET}50` : 'var(--border)',
          }}
        >
          {innerRing ? 'true' : 'false'}
        </button>
      </div>

      {/* Nav Projection info */}
      <div className="rounded-lg border border-border/30 p-2 bg-surface-deep/50">
        <div className="text-xs font-mono font-bold text-text mb-1.5">Nav Projection</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-muted">TraceMode</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_SUCCESS }}>Navigation</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-muted">ProjectDown</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_WARNING }}>{PROJECT_DOWN}u</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-muted">ProjectUp</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_WARNING }}>{PROJECT_UP}u</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-muted">bCanProjectDown</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_SUCCESS }}>true</span>
          </div>
        </div>
        {/* Height band indicator */}
        <div className="mt-2 relative h-10 rounded border border-border/20 bg-surface overflow-hidden">
          <div className="absolute inset-x-0 text-center" style={{ top: '15%' }}>
            <div className="h-px w-full" style={{ backgroundColor: `${STATUS_WARNING}40` }} />
            <span className="text-[11px] font-mono" style={{ color: STATUS_WARNING }}>+{PROJECT_UP}u</span>
          </div>
          <div className="absolute inset-x-0 text-center" style={{ top: '40%' }}>
            <div className="h-px w-full" style={{ backgroundColor: `${STATUS_SUCCESS}60` }} />
            <span className="text-[11px] font-mono" style={{ color: STATUS_SUCCESS }}>Ground (0)</span>
          </div>
          <div className="absolute inset-x-0 text-center" style={{ top: '80%' }}>
            <div className="h-px w-full" style={{ backgroundColor: `${STATUS_WARNING}40` }} />
            <span className="text-[11px] font-mono" style={{ color: STATUS_WARNING }}>-{PROJECT_DOWN}u</span>
          </div>
        </div>
      </div>

      {/* UPROPERTY summary */}
      <div className="rounded-lg border border-border/30 p-2 bg-surface-deep/50">
        <div className="text-xs font-mono font-bold text-text mb-1.5">C++ Properties</div>
        {[
          { name: 'CenterContext', value: 'TargetActor', type: 'TSubclassOf<UEnvQueryContext>' },
          { name: 'AttackDistance', value: `${attackDist}.f`, type: 'float' },
          { name: 'NumberOfPoints', value: `${numPoints}`, type: 'int32' },
          { name: 'bGenerateInnerRing', value: innerRing ? 'true' : 'false', type: 'bool' },
        ].map(prop => (
          <div key={prop.name} className="flex items-center gap-1.5 py-0.5">
            <span className="text-[11px] font-mono text-text-muted flex-1 truncate">{prop.name}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: ACCENT_CYAN }}>{prop.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
