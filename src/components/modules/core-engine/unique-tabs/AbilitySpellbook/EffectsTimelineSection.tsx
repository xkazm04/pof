'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_RED } from '@/lib/chart-colors';
import { TimelineStrip } from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { EFFECT_TIMELINE_EVENTS } from './data';
import type { TimelineEvent } from '@/types/unique-tab-improvements';

export function EffectsTimelineSection() {
  const lanes = useMemo(() => {
    const laneMap: Record<string, TimelineEvent[]> = {};
    for (const evt of EFFECT_TIMELINE_EVENTS) {
      if (!laneMap[evt.category]) laneMap[evt.category] = [];
      laneMap[evt.category].push(evt);
    }
    return Object.entries(laneMap);
  }, []);

  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT_RED} className="p-3">
        <SectionHeader icon={Clock} label="Effect Stack Timeline" color={ACCENT_RED} />
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Swim-lane view of 8 effect events over a 10-second combat sequence.
        </p>

        {/* Full timeline strip */}
        <div className="mb-4">
          <TimelineStrip events={EFFECT_TIMELINE_EVENTS} accent={ACCENT_RED} height={70} />
        </div>

        {/* Swim-lane breakdown */}
        <div className="space-y-3">
          {lanes.map(([category, events]) => (
            <div key={category} className="flex items-center gap-3">
              <div className="w-16 text-[10px] font-mono uppercase tracking-[0.15em] font-bold text-text-muted flex-shrink-0 text-right">
                {category}
              </div>
              <div className="flex-1 h-8 rounded relative border" style={{ borderColor: `${ACCENT_RED}25`, backgroundColor: `${ACCENT_RED}08` }}>
                {events.map((evt) => {
                  const left = (evt.timestamp / 10) * 100;
                  const width = evt.duration ? (evt.duration / 10) * 100 : undefined;
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
                {[0, 2, 4, 6, 8, 10].map(t => (
                  <div key={t} className="absolute bottom-0 w-px h-1.5" style={{ left: `${(t / 10) * 100}%`, backgroundColor: `${ACCENT_RED}25` }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time axis */}
        <div className="flex items-center gap-3 mt-1">
          <div className="w-16 flex-shrink-0" />
          <div className="flex-1 flex justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
            {[0, 2, 4, 6, 8, 10].map(t => <span key={t}>{t}s</span>)}
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}
