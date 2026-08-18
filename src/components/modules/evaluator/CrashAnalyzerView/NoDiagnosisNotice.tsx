'use client';

import { HelpCircle, Compass } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { plainCrashType } from '@/lib/crash-glossary';
import { resolveDiagnosis } from '@/lib/crash-analyzer/analysis-engine';
import type { CrashReport } from '@/types/crash-analyzer';

/**
 * The honest presentation of a crash that has NO diagnosis.
 *
 * A diagnosis is resolved by comparing the crash's SIGNATURE against the crashes
 * PoF holds hand-written analyses for; when nothing clears the match floor, the
 * crash has no diagnosis. The UI used to paper over that by silently falling back
 * to the crash-CATEGORY template and rendering it under the same "What happened /
 * What to do" headings a confidence-0.95 hand-written diagnosis uses — generic
 * advice wearing the clothes of a specific finding.
 *
 * This notice says the absence out loud, then presents the category guidance in a
 * visually distinct dashed block under headings that describe what it actually is
 * ("Typical cause" / "Where to start", not "What happened" / "What to do"). The
 * guidance is kept — it is genuinely useful — it just no longer masquerades.
 *
 * It also names the NEAR MISS: which known crash came closest and by how much,
 * against the floor it failed to clear. "Nothing matched" is a measurement, and
 * showing the measurement is what makes it checkable rather than asserted.
 *
 * Rendered as the lead in Plain mode and in the AI-analysis slot in Technical
 * mode, so the distinction holds in both.
 */
export function NoDiagnosisNotice({ report }: { report: CrashReport }) {
  const plain = plainCrashType(report.crashType);
  // Re-running the (pure) resolver is how the notice reports the near miss
  // without a diagnosis to read it from — 8 candidate comparisons over a cached
  // corpus. Left unmemoized deliberately: `resolveDiagnosis` takes computed
  // default arguments, which the React Compiler cannot see through, so a manual
  // `useMemo` here is rejected outright (react-hooks/preserve-manual-memoization)
  // and the compiler's own memoization covers the call.
  const nearest = resolveDiagnosis(report);

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
            and this one did not match any of them &mdash; its shape (failure class, culprit
            function and file, module, engine terms) was compared against every one. Nothing
            below was derived from this crash&rsquo;s callstack.
          </p>
          {nearest.nearest && (
            <MicroLabel tone="muted" as="p" className="mt-1">
              Closest known crash: {nearest.nearest.crashId} at {nearest.nearest.similarity.toFixed(2)}{' '}
              signature similarity &mdash; below the {nearest.floor.toFixed(2)} match floor.
            </MicroLabel>
          )}
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
