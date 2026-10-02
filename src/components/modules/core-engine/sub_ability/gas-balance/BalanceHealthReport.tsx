'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2, Info, AlertTriangle, AlertOctagon, Heart, Wrench, Sparkles,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, OPACITY_15, OPACITY_25, OPACITY_30,
  withOpacity, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { buildBalanceHealthReport, type HealthSeverity, type HealthGrade, type HealthFinding } from './balanceHealth';
import type { SimResults, SimScenario } from './data';
import { FindingFix } from './FindingFix';
import { rankFixes, type FixSolution } from './balanceFixes';

/** Applies a solved fix: the caller swaps the scenario in and re-runs. */
export type ApplyFix = (next: SimScenario, label: string) => void;

/** The run a fix was applied over, so the next report can show before → after. */
export interface AppliedFix { label: string; results: SimResults; scenario: SimScenario }

const SEVERITY_COLORS: Record<HealthSeverity, string> = {
  good: STATUS_SUCCESS,
  info: STATUS_INFO,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

const SEVERITY_ICONS: Record<HealthSeverity, typeof CheckCircle2> = {
  good: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

const SEVERITY_LABELS: Record<HealthSeverity, string> = {
  good: 'Healthy',
  info: 'Note',
  warning: 'Tune',
  critical: 'Fix',
};

const GRADE_COLORS: Record<HealthGrade, string> = {
  A: STATUS_SUCCESS,
  B: '#86efac',   // light green
  C: STATUS_WARNING,
  D: '#fb923c',   // orange
  F: STATUS_ERROR,
};

function FindingCard({ finding, scenario, onApply, onSolved }: {
  finding: HealthFinding; scenario: SimScenario; onApply?: ApplyFix;
  onSolved?: (findingId: string, fixes: FixSolution[]) => void;
}) {
  const color = SEVERITY_COLORS[finding.severity];
  const Icon = SEVERITY_ICONS[finding.severity];
  return (
    <div
      className="rounded-md border p-2.5 flex gap-2.5"
      style={{
        borderColor: withOpacity(color, OPACITY_25),
        backgroundColor: withOpacity(color, OPACITY_8),
      }}
    >
      <div
        className="flex-shrink-0 rounded-md w-7 h-7 flex items-center justify-center mt-0.5"
        style={{ backgroundColor: withOpacity(color, OPACITY_15) }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-text leading-tight">{finding.title}</span>
          <div className="flex items-center gap-1.5">
            {finding.anchor && (
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: withOpacity(color, OPACITY_15), color }}
              >
                {finding.anchor.label}: {finding.anchor.value}
              </span>
            )}
            <span
              className="text-2xs uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: withOpacity(color, OPACITY_15), color }}
            >
              {SEVERITY_LABELS[finding.severity]}
            </span>
          </div>
        </div>
        <p className={`${TEXT_SCALE.body} text-text-muted leading-relaxed`}>{finding.narrative}</p>
        {finding.suggestion && (
          <div
            className="flex items-start gap-1.5 mt-1 rounded px-1.5 py-1"
            style={{ backgroundColor: withOpacity(color, OPACITY_8), border: `1px dashed ${withOpacity(color, OPACITY_25)}` }}
          >
            <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color }} />
            <span className={`${TEXT_SCALE.body} text-text leading-relaxed`}>
              <span className="font-semibold" style={{ color }}>Try: </span>
              {finding.suggestion}
            </span>
          </div>
        )}
        {onApply && <FindingFix finding={finding} scenario={scenario} color={color} onApply={onApply} onSolved={onSolved} />}
      </div>
    </div>
  );
}

/**
 * "What to try first": each suggestion, ranked by `rankFixes` once solved — the best
 * measured grade change first, unsolved next (severity order), refused last. A
 * solved suggestion reads as its best measured lever.
 */
function rankedRecommendations(findings: HealthFinding[], solved: Record<string, FixSolution[]>): string[] {
  const items = findings.filter(f => f.suggestion).map(f => {
    const fixes = solved[f.id];
    if (!fixes) return { id: f.id, text: f.suggestion! };
    const best = fixes.find(x => x.applicable && x.scoreDelta !== undefined);
    if (!best) return { id: f.id, text: `${f.suggestion} (no single stat lands it)`, applicable: false };
    const d = best.scoreDelta!;
    return { id: f.id, scoreDelta: d, text: `${f.title}: ${best.label} fix measured grade ${best.before.grade}→${best.after!.grade} (${d >= 0 ? '+' : ''}${d} pts).` };
  });
  return rankFixes(items).slice(0, 4).map(i => i.text);
}

export function BalanceHealthReport({ results, scenario, onApply, applied }: {
  results: SimResults; scenario: SimScenario; onApply?: ApplyFix; applied?: AppliedFix | null;
}) {
  const report = useMemo(() => buildBalanceHealthReport(results, scenario), [results, scenario]);
  const prior = useMemo(() => (applied ? buildBalanceHealthReport(applied.results, applied.scenario) : null), [applied]);
  const gradeColor = GRADE_COLORS[report.grade];
  // Solved fixes belong to the run they were measured on; a new run starts clean.
  const [solvedFor, setSolvedFor] = useState<{ results: SimResults; map: Record<string, FixSolution[]> }>({ results, map: {} });
  const solved = solvedFor.results === results ? solvedFor.map : {};
  const onSolved = (id: string, fixes: FixSolution[]) =>
    setSolvedFor(prev => ({ results, map: { ...(prev.results === results ? prev.map : {}), [id]: fixes } }));
  const recommendations = rankedRecommendations(report.findings, solved);

  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3 relative overflow-hidden">
      <div
        className="absolute right-0 top-0 w-48 h-48 blur-3xl rounded-full pointer-events-none"
        style={{ backgroundColor: withOpacity(gradeColor, OPACITY_8) }}
      />
      <SectionHeader icon={Heart} label="Balance Health Report" color={ACCENT_VIOLET} />
      <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5`}>
        Plain-language reading of the simulation for designers and producers — no ARPG math required.
      </p>

      {/* Grade + headline + narrative */}
      <div className="flex gap-3 mt-3 items-stretch">
        <div
          className="flex flex-col items-center justify-center rounded-lg border px-3 py-2 min-w-[78px]"
          style={{
            borderColor: withOpacity(gradeColor, OPACITY_30),
            backgroundColor: withOpacity(gradeColor, OPACITY_15),
          }}
        >
          <span className="text-3xl font-black leading-none font-mono" style={{ color: gradeColor }}>
            {report.grade}
          </span>
          <span className="text-2xs text-text-muted mt-1 font-mono">{report.score}/100</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm font-semibold text-text leading-snug">{report.headline}</p>
          <p className={`${TEXT_SCALE.body} text-text-muted leading-relaxed mt-1`}>{report.narrative}</p>
          {applied && prior && (
            <span
              data-testid="applied-fix-chip"
              className="self-start mt-1.5 text-2xs font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: withOpacity(gradeColor, OPACITY_15), color: gradeColor }}
            >
              Applied {applied.label}: grade {prior.grade} {prior.score} → {report.grade} {report.score}, survival {Math.round(applied.results.survivalRate * 100)}% → {Math.round(results.survivalRate * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Findings */}
      <div className="mt-3 space-y-1.5">
        {report.findings.map(f => (
          <FindingCard key={f.id} finding={f} scenario={scenario} onApply={onApply} onSolved={onSolved} />
        ))}
      </div>

      {/* Top recommendations */}
      {recommendations.length > 0 && (
        <div
          className="mt-3 rounded-md border p-2.5"
          style={{
            borderColor: withOpacity(ACCENT_VIOLET, OPACITY_25),
            backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_8),
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT_VIOLET }} />
            <span className="text-2xs font-semibold uppercase tracking-wide" style={{ color: ACCENT_VIOLET }}>
              What to try first
            </span>
          </div>
          <ol className="space-y-1 list-none">
            {recommendations.map((rec, i) => (
              <li key={i} className={`flex gap-2 ${TEXT_SCALE.body} text-text leading-relaxed`}>
                <span
                  className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold text-2xs"
                  style={{ backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_15), color: ACCENT_VIOLET }}
                >
                  {i + 1}
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </BlueprintPanel>
  );
}
