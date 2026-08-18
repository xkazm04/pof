import { MeterBar } from '@/components/ui/MeterBar';
import type { ComplianceEvidence, EvidenceAge } from '@/types/gdd-compliance';
import { evidenceAge, EVIDENCE_STALE_AFTER_DAYS } from '@/types/gdd-compliance';
import { CONFIDENCE_META, FRESHNESS_META, FRESHNESS_ICON } from './constants';

/** "N% (from X of Y features scanned)" — the sentence a bare score cannot say. */
export function coverageSentence(evidence: ComplianceEvidence): string {
  const { featuresTotal, featuresMeasured, coverage } = evidence;
  if (featuresTotal === 0) return 'no features declared — nothing to scan against';
  return `${Math.round(coverage * 100)}% (from ${featuresMeasured} of ${featuresTotal} features scanned)`;
}

/** Plain-language age of the evidence, naming the threshold it is judged against. */
export function freshnessSentence(age: EvidenceAge): string {
  if (age.state === 'unknown') {
    return age.undated > 0
      ? `${age.undated} reviewed feature(s) carry no review date`
      : 'no reviewed feature carries a review date';
  }
  const newest = `newest review ${describeDays(age.newestDays)}`;
  const oldest = age.oldestDays !== null && age.oldestDays !== age.newestDays
    ? `, oldest ${describeDays(age.oldestDays)}`
    : '';
  const undated = age.undated > 0 ? `, ${age.undated} undated` : '';
  return `${newest}${oldest}${undated} · stale after ${EVIDENCE_STALE_AFTER_DAYS} days`;
}

function describeDays(days: number | null): string {
  if (days === null) return 'undated';
  const whole = Math.floor(days);
  if (whole < 1) return 'today';
  if (whole === 1) return '1 day ago';
  return `${whole} days ago`;
}

/**
 * The evidence behind a score, rendered beside it: how MUCH was measured
 * (coverage) and how OLD it is (freshness). A compliance number without either
 * reads as a statement about the whole module, right now — the overclaim this
 * view exists to expose.
 *
 * `now` is the report's own `generatedAt`, passed in rather than read from the
 * clock: it keeps the component pure (react-hooks/purity) and makes the
 * comparison the honest one — evidence age measured against the audit that
 * reported it, so "audited just now over six-month-old evidence" says so.
 */
export function EvidenceStrip({ evidence, now, compact = false }: {
  evidence: ComplianceEvidence;
  now: string;
  compact?: boolean;
}) {
  const meta = CONFIDENCE_META[evidence.confidence];
  const age = evidenceAge(evidence, now);
  const fresh = FRESHNESS_META[age.state];
  const ClockIcon = FRESHNESS_ICON;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="text-2xs" style={{ color: meta.color }}>
          Coverage {coverageSentence(evidence)}
        </span>
        {evidence.measured && (
          <span className="inline-flex items-center gap-0.5 text-2xs" style={{ color: fresh.color }}>
            <ClockIcon className="w-2.5 h-2.5" aria-hidden="true" />
            {fresh.label}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded text-2xs font-medium"
          style={{ color: meta.color, border: `1px solid ${meta.color}55` }}
        >
          {meta.label}
        </span>
        <span className="text-2xs text-text-muted">Coverage {coverageSentence(evidence)}</span>
      </div>
      <MeterBar
        value={evidence.coverage * 100}
        color={meta.color}
        height={4}
        ariaLabel="Evidence coverage"
        valueText={`${evidence.featuresMeasured} of ${evidence.featuresTotal} features scanned`}
      />
      <p className="text-2xs text-text-subtle">{meta.note}</p>
      <p className="inline-flex items-center gap-1 text-2xs" style={{ color: fresh.color }}>
        <ClockIcon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium">{fresh.label}</span>
        <span className="text-text-subtle">— {freshnessSentence(age)}</span>
      </p>
    </div>
  );
}
