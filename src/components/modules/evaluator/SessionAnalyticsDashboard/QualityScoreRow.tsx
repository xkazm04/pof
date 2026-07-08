'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { StatBar } from '@/components/ui/StatBar';
import type { PromptQualityScore } from '@/types/session-analytics';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { scoreBand } from './helpers';

export function QualityScoreRow({ score, index, animate }: { score: PromptQualityScore; index: number; animate: boolean }) {
  const TrendIcon = score.trend === 'improving' ? TrendingUp : score.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = score.trend === 'improving' ? STATUS_SUCCESS : score.trend === 'declining' ? STATUS_ERROR : 'var(--text-muted)';
  const band = scoreBand(score.score);
  const BandIcon = band.Icon;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
      {/* Module name */}
      <TruncateWithTooltip className="text-xs text-text w-36 truncate">{score.moduleId}</TruncateWithTooltip>

      {/* Score bar */}
      <div className="flex-1 flex items-center gap-2">
        <StatBar value={score.score} color={band.color} animate={animate} delayMs={index * 50} height={6} className="flex-1" />
        <span className="text-xs font-bold w-8 text-right" style={{ color: band.color }}>
          {score.score}
        </span>
        {/* Redundant encoding: icon shape + word + color, readable without hue */}
        <span className="flex items-center gap-0.5 w-14" style={{ color: band.color }}>
          <BandIcon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          <span className="text-2xs">{band.label}</span>
        </span>
      </div>

      {/* Trend */}
      <TrendIcon className="w-3 h-3 flex-shrink-0" style={{ color: trendColor }} />

      {/* Sessions count */}
      <span className="text-2xs text-text-muted w-16 text-right">{score.sessionsRecorded} sessions</span>
    </div>
  );
}
