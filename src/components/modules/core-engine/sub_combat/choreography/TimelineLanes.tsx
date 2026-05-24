'use client';

import { AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD,
  OVERLAY_WHITE, withOpacity, OPACITY_25, OPACITY_22, OPACITY_12, OPACITY_30, OPACITY_50, GLOW_SM,
} from '@/lib/chart-colors';
import type { DamageEvent, FeedbackEvent, WaveDef } from '@/lib/combat/choreography-sim';
import {
  FEEDBACK_CHANNELS,
  LANE_PACING_H, LANE_DAMAGE_H, LANE_ALERT_H, LANE_FEEDBACK_H,
  type BalanceAlert,
} from './types';

interface TimelineLanesProps {
  damageEvents: DamageEvent[];
  feedbackEvents: FeedbackEvent[];
  timelineAlerts: BalanceAlert[];
  waves: WaveDef[];
  duration: number;
  totalWidth: number;
  pxPerSec: number;
  playerPath: string;
  enemyPath: string;
  hasAlerts: boolean;
}

/**
 * Renders the scrollable lane content for the UnifiedTimeline (pacing, damage, alerts,
 * feedback channels, time axis). Extracted to keep UnifiedTimeline.tsx under 200 LOC.
 */
export function TimelineLanes({
  damageEvents, feedbackEvents, timelineAlerts, waves,
  duration, totalWidth, pxPerSec, playerPath, enemyPath, hasAlerts,
}: TimelineLanesProps) {
  return (
    <>
      {/* Pacing */}
      <div className="relative bg-black/30 rounded border border-border/20" style={{ height: LANE_PACING_H }}>
        {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
          <div key={i} className="absolute top-0 h-full border-l border-border/10" style={{ left: i * pxPerSec }} />
        ))}
        <svg className="absolute inset-0" width={totalWidth} height={LANE_PACING_H}
          viewBox={`0 0 ${totalWidth} ${LANE_PACING_H}`} preserveAspectRatio="none">
          {playerPath && <path d={playerPath} fill={`${withOpacity(ACCENT_EMERALD, OPACITY_25)}`} stroke={ACCENT_EMERALD} strokeWidth="1.5" />}
          {enemyPath && <path d={enemyPath} fill={`${withOpacity(STATUS_ERROR, OPACITY_22)}`} stroke={STATUS_ERROR} strokeWidth="1.5" />}
        </svg>
        {waves.map((w, i) => (
          <div key={i} className="absolute top-0 h-full flex flex-col items-center pointer-events-none" style={{ left: w.spawnTimeSec * pxPerSec }}>
            <div className="h-full w-px" style={{ backgroundColor: ACCENT_CYAN, opacity: 0.6 }} />
            <span className="absolute top-0 left-1 text-xs font-mono font-bold whitespace-nowrap"
              style={{ color: ACCENT_CYAN, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>W{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Damage */}
      <div className="relative bg-black/30 rounded border border-border/20" style={{ height: LANE_DAMAGE_H }}>
        {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
          <div key={i} className="absolute top-0 h-full border-l border-border/10" style={{ left: i * pxPerSec }} />
        ))}
        {damageEvents.map((evt, i) => {
          const x = evt.timeSec * pxPerSec;
          const isPlayerDmg = evt.source === 'Player';
          const color = isPlayerDmg ? ACCENT_EMERALD : STATUS_ERROR;
          const h = Math.min(24, 6 + (evt.damage / 20));
          return (
            <div key={i} className="absolute bottom-0.5 rounded-t"
              style={{ left: x - 1, width: 3, height: h, backgroundColor: color, opacity: evt.isCrit ? 1 : 0.7, boxShadow: evt.isCrit ? `${GLOW_SM} ${color}` : 'none' }}
              title={`${evt.timeSec}s: ${evt.source} → ${evt.target} (${evt.abilityName}) ${evt.damage}${evt.isCrit ? ' CRIT' : ''}`}
            />
          );
        })}
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="relative bg-black/20 rounded border border-border/10" style={{ height: LANE_ALERT_H }}>
          {timelineAlerts.map((alert, i) => {
            const color = alert.severity === 'critical' ? STATUS_ERROR : alert.severity === 'warning' ? STATUS_WARNING : STATUS_INFO;
            const x = (alert.timeSec ?? 0) * pxPerSec;
            return (
              <div key={i} className="absolute top-0 flex items-center justify-center" style={{ left: x - 8, width: 16, height: LANE_ALERT_H }}>
                <div className="absolute top-0 h-full w-px opacity-30" style={{ backgroundColor: color }} />
                <div className="relative z-10 flex items-center justify-center rounded-full w-3.5 h-3.5"
                  style={{ backgroundColor: `${withOpacity(color, OPACITY_12)}`, border: `1.5px solid ${color}`, boxShadow: `0 0 6px ${withOpacity(color, OPACITY_25)}` }}>
                  <AlertTriangle className="w-2 h-2" style={{ color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feedback channels */}
      {FEEDBACK_CHANNELS.map((ch) => {
        const channelEvents = feedbackEvents.filter((e) => e.type === ch.type);
        return (
          <div key={ch.type} className="relative bg-black/20 rounded border border-border/10" style={{ height: LANE_FEEDBACK_H }}>
            {channelEvents.map((evt, i) => (
              <div key={i} className="absolute top-0.5 rounded-sm"
                style={{ left: evt.timeSec * pxPerSec, width: Math.max(3, evt.durationSec * pxPerSec), height: 10, backgroundColor: `${withOpacity(ch.color, OPACITY_30)}`, border: `1px solid ${withOpacity(ch.color, OPACITY_50)}` }}
                title={evt.label} />
            ))}
          </div>
        );
      })}

      {/* Time axis */}
      <div className="relative" style={{ height: 14 }}>
        {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
          <span key={i} className="absolute top-0 text-[9px] font-mono text-text-muted/40" style={{ left: i * pxPerSec + 1 }}>{i}s</span>
        ))}
      </div>
    </>
  );
}

interface TimelineLaneLabelsProps {
  hasAlerts: boolean;
}

export function TimelineLaneLabels({ hasAlerts }: TimelineLaneLabelsProps) {
  return (
    <>
      <div className="flex items-center" style={{ height: LANE_PACING_H }}>
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Pacing</span>
      </div>
      <div className="flex items-center" style={{ height: LANE_DAMAGE_H }}>
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Damage</span>
      </div>
      {hasAlerts && (
        <div className="flex items-center" style={{ height: LANE_ALERT_H }}>
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: STATUS_WARNING }}>Alerts</span>
        </div>
      )}
      {FEEDBACK_CHANNELS.map((ch) => (
        <div key={ch.type} className="flex items-center" style={{ height: LANE_FEEDBACK_H }}>
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ch.color }}>{ch.label}</span>
        </div>
      ))}
      <div style={{ height: 14 }} />
    </>
  );
}
