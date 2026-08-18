'use client';

import { HelpCircle, Compass } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { plainCrashType } from '@/lib/crash-glossary';
import type { CrashReport } from '@/types/crash-analyzer';

/**
 * The honest presentation of a crash that has NO diagnosis.
 *
 * A diagnosis is looked up by exact crash id against a fixed set of hand-authored
 * analyses (`analyzeSingleCrash`), so every imported crash comes back with
 * `diagnosis: null`. The UI used to paper over that by silently falling back to
 * the crash-CATEGORY template and rendering it under the same "What happened /
 * What to do" headings a confidence-0.95 hand-written diagnosis uses — generic
 * advice wearing the clothes of a specific finding.
 *
 * This notice says the absence out loud, then presents the category guidance in a
 * visually distinct dashed block under headings that describe what it actually is
 * ("Typical cause" / "Where to start", not "What happened" / "What to do"). The
 * guidance is kept — it is genuinely useful — it just no longer masquerades.
 *
 * Rendered as the lead in Plain mode and in the AI-analysis slot in Technical
 * mode, so the distinction holds in both.
 */
export function NoDiagnosisNotice({ report }: { report: CrashReport }) {
  const plain = plainCrashType(report.crashType);

  return (
    <SurfaceCard level={2} data-testid="no-diagnosis-notice">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag level="warn" word="NO DIAGNOSIS" />
          {/* No confidence is shown because none exists — a diagnosis was never
              produced for this crash. Inventing a low number here would be the
              same lie in a quieter voice. */}
          <MicroLabel tone="muted">confidence: none — nothing was analyzed</MicroLabel>
        </div>

        <div>
          <p className="text-xs font-semibold text-text mb-1 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            No diagnosis for this crash
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            PoF only holds hand-written root-cause analyses for a fixed set of known crashes,
            and this one did not match any of them. Nothing below was derived from this
            crash&rsquo;s callstack.
          </p>
        </div>

        {/* Category guidance — deliberately fenced off (dashed, recessed, its own
            headings) so it can never be mistaken for a finding about THIS crash. */}
        <div className="rounded-md border border-dashed border-border bg-surface-deep p-2.5 space-y-2">
          <MicroLabel tone="muted" uppercase as="p">
            General guidance for {plain.label.toLowerCase()} crashes
          </MicroLabel>

          <div>
            <p className="text-2xs font-medium text-text-muted mb-0.5">Typical cause</p>
            <p className="text-xs text-text leading-relaxed">
              <DecoratedCrashText text={plain.what} />
            </p>
          </div>

          <div>
            <p className="text-2xs font-medium text-text-muted mb-0.5 flex items-center gap-1.5">
              <Compass className="w-3 h-3" />
              Where to start
            </p>
            <p className="text-xs text-text leading-relaxed">
              <DecoratedCrashText text={plain.fix} />
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
