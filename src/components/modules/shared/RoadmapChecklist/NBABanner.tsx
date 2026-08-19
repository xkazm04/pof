'use client';

import {
  Play, Zap, AlertTriangle, TrendingUp, ChevronUp, ChevronDown, HelpCircle,
} from 'lucide-react';
import { AccentButton } from '@/components/ui/AccentButton';
import { NBAScoreBar } from '@/components/modules/shared/NBAScoreBar';
import { nbaSuccessOdds } from '@/lib/nba-breakdown';
import type { NBARecommendation } from '@/lib/nba-engine';
import type { ModulePatternsResult } from './useModulePatterns';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

/** Odds colour — only ever applied to a number that actually has evidence. */
function oddsColor(pct: number): string {
  return pct >= 70 ? STATUS_SUCCESS : pct >= 40 ? STATUS_WARNING : STATUS_ERROR;
}

/**
 * The success-odds line.
 *
 * Rendered UNCONDITIONALLY — it used to hang off `top.pattern`, so on the
 * overwhelmingly common no-pattern path the card showed nothing here while the
 * hover legend still asserted "50% past success on similar work" from a
 * hard-coded constant. Now the sentence always names its sample, and a module
 * with no recorded runs says exactly that instead of showing a percentage.
 */
function SuccessOdds({ rec }: { rec: NBARecommendation }) {
  const odds = nbaSuccessOdds(rec);

  return (
    <span
      data-testid="nba-success-odds"
      data-odds-source={rec.successEvidence.source}
      className="flex items-center gap-1 text-2xs text-text-muted"
    >
      {odds.pct === null ? (
        <>
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {odds.note}
        </>
      ) : (
        <>
          <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color: oddsColor(odds.pct) }} aria-hidden="true" />
          <strong style={{ color: oddsColor(odds.pct) }}>{odds.pct}%</strong>
          <span>— {odds.note}</span>
        </>
      )}
    </span>
  );
}

export function NBABanner({
  top, runners, expanded, onToggleExpand, onRun, accentColor, isRunning, patternLibrary,
}: {
  top: NBARecommendation;
  runners: NBARecommendation[];
  expanded: boolean;
  onToggleExpand: () => void;
  onRun: (rec: NBARecommendation) => void;
  accentColor: string;
  isRunning: boolean;
  /**
   * State of the module-scoped pattern read that feeds the pitfalls warning.
   * Required for the card to distinguish "nothing to warn about" from "nothing
   * was checked" — an absent warning must never read as "no known pitfalls".
   */
  patternLibrary?: ModulePatternsResult;
}) {
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
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <SuccessOdds rec={top} />
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
              <div
                data-testid="nba-pitfalls"
                className="flex items-start gap-1.5 mt-2 px-2 py-1.5 bg-status-red-subtle border border-status-red-medium rounded text-2xs text-red-400"
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{top.pitfalls[0]}{top.pitfalls.length > 1 ? ` (+${top.pitfalls.length - 1} more)` : ''}</span>
              </div>
            )}

            {/* Why there is no warning. Silence here used to be indistinguishable
                from "checked, nothing found" — so the card states which it is. */}
            {top.pitfalls.length === 0 && (
              <PitfallCheckNote library={patternLibrary} />
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

/**
 * Names what the pitfall check actually did when it produced no warning.
 *
 * Rendered ONLY when there is no warning to show. Three honest outcomes: the
 * read is still running, it failed (so nothing was checked), or it succeeded
 * against an empty library (so there is nothing recorded to warn from — which is
 * not the same as "this approach is known to be safe").
 */
function PitfallCheckNote({ library }: { library?: ModulePatternsResult }) {
  if (!library) return null;

  if (library.state === 'loading') {
    return (
      <p className="mt-2 text-2xs text-text-muted" role="status" aria-live="polite">
        Checking recorded patterns for known pitfalls…
      </p>
    );
  }

  if (library.state === 'failed') {
    return (
      <div
        data-testid="nba-pitfalls-unchecked"
        className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded text-2xs text-text-muted border border-border"
        role="status"
      >
        <HelpCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>
          Pitfalls not checked — the pattern library could not be read
          {library.error ? `: ${library.error}` : '.'}{' '}
          <button onClick={library.retry} className="underline hover:text-text focus-ring rounded">
            Retry
          </button>
        </span>
      </div>
    );
  }

  if (library.patterns.length === 0) {
    return (
      <p data-testid="nba-pitfalls-empty" className="mt-2 text-2xs text-text-muted">
        No implementation patterns recorded for this module yet — nothing to check
        against, not a clean bill of health.
      </p>
    );
  }

  return (
    <p data-testid="nba-pitfalls-none" className="mt-2 text-2xs text-text-muted">
      Checked {library.patterns.length} recorded pattern{library.patterns.length === 1 ? '' : 's'} — no known pitfalls for this item.
    </p>
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
  const odds = nbaSuccessOdds(rec);

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
          {/* A percentage only where one is evidenced — `title` carries the sample. */}
          {odds.pct !== null && (
            <span
              className="flex-shrink-0 text-2xs"
              style={{ color: oddsColor(odds.pct) }}
              title={odds.note}
            >
              {odds.pct}%
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
