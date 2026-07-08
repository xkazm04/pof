'use client';

import type { RefObject } from 'react';
import { Play, Pause, RotateCcw, Swords } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import { ACCENT } from './constants';
import type { PhysicsConfig, DmgParticle, ReadabilityMetrics } from './types';

export function SimulationCanvas({
  isRunning, toggleRunning, reset, particles, totalSpawned,
  canvasRef, canvasH, mobMarkers, metrics, physics,
}: {
  isRunning: boolean;
  toggleRunning: () => void;
  reset: () => void;
  particles: DmgParticle[];
  totalSpawned: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasH: number;
  mobMarkers: { x: number; y: number; index: number }[];
  metrics: ReadabilityMetrics;
  physics: PhysicsConfig;
}) {
  return (
    <SurfaceCard level={2} className="p-3 space-y-2">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: isRunning ? `${STATUS_ERROR}20` : `${STATUS_SUCCESS}20`,
              color: isRunning ? STATUS_ERROR : STATUS_SUCCESS,
              border: `1px solid ${isRunning ? STATUS_ERROR : STATUS_SUCCESS}`,
            }}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="flex items-center gap-3 text-2xs font-mono text-text-muted">
          <span>Active: <span className="text-text font-bold">{particles.length}</span></span>
          <span>Total: <span className="text-text font-bold">{totalSpawned}</span></span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative overflow-hidden rounded-lg border border-border/30"
        style={{
          width: '100%',
          height: canvasH,
          backgroundColor: 'var(--surface-deep, rgb(8,8,15))',
          backgroundImage: 'radial-gradient(circle at 50% 65%, rgba(255,255,255,0.03) 0%, transparent 60%)',
        }}
      >
        {/* Mob position markers */}
        {mobMarkers.map((m) => (
          <div
            key={m.index}
            className="absolute flex flex-col items-center"
            style={{ left: m.x, top: m.y, transform: 'translate(-50%, 0)' }}
          >
            <div
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: `${ACCENT_VIOLET}50`, backgroundColor: `${ACCENT_VIOLET}10` }}
            >
              <Swords className="w-3.5 h-3.5" style={{ color: ACCENT_VIOLET }} />
            </div>
            <span className="text-[11px] font-mono text-text-muted mt-0.5">Mob {m.index + 1}</span>
          </div>
        ))}

        {/* Damage number particles */}
        {particles.map((p) => (
          <div key={p.id} className="absolute pointer-events-none" style={{ willChange: 'transform, opacity' }}>
            {/* Trail particles */}
            {p.trail.map((t, i) => (
              <div
                key={i}
                className="absolute font-bold font-mono"
                style={{
                  left: t.x,
                  top: t.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: t.opacity * 0.3,
                  fontSize: p.fontSize * 0.7,
                  color: p.color,
                  filter: 'blur(1px)',
                }}
              >
                {p.displayText}
              </div>
            ))}
            {/* Main number */}
            <div
              className="absolute font-bold font-mono whitespace-nowrap"
              style={{
                left: p.x,
                top: p.y,
                transform: `translate(-50%, -50%) scale(${p.scale})`,
                opacity: p.opacity,
                fontSize: p.fontSize,
                color: p.color,
                textShadow: `0 0 6px ${p.color}, 0 1px 2px rgba(0,0,0,0.8)`,
                transition: 'none',
              }}
            >
              {p.displayText}
            </div>
          </div>
        ))}

        {/* Fade curve visualization (bottom-right mini chart) */}
        <svg
          className="absolute bottom-1 right-1 pointer-events-none"
          width={60} height={30} viewBox="0 0 60 30"
        >
          <text x={1} y={7} fill="rgba(255,255,255,0.2)" fontSize={5} fontFamily="monospace">fade</text>
          <polyline
            points={Array.from({ length: 20 }, (_, i) => {
              const t = i / 19;
              const alpha = t < physics.fadeStart ? 1 : 1 - ((t - physics.fadeStart) / (1 - physics.fadeStart));
              return `${5 + t * 50},${28 - alpha * 20}`;
            }).join(' ')}
            fill="none" stroke={ACCENT} strokeWidth={1} opacity={0.4}
          />
        </svg>
      </div>

      {/* Readability metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Overlaps', value: metrics.avgOverlaps, color: metrics.avgOverlaps > 3 ? STATUS_ERROR : STATUS_SUCCESS },
          { label: 'Simultaneous', value: metrics.maxSimultaneous, color: metrics.maxSimultaneous > 6 ? STATUS_WARNING : STATUS_SUCCESS },
          { label: 'Read Time', value: `${metrics.avgReadTime}s`, color: metrics.avgReadTime < 0.3 ? STATUS_ERROR : STATUS_SUCCESS },
          { label: 'Clutter', value: metrics.clutterScore, color: metrics.clutterScore > 50 ? STATUS_ERROR : metrics.clutterScore > 25 ? STATUS_WARNING : STATUS_SUCCESS },
        ].map((m) => (
          <div key={m.label} className="rounded-md border border-border/30 bg-surface-deep/50 px-2 py-1.5 text-center">
            <div className="text-xs font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[11px] text-text-muted uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
