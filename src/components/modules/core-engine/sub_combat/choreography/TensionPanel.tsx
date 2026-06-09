'use client';

import {
  Drama, Flame, HeartPulse, TrendingUp, TrendingDown, Wind, CircleSlash, Minus,
  type LucideIcon,
} from 'lucide-react';
import { withOpacity, OPACITY_10, OPACITY_25, OPACITY_50, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { TensionCurve, DramaticBeatType } from '@/lib/combat/tension-curve';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { BEAT_STYLES } from './types';

const BEAT_ICONS: Record<DramaticBeatType, LucideIcon> = {
  climax: Flame,
  'near-death': HeartPulse,
  comeback: TrendingUp,
  breather: Wind,
  'dead-zone': CircleSlash,
  anticlimax: TrendingDown,
  'flat-pacing': Minus,
};

/**
 * The "story beat sheet": a designer-facing read of the encounter's dramatic
 * arc — headline summary, peak/climax/pacing-range stats, and the ordered list
 * of detected beats. Each beat seeks the timeline scrub head when clicked, so
 * the panel and the arc overlay stay in lock-step.
 */
export function TensionPanel({ tensionCurve, onSeek }: { tensionCurve: TensionCurve; onSeek?: (t: number) => void }) {
  const { beats, peakTension, climaxTimeSec, dynamicRange, summary } = tensionCurve;

  return (
    <BlueprintPanel className="p-3 space-y-3">
      <SectionHeader label="Dramatic Arc" icon={Drama} />

      <p className="text-xs font-mono text-text leading-relaxed">{summary}</p>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Peak tension" value={`${Math.round(peakTension * 100)}%`} />
        <Stat label="Climax" value={`${climaxTimeSec}s`} />
        <Stat label="Pacing range" value={`${Math.round(dynamicRange * 100)}%`} />
      </div>

      {beats.length === 0 ? (
        <div className="flex items-center gap-2 p-2 rounded-md border"
          style={{ borderColor: withOpacity(STATUS_SUCCESS, OPACITY_25), backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_10) }}>
          <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>
            No notable beats — flat encounter
          </span>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1" role="group" aria-label="Dramatic beats">
          {beats.map((beat, i) => {
            const style = BEAT_STYLES[beat.type];
            const Icon = BEAT_ICONS[beat.type];
            return (
              <button
                key={i}
                onClick={() => onSeek?.(beat.timeSec)}
                title={beat.detail}
                className="shrink-0 w-40 text-left p-2 rounded-md border transition-colors hover:border-border-bright"
                style={{ borderColor: withOpacity(style.color, OPACITY_25), backgroundColor: withOpacity(style.color, OPACITY_10) }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 shrink-0" style={{ color: style.color }} />
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.1em] truncate" style={{ color: style.color }}>
                    {style.label}
                  </span>
                  <span className="ml-auto text-xs font-mono tabular-nums" style={{ color: withOpacity(style.color, OPACITY_50) }}>
                    {beat.timeSec}s
                  </span>
                </div>
                <p className="mt-1 text-xs font-mono text-text-muted leading-snug line-clamp-2">{beat.detail}</p>
              </button>
            );
          })}
        </div>
      )}
    </BlueprintPanel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-1.5 rounded-md bg-black/30 border border-border/30 text-center">
      <div className="text-sm font-mono font-bold text-text">{value}</div>
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</div>
    </div>
  );
}
