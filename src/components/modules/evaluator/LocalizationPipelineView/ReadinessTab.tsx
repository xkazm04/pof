import { useMemo } from 'react';
import { ScanText } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { PSEUDO_LOCALE } from '@/lib/localization/pseudo-locale';
import type { PseudoKnobs } from '@/lib/localization/pseudo-locale';
import { orderForTriage } from '@/lib/localization/readiness';
import type { ReadinessResult, ReadinessSummary } from '@/lib/localization/readiness';
import type { ScanProvenance } from '@/types/localization-pipeline';
import { SCALE } from './constants';
import { ReadinessRow } from './ReadinessRow';

const KNOBS: readonly { key: keyof PseudoKnobs; label: string; hint: string }[] = [
  { key: 'length', label: 'Length (banded)', hint: 'Pad to the projected length for the source length band' },
  { key: 'markers', label: '[ ] markers', hint: 'Bracket each string so truncation at either edge shows' },
  { key: 'accents', label: 'Accents', hint: 'Accent every letter so text that bypasses the catalog stands out' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Where the rows came from, in words — demo rows are never presented as the project's. */
function provenanceText(provenance: ScanProvenance | null, total: number): string {
  if (provenance?.kind === 'fixture') {
    return 'Demo corpus — these are sample strings, not your project. Configure a UE project and rerun to assess your own text.';
  }
  if (provenance?.kind === 'project') {
    return total === 0
      ? `No user-facing strings found in ${provenance.root}/Source — nothing to pseudo-localize yet. That is not a pass: readiness is judged once UI text exists.`
      : `${plural(total, 'user-facing string', 'user-facing strings')} read from ${provenance.root}/Source.`;
  }
  return total === 0 ? 'The last scan found no user-facing strings.' : `${plural(total, 'string', 'strings')} from the last scan.`;
}

/** One-line Overview summary that jumps to the Readiness tab. */
export function ReadinessSummaryLine({
  summary, provenance, onOpen,
}: { summary: ReadinessSummary; provenance: ScanProvenance | null; onOpen: () => void }) {
  const text = summary.total === 0
    ? 'Pseudo-locale readiness: no user-facing strings scanned — nothing to assess yet.'
    : `Pseudo-locale readiness: ${plural(summary.overflow, 'string', 'strings')} will clip, ${summary.bypassesCatalog} bypass the catalog${provenance?.kind === 'fixture' ? ' (demo corpus)' : ''}.`;
  return (
    <p data-testid="readiness-summary" className={`${TEXT_SCALE.body} text-text flex items-center gap-2 flex-wrap`}>
      {text}
      <button type="button" onClick={onOpen} className={`text-indigo-400 hover:underline rounded ${FOCUS_RING_CLASS}`}>
        Open Readiness
      </button>
    </p>
  );
}

export function ReadinessTab({
  readiness, knobs, setKnobs, provenance,
}: {
  readiness: ReadinessResult;
  knobs: PseudoKnobs;
  setKnobs: (patch: Partial<PseudoKnobs>) => void;
  provenance: ScanProvenance | null;
}) {
  const ordered = useMemo(() => orderForTriage(readiness.rows), [readiness.rows]);
  const { summary } = readiness;

  return (
    <div className="space-y-4">
      <SurfaceCard>
        <h3 className={`${SCALE.title} mb-1 flex items-center gap-1.5`}>
          <ScanText aria-hidden="true" className="w-3.5 h-3.5 text-indigo-400" />
          Pseudo-locale readiness ({PSEUDO_LOCALE})
        </h3>
        <p data-testid="readiness-provenance" className={`${TEXT_SCALE.body} text-text-muted`}>
          {provenanceText(provenance, summary.total)}
        </p>
        <p className={`${TEXT_SCALE.meta} text-text-muted mt-1`}>
          Built, never offered: no translation entry is created, so QA, progress and ready-to-ship are unaffected.
          Expansion is banded by source length (published guidance: ≤10 chars ×2.0 … &gt;70 ×1.3); budgets are
          declared per surface, not measured from widgets.
        </p>
        {summary.total > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge variant="error">{summary.overflow} will clip</Badge>
            <Badge variant="warning">{summary.nearBudget} source near budget</Badge>
            <Badge variant="warning">{summary.bypassesCatalog} bypass catalog</Badge>
            <Badge variant="warning">{summary.fragments} fragments</Badge>
            <Badge variant="success">{summary.fits} fit</Badge>
            <Badge variant="default">{summary.reflow} reflow</Badge>
            {summary.unbudgeted > 0 && <Badge variant="default">{summary.unbudgeted} no budget</Badge>}
          </div>
        )}
      </SurfaceCard>

      {summary.total > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Pseudo-locale transforms">
            {KNOBS.map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={knobs[k.key]}
                title={k.hint}
                onClick={() => setKnobs({ [k.key]: !knobs[k.key] })}
                className={`px-2 py-1 rounded-full text-2xs font-medium transition-colors ${FOCUS_RING_CLASS} ${
                  knobs[k.key]
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'bg-surface-2 text-text-muted border border-transparent hover:text-text'
                }`}
              >
                {k.label}: {knobs[k.key] ? 'on' : 'off'}
              </button>
            ))}
          </div>
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto" aria-label="Strings under the pseudo locale, clipping first">
            {ordered.map((row) => <ReadinessRow key={row.stringId} row={row} />)}
          </ul>
        </>
      )}
    </div>
  );
}
