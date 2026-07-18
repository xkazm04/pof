'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_RED, withOpacity, OPACITY_5, OPACITY_15 } from '@/lib/chart-colors';
import { TimelineStrip } from '../../unique-tabs/_shared';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { EFFECT_TIMELINE_EVENTS } from '../_shared/data';
import type { TimelineEvent } from '@/types/unique-tab-improvements';

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function EffectsTimelineSection() {
  const lanes = useMemo(() => {
    const laneMap: Record<string, TimelineEvent[]> = {};
    for (const evt of EFFECT_TIMELINE_EVENTS) {
      if (!laneMap[evt.category]) laneMap[evt.category] = [];
      laneMap[evt.category].push(evt);
    }
    return Object.entries(laneMap);
  }, []);

  // Derive the axis span from the data instead of assuming a fixed 10s window,
  // so any event with timestamp/duration beyond 10s stays in-scale (floor 10).
  const axisMax = useMemo(
    () => Math.max(10, ...EFFECT_TIMELINE_EVENTS.map(e => e.timestamp + (e.duration ?? 0))),
    [],
  );
  const ticks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => Math.round((axisMax / 5) * i * 10) / 10),
    [axisMax],
  );

  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT_RED} className="p-3">
        <SectionHeader icon={Clock} label="Effect Stack Timeline" color={ACCENT_RED} />
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Swim-lane view of {EFFECT_TIMELINE_EVENTS.length} effect events over a {axisMax}-second combat sequence.
        </p>

        {/* Full timeline strip */}
        <div className="mb-4">
          <TimelineStrip events={EFFECT_TIMELINE_EVENTS} accent={ACCENT_RED} height={70} />
        </div>

        {/* Swim-lane breakdown */}
        <div className="space-y-3">
          {lanes.map(([category, events]) => (
            <div key={category} className="flex items-center gap-3">
              <div className="w-16 text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted flex-shrink-0 text-right">
                {category}
              </div>
              <div className="flex-1 h-8 rounded relative border overflow-hidden" style={{ borderColor: withOpacity(ACCENT_RED, OPACITY_15), backgroundColor: withOpacity(ACCENT_RED, OPACITY_5) }}>
                {events.map((evt) => {
                  const left = clampPct((evt.timestamp / axisMax) * 100);
                  const width = evt.duration ? Math.min(clampPct((evt.duration / axisMax) * 100), 100 - left) : undefined;
                  return (
                    <motion.div
                      key={evt.id}
                      className="absolute top-1 bottom-1"
                      style={{ left: `${left}%`, width: width ? `${width}%` : undefined }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      title={`${evt.label} at ${evt.timestamp}s${evt.duration ? ` (${evt.duration}s)` : ''}`}
                    >
                      {width ? (
                        <div className="h-full rounded-sm opacity-70" style={{ backgroundColor: evt.color, minWidth: 6 }} />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full -ml-1 mt-0.5" style={{ backgroundColor: evt.color, boxShadow: `0 0 6px ${evt.color}` }} />
                      )}
                    </motion.div>
                  );
                })}
                {ticks.map(t => (
                  <div key={t} className="absolute bottom-0 w-px h-1.5" style={{ left: `${clampPct((t / axisMax) * 100)}%`, backgroundColor: withOpacity(ACCENT_RED, OPACITY_15) }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time axis */}
        <div className="flex items-center gap-3 mt-1">
          <div className="w-16 flex-shrink-0" />
          <div className="flex-1 flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {ticks.map(t => <span key={t}>{t}s</span>)}
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}
