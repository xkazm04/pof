'use client';

/**
 * The evidence modal's ENTITY LEDGER — one row per entity of the step, each with its OWN rung,
 * its OWN verdict and its checker status, ordered so the entity holding the step down is on
 * top (see `cellLedger`). Selecting a row swaps the verdict box, dimension bars and proof
 * together; "Focus entity" hands the entity to Item Focus.
 *
 * Replaces a blind `<select>` of `{entityId} ({status})`, which gave no rung or verdict, so
 * finding the condemned entity among N meant clicking through all of them.
 *
 * Display-only: every value here is read from the ledger; nothing grades.
 */
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { readinessCode, readinessLabel } from '@/lib/status/readiness';
import type { CellLedger, EntityEvidence, LedgerRow } from '@/lib/status/cellLedger';

const mono = 'var(--lab-font-mono)';
const surface = { background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 0 } as const;

/** Glyph + word per verdict state — never hue alone (WCAG 1.4.1). */
function verdictText(r: LedgerRow): { text: string; color: string } {
  const j = r.cell.judged;
  switch (r.verdict) {
    case 'judge-blocked': return { text: `✕ judge FAIL ${j?.score ?? ''}`, color: 'var(--lab-bad)' };
    case 'judge-passed': return { text: `✓ judge PASS ${j?.score ?? ''}`, color: 'var(--lab-ok)' };
    case 'not-applied': return { text: `○ judge ${j?.verdict.toUpperCase() ?? ''} ${j?.score ?? ''} · not applied`, color: 'var(--lab-muted)' };
    case 'unavailable': return { text: '? verdict unknown', color: 'var(--lab-warn)' };
    default: return { text: '— unjudged', color: 'var(--lab-muted)' };
  }
}

export function EvidenceEntityLedger({
  ledger,
  selected,
  onSelect,
  onFocusEntity,
}: {
  ledger: CellLedger;
  selected: string | null;
  onSelect: (entityId: string) => void;
  onFocusEntity?: (catalogId: string, entityId: string) => void;
}) {
  if (!ledger.rows.length) return null;
  return (
    <section aria-label={`Entities of ${ledger.step}`} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lab-ink-deep)' }}>Entities</h3>
        <span data-testid="ledger-summary" style={{ fontSize: 12, fontFamily: mono, color: 'var(--lab-muted)' }}>{ledger.summary}</span>
      </div>
      {ledger.verdictNote && (
        <div role="note" data-testid="ledger-verdict-note" style={{ ...surface, borderLeft: '3px solid var(--lab-warn)', padding: '6px 10px', fontSize: 12, color: 'var(--lab-text)', marginBottom: 6 }}>
          {ledger.verdictNote}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 208, overflowY: 'auto', ...surface }}>
        {ledger.rows.map((r) => {
          const on = r.entityId === selected;
          const v = verdictText(r);
          const blocked = r.readiness.state === 'blocked';
          return (
            <li key={r.entityId} data-entity={r.entityId} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--lab-line)', background: on ? 'var(--lab-bg)' : 'transparent' }}>
              <button
                type="button"
                data-testid={`ledger-select-${r.entityId}`}
                aria-pressed={on}
                onClick={() => onSelect(r.entityId)}
                title={readinessLabel(r.readiness)}
                className="focus-ring-inset"
                style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '3.2em minmax(0, 1fr) auto', gap: 10, alignItems: 'baseline', textAlign: 'left', padding: '5px 10px', fontSize: 12, fontFamily: mono, color: 'var(--lab-text)', background: 'transparent', border: 0, borderLeft: `3px solid ${on ? 'var(--lab-ink)' : 'transparent'}`, cursor: 'pointer' }}
              >
                <span style={{ fontWeight: 700, color: blocked ? 'var(--lab-bad)' : 'var(--lab-ink-deep)' }}>{readinessCode(r.readiness)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: on ? 700 : 400 }}>{r.entityId}</span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ color: v.color }}>{v.text}</span>
                  <span style={{ color: 'var(--lab-muted)' }}> · {r.status}{r.tier ? ` ${r.tier}` : ''}</span>
                </span>
              </button>
              {onFocusEntity && (
                <button
                  type="button"
                  aria-label={`Focus entity ${r.entityId}`}
                  title="Open this entity in Item Focus — its realization across every step"
                  onClick={() => onFocusEntity(ledger.catalogId, r.entityId)}
                  className="focus-ring-inset"
                  style={{ flexShrink: 0, fontFamily: mono, fontSize: 12, color: 'var(--lab-ink)', background: 'transparent', border: 0, borderLeft: '1px solid var(--lab-line)', padding: '0 10px', cursor: 'pointer' }}
                >
                  Focus →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The verdict box for the SELECTED entity — its own verdict, provenance and dimensions, so
 * the verdict above the proof always belongs to the entity whose proof is shown.
 */
export function EntityVerdict({
  evidence,
  ledger,
  judgeKind,
  shapeOnly,
  reason,
}: {
  evidence: EntityEvidence | null;
  ledger: CellLedger;
  judgeKind?: string;
  shapeOnly: boolean;
  reason?: string;
}) {
  const j = evidence?.judged;
  const who = evidence ? evidence.row.entityId : 'this step';
  if (ledger.verdictNote) {
    return (
      <div role="status" data-testid="evidence-verdict" style={{ fontSize: 13, color: 'var(--lab-text)', padding: '8px 12px', marginBottom: 14, borderLeft: '3px solid var(--lab-warn)', ...surface }}>
        Judgment for {who} is UNKNOWN — the judge verdicts could not be read, so this is not &ldquo;no judgment&rdquo;.
      </div>
    );
  }
  if (!j) {
    return (
      <div data-testid="evidence-verdict" style={{ fontSize: 13, color: 'var(--lab-muted)', padding: '8px 12px', marginBottom: 14, borderLeft: '3px solid var(--lab-line)', ...surface }}>
        No content-quality judgment for {who}{judgeKind ? ` — would need a ${judgeKind} judge` : ''}{shapeOnly ? ' · checker is shape-only' : ''}.
        {reason ? ` (${reason})` : ''}
      </div>
    );
  }
  const tone = j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-bad)';
  const a = evidence?.attribution;
  return (
    <>
      <div data-testid="evidence-verdict" style={{ fontSize: 13, borderLeft: `3px solid ${a && !a.applied ? 'var(--lab-line)' : tone}`, padding: '8px 12px', marginBottom: 14, ...surface }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--lab-muted)' }}>{who} · </span>
        <span style={{ fontFamily: mono, fontWeight: 700, color: tone }}>{j.verdict.toUpperCase()} {j.score}/100</span>
        <span style={{ color: 'var(--lab-muted)', fontFamily: mono, fontSize: 12 }}> · {j.model}{j.effort ? `/${j.effort}` : ''}{j.rubricVersion != null ? ` · rubric v${j.rubricVersion}` : ''}</span>
        <div style={{ marginTop: 5, color: 'var(--lab-text)', lineHeight: 1.5 }}>{j.findings}</div>
        {a && a.provenance !== 'current' && (
          <div style={{ marginTop: 5, fontSize: 12, color: 'var(--lab-muted)', lineHeight: 1.5 }}>{a.note}</div>
        )}
      </div>
      {evidence?.dimensions && (
        <div style={{ marginBottom: 14 }}>
          <DimensionScoreBars dimensions={evidence.dimensions} variant="lab" />
        </div>
      )}
    </>
  );
}
