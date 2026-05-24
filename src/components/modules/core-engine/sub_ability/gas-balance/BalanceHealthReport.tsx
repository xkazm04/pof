'use client';

import { useMemo } from 'react';
import {
  CheckCircle2, Info, AlertTriangle, AlertOctagon, Heart, Wrench, Sparkles,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, OPACITY_15, OPACITY_25, OPACITY_30,
  withOpacity, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { buildBalanceHealthReport, type HealthSeverity, type HealthGrade, type HealthFinding } from './balanceHealth';
import type { SimResults, SimScenario } from './data';

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

function FindingCard({ finding }: { finding: HealthFinding }) {
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
        <p className="text-2xs text-text-muted leading-relaxed">{finding.narrative}</p>
        {finding.suggestion && (
          <div
            className="flex items-start gap-1.5 mt-1 rounded px-1.5 py-1"
            style={{ backgroundColor: withOpacity(color, OPACITY_8), border: `1px dashed ${withOpacity(color, OPACITY_25)}` }}
          >
            <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color }} />
            <span className="text-2xs text-text leading-relaxed">
              <span className="font-semibold" style={{ color }}>Try: </span>
              {finding.suggestion}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BalanceHealthReport({ results, scenario }: { results: SimResults; scenario: SimScenario }) {
  const report = useMemo(() => buildBalanceHealthReport(results, scenario), [results, scenario]);
  const gradeColor = GRADE_COLORS[report.grade];

  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3 relative overflow-hidden">
      <div
        className="absolute right-0 top-0 w-48 h-48 blur-3xl rounded-full pointer-events-none"
        style={{ backgroundColor: withOpacity(gradeColor, OPACITY_8) }}
      />
      <SectionHeader icon={Heart} label="Balance Health Report" color={ACCENT_VIOLET} />
      <p className="text-2xs text-text-muted mt-0.5">
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
          <p className="text-2xs text-text-muted leading-relaxed mt-1">{report.narrative}</p>
        </div>
      </div>

      {/* Findings */}
      <div className="mt-3 space-y-1.5">
        {report.findings.map(f => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </div>

      {/* Top recommendations */}
      {report.topRecommendations.length > 0 && (
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
            {report.topRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-2xs text-text leading-relaxed">
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
