'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { DamageEvent, FeedbackEvent, WaveDef } from '@/lib/combat/choreography-sim';
import {
  FEEDBACK_CHANNELS,
  LANE_PACING_H, LANE_DAMAGE_H, LANE_ALERT_H, LANE_FEEDBACK_H, LANE_GAP,
  computeScrubData,
  type BalanceAlert, type HoverState,
} from './types';
import { ScrubTooltip } from './ScrubTooltip';

export function UnifiedTimeline({
  damageEvents, feedbackEvents, alerts, waves, totalDuration, scrubTime, onScrub,
}: {
  damageEvents: DamageEvent[];
  feedbackEvents: FeedbackEvent[];
  alerts: BalanceAlert[];
  waves: WaveDef[];
  totalDuration: number;
  scrubTime: number;
  onScrub: (t: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const duration = Math.max(totalDuration, 5);
  const pxPerSec = 40;
  const totalWidth = duration * pxPerSec;

  const timelineAlerts = useMemo(() => alerts.filter((a) => a.timeSec !== undefined), [alerts]);
  const hasAlerts = timelineAlerts.length > 0;

  // Pacing SVG chart
  const pacingBuckets = useMemo(() => {
    const count = Math.ceil(duration);
    const b: { playerDmg: number; enemyDmg: number }[] = Array.from({ length: count }, () => ({ playerDmg: 0, enemyDmg: 0 }));
    for (const evt of damageEvents) {
      const idx = Math.min(Math.floor(evt.timeSec), count - 1);
      if (idx < 0) continue;
      if (evt.source === 'Player') b[idx].playerDmg += evt.damage;
      else b[idx].enemyDmg += evt.damage;
    }
    return b;
  }, [damageEvents, duration]);

  const maxDmg = useMemo(() => Math.max(1, ...pacingBuckets.map((b) => b.playerDmg + b.enemyDmg)), [pacingBuckets]);

  const { playerPath, enemyPath } = useMemo(() => {
    const count = pacingBuckets.length;
    if (count === 0) return { playerPath: '', enemyPath: '' };
    const points = pacingBuckets.map((b, i) => {
      const x = (i + 0.5) * pxPerSec;
      return { x, playerH: (b.playerDmg / maxDmg) * (LANE_PACING_H - 4), enemyH: (b.enemyDmg / maxDmg) * (LANE_PACING_H - 4) };
    });
    const baseY = LANE_PACING_H;
    let pTop = '';
    let pBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH } = points[i];
      pTop += (i === 0 ? 'M' : 'L') + `${x},${baseY - playerH}`;
      pBot = `L${x},${baseY}` + pBot;
    }
    const playerP = pTop + `L${points[points.length - 1].x},${baseY}L${points[0].x},${baseY}Z`;
    let eTop = '';
    let eBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH, enemyH } = points[i];
      eTop += (i === 0 ? 'M' : 'L') + `${x},${baseY - playerH - enemyH}`;
      eBot = `L${x},${baseY - playerH}` + eBot;
    }
    const enemyP = eTop + eBot.replace(/^L/, 'L') + `L${points[0].x},${baseY - points[0].playerH}Z`;
    return { playerPath: playerP, enemyPath: enemyP };
  }, [pacingBuckets, maxDmg, pxPerSec]);

  const displayTime = hover?.time ?? scrubTime;
  const scrubData = useMemo(
    () => computeScrubData(displayTime, damageEvents, feedbackEvents, alerts),
    [displayTime, damageEvents, feedbackEvents, alerts],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    const wrapper = wrapperRef.current;
    if (!el || !wrapper) return;
    const scrollRect = el.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const contentX = e.clientX - scrollRect.left + el.scrollLeft;
    const t = Math.max(0, Math.min(duration, contentX / pxPerSec));
    setHover({ time: t, tooltipLeft: e.clientX - wrapperRect.left });
  }, [duration, pxPerSec]);

  const handlePointerLeave = useCallback(() => setHover(null), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const contentX = e.clientX - rect.left + el.scrollLeft;
    onScrub(Math.max(0, Math.min(duration, contentX / pxPerSec)));
  }, [duration, pxPerSec, onScrub]);

  const scrubX = scrubTime * pxPerSec;
  const hoverX = hover ? hover.time * pxPerSec : null;

  return (
    <div ref={wrapperRef} className="relative">
      {hover && (
        <ScrubTooltip
          displayTime={displayTime}
          scrubData={scrubData}
          tooltipLeft={hover.tooltipLeft}
          containerWidth={wrapperRef.current?.offsetWidth ?? 600}
        />
      )}

      <div className="flex gap-2">
        {/* Lane labels */}
        <div className="w-14 shrink-0 flex flex-col" style={{ gap: LANE_GAP }}>
          <div className="flex items-center" style={{ height: LANE_PACING_H }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Pacing</span>
          </div>
          <div className="flex items-center" style={{ height: LANE_DAMAGE_H }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Damage</span>
          </div>
          {hasAlerts && (
            <div className="flex items-center" style={{ height: LANE_ALERT_H }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: STATUS_WARNING }}>Alerts</span>
            </div>
          )}
          {FEEDBACK_CHANNELS.map((ch) => (
            <div key={ch.type} className="flex items-center" style={{ height: LANE_FEEDBACK_H }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: ch.color }}>{ch.label}</span>
            </div>
          ))}
          <div style={{ height: 14 }} />
        </div>

        {/* Scrollable tracks */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto custom-scrollbar cursor-crosshair"
          onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} onClick={handleClick}>
          <div className="relative flex flex-col" style={{ width: totalWidth, gap: LANE_GAP }}>
            {/* Pacing */}
            <div className="relative bg-black/30 rounded border border-border/20" style={{ height: LANE_PACING_H }}>
              {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
                <div key={i} className="absolute top-0 h-full border-l border-border/10" style={{ left: i * pxPerSec }} />
              ))}
              <svg className="absolute inset-0" width={totalWidth} height={LANE_PACING_H}
                viewBox={`0 0 ${totalWidth} ${LANE_PACING_H}`} preserveAspectRatio="none">
                {playerPath && <path d={playerPath} fill={`${ACCENT_EMERALD}40`} stroke={ACCENT_EMERALD} strokeWidth="1.5" />}
                {enemyPath && <path d={enemyPath} fill={`${STATUS_ERROR}35`} stroke={STATUS_ERROR} strokeWidth="1.5" />}
              </svg>
              {waves.map((w, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col items-center pointer-events-none" style={{ left: w.spawnTimeSec * pxPerSec }}>
                  <div className="h-full w-px" style={{ backgroundColor: ACCENT_CYAN, opacity: 0.6 }} />
                  <span className="absolute top-0 left-1 text-[10px] font-mono font-bold whitespace-nowrap"
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
                    style={{ left: x - 1, width: 3, height: h, backgroundColor: color, opacity: evt.isCrit ? 1 : 0.7, boxShadow: evt.isCrit ? `0 0 4px ${color}` : 'none' }}
                    title={`${evt.timeSec}s: ${evt.source} \u2192 ${evt.target} (${evt.abilityName}) ${evt.damage}${evt.isCrit ? ' CRIT' : ''}`}
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
                      <div className="relative z-10 flex items-center justify-center rounded-full"
                        style={{ width: 14, height: 14, backgroundColor: `${color}20`, border: `1.5px solid ${color}`, boxShadow: `0 0 6px ${color}40` }}>
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
                      style={{ left: evt.timeSec * pxPerSec, width: Math.max(3, evt.durationSec * pxPerSec), height: 10, backgroundColor: `${ch.color}50`, border: `1px solid ${ch.color}80` }}
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

            {/* Scrub head */}
            <div className="absolute top-0 pointer-events-none z-20" style={{ left: scrubX, height: `calc(100% - 14px)` }}>
              <div className="w-px h-full bg-white" />
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" style={{ boxShadow: '0 0 6px rgba(255,255,255,0.6)' }} />
            </div>

            {/* Hover line */}
            {hoverX !== null && Math.abs(hoverX - scrubX) > 2 && (
              <div className="absolute top-0 pointer-events-none z-20" style={{ left: hoverX, height: `calc(100% - 14px)` }}>
                <div className="w-px h-full" style={{ backgroundColor: 'rgba(255,255,255,0.4)' }} />
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-white/60" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
