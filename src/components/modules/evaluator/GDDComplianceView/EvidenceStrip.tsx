import { MeterBar } from '@/components/ui/MeterBar';
import type { ComplianceEvidence } from '@/types/gdd-compliance';
import { CONFIDENCE_META } from './constants';

/** "N% (from X of Y features scanned)" — the sentence a bare score cannot say. */
export function coverageSentence(evidence: ComplianceEvidence): string {
  const { featuresTotal, featuresMeasured, coverage } = evidence;
  if (featuresTotal === 0) return 'no features declared — nothing to scan against';
  return `${Math.round(coverage * 100)}% (from ${featuresMeasured} of ${featuresTotal} features scanned)`;
}

/**
 * The evidence behind a score, rendered beside it. A compliance number is a
 * conformance measurement over whatever was actually evaluated; without the
 * coverage line it reads as a statement about the whole module, which is the
 * overclaim this view exists to expose. `compact` is the module-card form (one
 * line, no meter); the full form adds the coverage meter and the confidence note.
 */
export function EvidenceStrip({ evidence, compact = false }: {
  evidence: ComplianceEvidence;
  compact?: boolean;
}) {
  const meta = CONFIDENCE_META[evidence.confidence];

  if (compact) {
    return (
      <span className="text-2xs" style={{ color: meta.color }}>
        Coverage {coverageSentence(evidence)}
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
    </div>
  );
}
