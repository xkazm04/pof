'use client';

import { Bug, Wrench } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { plainCrashType, plainSeverity } from '@/lib/crash-glossary';
import type { CrashReport, CrashDiagnosis } from '@/types/crash-analyzer';
import { CRASH_TYPE_LABELS } from './constants';

/** The humanized lead: leads with the AI summary + fix when present, always
 *  backed by the plain-language crashType/severity translations. */
export function PlainCrashSummary({ report, diagnosis }: { report: CrashReport; diagnosis: CrashDiagnosis | null }) {
  const plain = plainCrashType(report.crashType);
  const sev = plainSeverity(report.severity);
  const whatHappened = diagnosis?.summary ?? plain.what;
  const whatToDo = diagnosis?.fixDescription ?? plain.fix;

  return (
    <SurfaceCard data-testid="plain-crash-summary">
      <div className="space-y-3">
        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Bug className="w-3 h-3" style={{ color: SEVERITY_TOKENS[report.severity].color }} />
            What happened
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={whatHappened} />
          </p>
          <p className="text-2xs text-text-muted mt-1">{sev.meaning}</p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Wrench className="w-3 h-3 text-emerald-400" />
            What to do
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={whatToDo} />
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-2xs text-text-muted">Crash type:</span>
          <Badge variant="default">{CRASH_TYPE_LABELS[report.crashType]}</Badge>
          <span className="text-2xs text-text-muted">·</span>
          <span className="text-2xs text-text-muted">{plain.label}</span>
        </div>
      </div>
    </SurfaceCard>
  );
}
