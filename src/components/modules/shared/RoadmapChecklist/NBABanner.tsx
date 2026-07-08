'use client';

import {
  Play, Zap, AlertTriangle, TrendingUp, ChevronUp, ChevronDown,
} from 'lucide-react';
import { AccentButton } from '@/components/ui/AccentButton';
import { NBAScoreBar } from '@/components/modules/shared/NBAScoreBar';
import type { NBARecommendation } from '@/lib/nba-engine';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

export function NBABanner({
  top, runners, expanded, onToggleExpand, onRun, accentColor, isRunning,
}: {
  top: NBARecommendation;
  runners: NBARecommendation[];
  expanded: boolean;
  onToggleExpand: () => void;
  onRun: (rec: NBARecommendation) => void;
  accentColor: string;
  isRunning: boolean;
}) {
  const successPct = Math.round(top.successProbability * 100);

  return (
    <div className="rounded-lg border" style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}>
      {/* Top recommendation */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Zap className="w-3 h-3" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                Next Best Action
              </span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full font-mono font-medium" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
                {top.score}
              </span>
            </div>
            <p className="text-xs font-medium text-text mt-1">{top.item.label}</p>
            <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">{top.reason}</p>

            {/* Why-recommended breakdown bar */}
            <NBAScoreBar rec={top} />

            {/* Metrics row */}
            <div className="flex items-center gap-3 mt-2">
              {top.pattern && (
                <span className="flex items-center gap-1 text-2xs text-text-muted">
                  <TrendingUp className="w-3 h-3" style={{ color: successPct >= 70 ? STATUS_SUCCESS : successPct >= 40 ? STATUS_WARNING : STATUS_ERROR }} />
                  <strong style={{ color: successPct >= 70 ? STATUS_SUCCESS : successPct >= 40 ? STATUS_WARNING : STATUS_ERROR }}>{successPct}%</strong> success
                </span>
              )}
              {top.pattern?.approach && (
                <span className="text-2xs text-text-muted">
                  {top.pattern.approach} approach
                </span>
              )}
              {top.pattern && top.pattern.sessionCount > 0 && (
                <span className="text-2xs text-text-muted">
                  {top.pattern.sessionCount} session{top.pattern.sessionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Pitfalls */}
            {top.pitfalls.length > 0 && (
              <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 bg-status-red-subtle border border-status-red-medium rounded text-2xs text-red-400">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{top.pitfalls[0]}{top.pitfalls.length > 1 ? ` (+${top.pitfalls.length - 1} more)` : ''}</span>
              </div>
            )}
          </div>

          {/* Run button */}
          <AccentButton
            onClick={() => onRun(top)}
            disabled={isRunning}
            accentColor={accentColor}
            size="sm"
            className="flex-shrink-0"
            leftIcon={<Play className="w-3.5 h-3.5" />}
          >
            Run
          </AccentButton>
        </div>
      </div>

      {/* Runners-up toggle. Wrapped so only this section clips to the rounded
          bottom corners — the top section stays unclipped so the why-recommended
          legend popover can overflow the banner. */}
      {runners.length > 0 && (
        <div className="overflow-hidden rounded-b-lg">
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-2xs text-text-muted hover:text-text transition-colors border-t"
            style={{ borderColor: `${accentColor}15` }}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : `${runners.length} more suggestion${runners.length > 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="border-t" style={{ borderColor: `${accentColor}15` }}>
              {runners.map((rec) => (
                <NBARunnerRow key={rec.item.id} rec={rec} accentColor={accentColor} onRun={onRun} isRunning={isRunning} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NBARunnerRow({
  rec, accentColor, onRun, isRunning,
}: {
  rec: NBARecommendation;
  accentColor: string;
  onRun: (rec: NBARecommendation) => void;
  isRunning: boolean;
}) {
  const successPct = Math.round(rec.successProbability * 100);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover/50 transition-colors group">
      <span
        className="flex-shrink-0 text-2xs font-mono font-medium w-6 text-center rounded py-0.5"
        style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
      >
        {rec.score}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text truncate">{rec.item.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-text-muted truncate">{rec.reason}</span>
          {rec.pattern && (
            <span className="flex-shrink-0 text-2xs" style={{ color: successPct >= 70 ? STATUS_SUCCESS : successPct >= 40 ? STATUS_WARNING : STATUS_ERROR }}>
              {successPct}%
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRun(rec)}
        disabled={isRunning}
        className="flex-shrink-0 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${accentColor}18`,
          color: accentColor,
          border: `1px solid ${accentColor}28`,
        }}
      >
        <Play className="w-2.5 h-2.5" />
        Run
      </button>
    </div>
  );
}
