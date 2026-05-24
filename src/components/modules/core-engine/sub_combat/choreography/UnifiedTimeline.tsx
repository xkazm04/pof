'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  OVERLAY_WHITE, withOpacity, OPACITY_40, OPACITY_60,
} from '@/lib/chart-colors';
import type { DamageEvent, FeedbackEvent, WaveDef } from '@/lib/combat/choreography-sim';
import {
  LANE_GAP,
  computeScrubData,
  type BalanceAlert, type HoverState,
} from './types';
import { ScrubTooltip } from './ScrubTooltip';
import { usePacingPaths } from './usePacingPaths';
import { TimelineLanes, TimelineLaneLabels } from './TimelineLanes';

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
  const [wrapperWidth, setWrapperWidth] = useState(600);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWrapperWidth(el.offsetWidth));
    observer.observe(el);
    setWrapperWidth(el.offsetWidth);
    return () => observer.disconnect();
  }, []);

  const duration = Math.max(totalDuration, 5);
  const pxPerSec = 40;
  const totalWidth = duration * pxPerSec;

  const timelineAlerts = useMemo(() => alerts.filter((a) => a.timeSec !== undefined), [alerts]);
  const hasAlerts = timelineAlerts.length > 0;

  const { playerPath, enemyPath } = usePacingPaths(damageEvents, duration, pxPerSec);

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
          containerWidth={wrapperWidth}
        />
      )}

      <div className="flex gap-2">
        {/* Lane labels */}
        <div className="w-14 shrink-0 flex flex-col" style={{ gap: LANE_GAP }}>
          <TimelineLaneLabels hasAlerts={hasAlerts} />
        </div>

        {/* Scrollable tracks */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto custom-scrollbar cursor-crosshair"
          onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} onClick={handleClick}>
          <div className="relative flex flex-col" style={{ width: totalWidth, gap: LANE_GAP }}>
            <TimelineLanes
              damageEvents={damageEvents}
              feedbackEvents={feedbackEvents}
              timelineAlerts={timelineAlerts}
              waves={waves}
              duration={duration}
              totalWidth={totalWidth}
              pxPerSec={pxPerSec}
              playerPath={playerPath}
              enemyPath={enemyPath}
              hasAlerts={hasAlerts}
            />

            {/* Scrub head */}
            <div className="absolute top-0 pointer-events-none z-20" style={{ left: scrubX, height: `calc(100% - 14px)` }}>
              <div className="w-px h-full bg-white" />
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" style={{ boxShadow: `0 0 6px ${withOpacity(OVERLAY_WHITE, OPACITY_60)}` }} />
            </div>

            {/* Hover line */}
            {hoverX !== null && Math.abs(hoverX - scrubX) > 2 && (
              <div className="absolute top-0 pointer-events-none z-20" style={{ left: hoverX, height: `calc(100% - 14px)` }}>
                <div className="w-px h-full" style={{ backgroundColor: withOpacity(OVERLAY_WHITE, OPACITY_40) }} />
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-white/60" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
