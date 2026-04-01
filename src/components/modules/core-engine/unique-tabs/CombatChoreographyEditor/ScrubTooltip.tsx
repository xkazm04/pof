'use client';

import { Clock, AlertTriangle } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
} from '@/lib/chart-colors';
import { FEEDBACK_CHANNELS, type ScrubData } from './types';

export function ScrubTooltip({
  displayTime,
  scrubData,
  tooltipLeft,
  containerWidth,
}: {
  displayTime: number;
  scrubData: ScrubData;
  tooltipLeft: number;
  containerWidth: number;
}) {
  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        left: Math.max(90, Math.min(tooltipLeft, containerWidth - 90)),
        top: 0,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      <div
        className="mb-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono tabular-nums whitespace-nowrap"
        style={{
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: 'var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
      >
        <div className="font-bold text-text flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-text-muted" />
          {displayTime.toFixed(1)}s
        </div>
        {scrubData.damageEvent && (
          <div className="text-text-muted mt-0.5">
            <span style={{ color: scrubData.damageEvent.source === 'Player' ? ACCENT_EMERALD : STATUS_ERROR }}>
              {scrubData.damageEvent.source}
            </span>
            {' \u2192 '}
            <span style={{ color: scrubData.damageEvent.target === 'Player' ? STATUS_ERROR : ACCENT_EMERALD }}>
              {scrubData.damageEvent.target}
            </span>
            {' \u00b7 '}
            <span className="text-text">{scrubData.damageEvent.damage}</span>
            {' '}
            <span className="text-text-muted/60">({scrubData.damageEvent.abilityName})</span>
            {scrubData.damageEvent.isCrit && (
              <span className="ml-1 font-bold" style={{ color: STATUS_WARNING }}>CRIT</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {FEEDBACK_CHANNELS.map((ch) => {
            const active = scrubData.feedbackStates[ch.type] !== null;
            return (
              <span key={ch.type} className="flex items-center gap-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: active ? ch.color : 'var(--text-muted)',
                    opacity: active ? 1 : 0.3,
                    boxShadow: active ? `0 0 4px ${ch.color}` : 'none',
                  }}
                />
                <span style={{ color: active ? ch.color : 'var(--text-muted)', opacity: active ? 1 : 0.4 }}>
                  {ch.label}
                </span>
              </span>
            );
          })}
        </div>
        {scrubData.alert && (
          <div
            className="mt-0.5 flex items-center gap-1"
            style={{ color: scrubData.alert.severity === 'critical' ? STATUS_ERROR : scrubData.alert.severity === 'warning' ? STATUS_WARNING : STATUS_INFO }}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            <span className="truncate max-w-[200px]">{scrubData.alert.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
