'use client';

import { Badge } from '@/components/ui/Badge';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { formatTimeAgo } from '@/lib/format-time';
import { ACCENT_EMERALD, STATUS_WARNING, SEVERITY_TOKENS } from '@/lib/chart-colors';
import type { CrashReport, CrashDiagnosis } from '@/types/crash-analyzer';
import { CRASH_TYPE_LABELS } from './constants';
import { SeverityBadge } from './SeverityBadge';

export function CrashListItem({
  report,
  isSelected,
  onClick,
  diagnosis,
}: {
  report: CrashReport;
  isSelected: boolean;
  onClick: () => void;
  diagnosis: CrashDiagnosis | undefined;
}) {
  const token = SEVERITY_TOKENS[report.severity];
  const timeAgo = formatTimeAgo(report.timestamp);

  return (
    // A crash row is a real listbox option, not a bare click-div: it takes focus,
    // announces its selected state, and toggles on Enter/Space so the whole triage
    // list is operable by keyboard and screen reader.
    <div
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`focus-ring rounded-lg border p-3 cursor-pointer transition-all ${
        isSelected ? '' : 'border-border hover:border-border/80 hover:bg-surface-2/50'
      }`}
      style={isSelected ? { borderColor: token.color, backgroundColor: token.bg } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <SeverityBadge severity={report.severity} />
            <Badge variant="default">{CRASH_TYPE_LABELS[report.crashType]}</Badge>
            {report.mappedModule && (
              <span className="text-2xs text-text-muted">{report.mappedModule}</span>
            )}
            {/* Every row says whether it is a built-in demo crash or one observed
                in this project. Without it the eight samples are indistinguishable
                from real crash history — and they would be read as the project's. */}
            <MicroLabel tone="muted" uppercase>
              {report.source === 'imported' ? 'imported' : 'sample'}
            </MicroLabel>
            {/* "Have I seen this before?" answered in the triage list itself. */}
            {report.history && report.history.occurrences > 1 && (
              <MicroLabel
                tone="muted"
                mono
                title={`First seen ${new Date(report.history.firstSeenAt).toLocaleString()}`}
              >
                seen {report.history.occurrences}&times;
              </MicroLabel>
            )}
          </div>
          <p className="text-xs text-text truncate">{report.errorMessage}</p>
          {report.culpritFrame && (
            <p className="text-2xs text-text-muted mt-0.5 truncate">
              {report.culpritFrame.functionName}
              {report.culpritFrame.sourceFile && ` — ${report.culpritFrame.sourceFile}:${report.culpritFrame.lineNumber}`}
            </p>
          )}
          {/* Diagnosed rows lead with the finding; undiagnosed rows SAY they are
              undiagnosed rather than just omitting the line — in a triage list the
              two are compared side by side, so silence reads as "nothing to say
              about this one" instead of "never analyzed". */}
          {/* A row whose analysis was TRANSFERRED from another crash says so in
              the same breath as the finding. In a triage list the rows are read
              against each other, so an unqualified "AI:" on a fuzzy match would
              rank it beside the hand-verified ones. */}
          {diagnosis ? (
            diagnosis.match ? (
              <p className="text-2xs text-amber-400 mt-0.5 truncate">
                Matched {diagnosis.match.sourceCrashId} ({diagnosis.match.strength}): {diagnosis.summary}
              </p>
            ) : (
              <p className="text-2xs text-emerald-400 mt-0.5 truncate">
                AI: {diagnosis.summary}
              </p>
            )
          ) : (
            <MicroLabel tone="muted" className="block mt-0.5">No diagnosis</MicroLabel>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-2xs text-text-muted">{timeAgo}</span>
          {/* A confidence ring is shown only where a confidence exists — and a
              computed one is drawn in a different hue from a hand-written one. */}
          {diagnosis && (
            <ProgressRing
              value={Math.round(diagnosis.confidence * 100)}
              size={24}
              strokeWidth={2.5}
              color={diagnosis.match ? STATUS_WARNING : ACCENT_EMERALD}
            />
          )}
        </div>
      </div>
    </div>
  );
}
