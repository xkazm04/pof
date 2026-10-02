'use client';

import { useMemo } from 'react';
import { Award, Shuffle, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  OPACITY_10, OPACITY_20, STATUS_ERROR, ACCENT_VIOLET,
  withOpacity, OPACITY_30, OPACITY_12, OPACITY_37, GLOW_MD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, LEVEL_REWARDS } from '../_shared/data';
import {
  evenSpacingSuggestion, gapCV, pacingModel, pacingTimeline, respaceSchedule, rewardSchedule,
  type RewardGroup,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';

const SHIPPED_SCHEDULE = rewardSchedule(LEVEL_REWARDS);

const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);

interface LevelUpRewardPreviewProps {
  baseXp: number;
  curveExp: number;
  /** Rewards grouped by unlock level; defaults to the shipped LEVEL_REWARDS. */
  schedule?: RewardGroup[];
  onScheduleChange?: (next: RewardGroup[]) => void;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: withOpacity(color, OPACITY_30), backgroundColor: withOpacity(color, OPACITY_10) }}
    >
      {label}
    </span>
  );
}

export function LevelUpRewardPreview({
  baseXp, curveExp, schedule = SHIPPED_SCHEDULE, onScheduleChange,
}: LevelUpRewardPreviewProps) {
  const model = useMemo(() => pacingModel(baseXp, curveExp), [baseXp, curveExp]);
  const timeline = useMemo(() => pacingTimeline(model, schedule), [model, schedule]);
  const cv = useMemo(() => gapCV(timeline.map((e) => e.gapHours)), [timeline]);
  const suggestion = useMemo(() => evenSpacingSuggestion(model, schedule), [model, schedule]);
  const alreadyEven = suggestion.every((l, i) => l === schedule[i]?.level);
  const isShipped = schedule.length === SHIPPED_SCHEDULE.length
    && schedule.every((g, i) => g.level === SHIPPED_SCHEDULE[i].level);

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={Award} label="Level-Up Reward Preview" color={ACCENT} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs font-mono text-text-muted">
        <span>
          {timeline.length} unlock levels · gap CV <span className="font-bold text-text">{cv.toFixed(2)}</span>
          {' '}(0 = even; time from the live curve)
        </span>
        <div className="flex items-center gap-1.5">
          {!isShipped && onScheduleChange && (
            <button
              type="button"
              onClick={() => onScheduleChange(SHIPPED_SCHEDULE)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-border/40 hover:bg-surface-hover/50"
            >
              <RotateCcw className="w-3 h-3" /> Shipped levels
            </button>
          )}
          <button
            type="button"
            disabled={!onScheduleChange || alreadyEven}
            title={`Move unlock groups to L${suggestion.join(', ')}`}
            onClick={() => onScheduleChange?.(respaceSchedule(schedule, suggestion))}
            className="flex items-center gap-1 px-2 py-1 rounded border font-bold disabled:opacity-40"
            style={{ color: ACCENT, borderColor: withOpacity(ACCENT, OPACITY_30), backgroundColor: withOpacity(ACCENT, OPACITY_10) }}
          >
            <Shuffle className="w-3 h-3" /> Apply even spacing
          </button>
        </div>
      </div>

      <div className="relative mt-2.5 pl-4">
        <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, ${withOpacity(ACCENT, OPACITY_30)}, ${withOpacity(ACCENT, OPACITY_12)}, transparent)` }} />

        <div className="space-y-3">
          {timeline.map((entry, i) => {
            const lead = entry.rewards[0];
            const Icon = lead.icon;
            return (
              <motion.div
                key={entry.level}
                initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 relative"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-surface-deep shadow-lg shrink-0"
                  style={{ backgroundColor: lead.color, boxShadow: `${GLOW_MD} ${withOpacity(lead.color, OPACITY_37)}` }}
                >
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>

                <div className="flex-1 bg-surface/50 px-3 py-2 rounded-lg border border-border/40 hover:bg-surface-hover/50 transition-colors space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-2xs font-mono text-text-muted">
                      <span>{i === 0 ? `${fmtHours(entry.gapHours)} from start` : `+${fmtHours(entry.gapHours)} after previous`}</span>
                      <span>· at {fmtHours(entry.hoursFromStart)}</span>
                      {entry.drought && <Badge label="Drought" color={STATUS_ERROR} />}
                      {entry.clump && <Badge label="Clump" color={ACCENT_VIOLET} />}
                    </div>
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border shrink-0"
                      style={{ color: lead.color, borderColor: `${lead.color}${OPACITY_20}`, backgroundColor: `${lead.color}${OPACITY_10}` }}
                    >
                      LV {entry.level}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {entry.rewards.map((reward) => (
                      <div key={reward.name} className="flex items-center gap-1.5">
                        <span data-reward-name className="text-xs font-bold text-text">{reward.name}</span>
                        <span
                          className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${reward.color}${OPACITY_10}`, color: reward.color, border: `1px solid ${reward.color}${OPACITY_20}` }}
                        >
                          {reward.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
