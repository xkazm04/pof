'use client';

import { Bug, Wrench } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { plainCrashType, plainSeverity } from '@/lib/crash-glossary';
import type { CrashReport, CrashDiagnosis } from '@/types/crash-analyzer';
import { CRASH_TYPE_LABELS } from './constants';
import { NoDiagnosisNotice } from './NoDiagnosisNotice';

/**
 * The humanized lead in Plain English mode.
 *
 * Two mutually exclusive presentations, never blended:
 *
 *  - **A diagnosis exists** → its summary + fix under "What happened / What to
 *    do", stamped with the diagnosis chip and its recorded confidence.
 *  - **No diagnosis** → {@link NoDiagnosisNotice}, which says so and presents the
 *    crash-category guidance under its own headings.
 *
 * The old version silently substituted the category template into the diagnosis
 * headings (`diagnosis?.summary ?? plain.what`), so generic advice read exactly
 * like a hand-verified finding — and since every imported crash has no diagnosis,
 * that was the default experience for a user's own crash log.
 */
export function PlainCrashSummary({ report, diagnosis }: { report: CrashReport; diagnosis: CrashDiagnosis | null }) {
  const plain = plainCrashType(report.crashType);
  const sev = plainSeverity(report.severity);

  const typeFooter = (
    <div className="flex items-center gap-1.5 pt-1">
      <span className="text-2xs text-text-muted">Crash type:</span>
      <Badge variant="default">{CRASH_TYPE_LABELS[report.crashType]}</Badge>
      <span className="text-2xs text-text-muted">·</span>
      <span className="text-2xs text-text-muted">{plain.label}</span>
    </div>
  );

  if (!diagnosis) {
    return (
      <div className="space-y-3" data-testid="plain-crash-summary">
        <NoDiagnosisNotice report={report} />
        <SurfaceCard>
          {/* Severity IS a real fact about this crash (derived from its type), so
              it stays even with no diagnosis. */}
          <p className="text-2xs text-text-muted">{sev.meaning}</p>
          {typeFooter}
        </SurfaceCard>
      </div>
    );
  }

  return (
    <SurfaceCard data-testid="plain-crash-summary">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag level="ok" word="DIAGNOSIS" />
          <MicroLabel tone="muted">
            confidence {Math.round(diagnosis.confidence * 100)}% — analysis of this crash
          </MicroLabel>
        </div>

        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Bug className="w-3 h-3" style={{ color: SEVERITY_TOKENS[report.severity].color }} />
            What happened
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={diagnosis.summary} />
          </p>
          <p className="text-2xs text-text-muted mt-1">{sev.meaning}</p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Wrench className="w-3 h-3 text-emerald-400" />
            What to do
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={diagnosis.fixDescription} />
          </p>
        </div>

        {typeFooter}
      </div>
    </SurfaceCard>
  );
}
