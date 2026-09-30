import { Badge } from '@/components/ui/Badge';
import { CONTEXT_LABELS } from '@/lib/localization/definitions';
import type { ReadinessRow as Row, ReadinessVerdict } from '@/lib/localization/readiness';
import { SCALE } from './constants';

/** Verdict → Badge variant + words (the text carries the meaning; colour only repeats it). */
const VERDICT: Record<ReadinessVerdict, { variant: 'error' | 'success' | 'warning' | 'default'; label: string }> = {
  overflow: { variant: 'error', label: 'Will clip' },
  fits: { variant: 'success', label: 'Fits' },
  reflow: { variant: 'default', label: 'Reflows' },
  unbudgeted: { variant: 'warning', label: 'No budget (unclassified surface)' },
};

/** One scanned string under the pseudo locale: what it becomes, whether it clips, and why. */
export function ReadinessRow({ row }: { row: Row }) {
  const v = VERDICT[row.verdict];
  const where = row.location ? `${row.location.filePath}:${row.location.lineNumber}` : null;
  return (
    <li data-testid="readiness-row" data-verdict={row.verdict} className="rounded-lg border border-border p-2.5 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`${SCALE.body} font-medium truncate`}>&quot;{row.source}&quot;</span>
        <Badge variant={v.variant}>{v.label}</Badge>
        <span className={SCALE.meta}>{CONTEXT_LABELS[row.context]}</span>
      </div>
      <p className={`${SCALE.meta} font-mono break-all`}>
        <span className="sr-only">Pseudo-localized: </span>{row.pseudo}
      </p>
      <p className={SCALE.meta}>
        {row.budget
          ? `${row.source.length} → ${row.projected} chars projected vs ${row.budget.chars}-char ${CONTEXT_LABELS[row.budget.surface]} budget`
          : row.verdict === 'reflow'
            ? `${row.source.length} → ${row.projected} chars projected; this surface wraps, so length cannot clip it`
            : `${row.source.length} → ${row.projected} chars projected; surface unknown, so no budget is declared`}
        {where && <> · {where}</>}
      </p>
      {row.sourceNearBudget && row.budget && (
        <p className={SCALE.meta}>
          The English source already uses {row.source.length} of {row.budget.chars} chars — shorten the source or
          widen the widget (fixed once, not per locale).
        </p>
      )}
      {row.bypassesCatalog && (
        <p className={SCALE.meta}>
          Bypasses the catalog (FText::FromString / raw string) — a pseudo build would show it unaccented.
        </p>
      )}
      {row.fragment && (
        <p className={SCALE.meta}>Concatenated fragment — word order cannot be translated; use FText::Format.</p>
      )}
    </li>
  );
}
