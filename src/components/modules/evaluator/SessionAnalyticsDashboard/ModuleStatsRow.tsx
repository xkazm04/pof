'use client';

import { ChevronDown, ChevronRight, CheckCircle, Circle } from 'lucide-react';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { StatBar } from '@/components/ui/StatBar';
import type { ModuleStats } from '@/types/session-analytics';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { scoreBand } from './helpers';

export function ModuleStatsRow({
  stats,
  index,
  animate,
  isExpanded,
  onToggle,
}: {
  stats: ModuleStats;
  index: number;
  animate: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const successPercent = Math.round(stats.successRate * 100);
  const band = scoreBand(successPercent);
  const BandIcon = band.Icon;

  const panelId = `module-details-${stats.moduleId}`;

  return (
    <div className="rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted-hover" aria-hidden="true" />
        )}

        <TruncateWithTooltip className="text-xs text-text w-36 truncate">{stats.moduleId}</TruncateWithTooltip>

        {/* Mini success bar */}
        <StatBar
          value={successPercent}
          color={band.color}
          animate={animate}
          delayMs={index * 50}
          height={4}
          className="flex-1"
          ariaLabel={`${stats.moduleId} success rate`}
        />

        {/* Redundant encoding: icon shape + word + percent + color, readable without hue */}
        <span className="flex items-center gap-1 w-24 justify-end" style={{ color: band.color }}>
          <BandIcon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          <span className="text-2xs font-medium">{band.label}</span>
          <span className="text-xs font-medium">{successPercent}%</span>
        </span>

        <span className="text-2xs text-text-muted w-8 text-right">{stats.totalSessions}</span>
      </button>

      {isExpanded && (
        <div id={panelId} role="region" aria-label={`${stats.moduleId} details`} className="px-8 py-3 bg-surface-hover space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-2xs text-text-muted block">Success</span>
              <span className="text-xs font-medium" style={{ color: STATUS_SUCCESS }}>{stats.successCount}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Failed</span>
              <span className="text-xs font-medium" style={{ color: STATUS_ERROR }}>{stats.failCount}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Avg Time</span>
              <span className="text-xs text-text-muted-hover font-medium">
                {stats.avgDurationMs > 60000
                  ? `${Math.round(stats.avgDurationMs / 60000)}m`
                  : `${Math.round(stats.avgDurationMs / 1000)}s`
                }
              </span>
            </div>
          </div>

          {/* Context injection comparison */}
          {stats.contextInjectedCount > 0 && stats.noContextCount > 0 && (
            <div className="pt-2 border-t border-border">
              <span className="text-2xs text-text-muted block mb-1">Context Injection Impact</span>
              <div className="flex items-center gap-3">
                {/* Shape-coded markers (filled check vs hollow circle) so the two
                    series are distinguishable without relying on color */}
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-2.5 h-2.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
                  <span className="text-xs text-text">
                    With context: {Math.round(stats.contextInjectedSuccessRate * 100)}%
                  </span>
                  <span className="text-2xs text-text-muted">({stats.contextInjectedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className="w-2.5 h-2.5 flex-shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="text-xs text-text">
                    Without context: {Math.round(stats.noContextSuccessRate * 100)}%
                  </span>
                  <span className="text-2xs text-text-muted">({stats.noContextCount})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
