'use client';

import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton } from '../controls';
import { DataTable } from '../shared/DataTable';
import { formatPriceFigure as fmt, type PriceLawCheck, type TermVerdict } from './economyPriceLaw';
import type { LabTheme } from '../../theme';

export interface PriceLawPanelProps {
  t: LabTheme;
  r: PriceLawCheck;
  seeded: boolean;
  onSeed: () => void;
}

/** Glyph + word, never hue alone. */
const VERDICT_WORD: Record<TermVerdict, string> = {
  agrees: '✓ agrees',
  contradicts: '✕ contradicts',
  derived: '= derived only',
  unstated: '— not stored',
  underivable: '? law or input missing',
  anchor: '◆ hand-set anchor',
};

const INPUT_COLUMNS = [{ key: 'value', label: 'Value' }, { key: 'from', label: 'Read from' }];
const TERM_COLUMNS = [
  { key: 'formula', label: 'Law' },
  { key: 'law', label: 'Law gives' },
  { key: 'stored', label: 'Stored' },
  { key: 'verdict', label: 'Verdict' },
];

function headline(r: PriceLawCheck): string {
  const v = (key: string) => r.inputs.find((i) => i.key === key)?.value ?? '?';
  const cost = r.terms.find((x) => x.term.startsWith('cost'));
  if (r.kind === 'off-rung') return 'This item sits off the item-level rung (a consumable): the law prices it from its effect, not from item level or rarity.';
  if (r.kind === 'anchor') {
    return `A Unique anchor: ${fmt(cost?.stored ?? null)}g is hand-set against the item-level ${v('itemLevel')} Rare rung of ${fmt(cost?.law ?? null)}g (${v('rung')}g × ${v('itemLevel')} × Rare ${v('mult')}).`;
  }
  return `The shown price is ${v('rung')}g × item level ${v('itemLevel')} × ${v('rarity')} ${v('mult')} = ${fmt(cost?.law ?? null)}g, sold back at ${v('buyback')}.`;
}

/**
 * PROTOTYPE (`?ux=price-law`): an items Economy cell re-derived from ITEMS-PRICE-LAW as the cell
 * itself states it. Which inputs produce the price, each stored figure beside the law's own value,
 * and whether the graded ratio can fail at all. Display plus one input action (seed the Produce
 * direction with the contradictions). It never grades, never dispatches and cannot move a verdict.
 */
export function PriceLawPanel({ t, r, seeded, onSeed }: PriceLawPanelProps) {
  const line = { fontSize: 14, lineHeight: 1.5, color: t.text } as const;
  const block = { display: 'grid', gap: 6 } as const;
  const checked = r.terms.filter((x) => x.verdict === 'agrees' || x.verdict === 'contradicts').length;
  const bad = r.contradictions.length;

  return (
    <div data-testid="price-law-desk" style={{ display: 'grid', gap: 16 }}>
      <div style={block}>
        <span data-testid="price-law-headline" style={{ ...line, fontWeight: 600 }}>{headline(r)}</span>
        {!r.lawStated && (
          <span data-testid="price-law-missing" style={{ ...line, color: t.warn }}>
            ⚠ This cell stores no itemsPriceLaw block, so nothing here can be derived from the law.
          </span>
        )}
        <span data-testid="price-law-agreement" style={{ ...line, color: bad ? t.bad : t.text }}>
          {bad
            ? `✕ ${bad} of ${checked} stored figures contradict the law: ${r.contradictions.map((x) => x.term).join(', ')}.`
            : `✓ All ${checked} stored figures the law can check agree with it.`}
        </span>
        <span data-testid="price-law-bite" style={{ ...line, color: t.muted }}>
          {r.biteBand
            ? `On the rung, cost and expected price share every factor except power, so the graded ratio (${fmt(r.graded)}) is 100 / powerScore. It can fail only if powerScore leaves ${r.biteBand.lo}–${r.biteBand.hi}.`
            : r.kind === 'anchor'
              ? `The anchor is hand-set, so the graded ratio (${fmt(r.graded)}) does real work on this item.`
              : `The graded ratio (${fmt(r.graded)}) compares the price with its effect-fair value.`}
        </span>
      </div>

      <div style={block}>
        <MicroLabel mono uppercase tone="muted">Inputs that produce the price</MicroLabel>
        <DataTable t={t} testId="price-law-inputs" columns={INPUT_COLUMNS} header={['Input', '']} missingText="— not stated"
          rows={r.inputs.map((i) => ({ label: i.label, values: { value: i.value, from: i.from } }))} />
      </div>

      <div style={block}>
        <MicroLabel mono uppercase tone="muted">Stored figure against the law</MicroLabel>
        <DataTable t={t} testId="price-law-terms" columns={TERM_COLUMNS} header={['Figure', '']}
          rows={r.terms.map((x) => ({
            label: x.term,
            values: { formula: x.formula, law: fmt(x.law), stored: x.stored == null ? '—' : `${fmt(x.stored)} @ ${x.at}`, verdict: VERDICT_WORD[x.verdict] },
          }))} />
      </div>

      {bad > 0 && (
        <div style={{ ...block, borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
          <MicroLabel mono uppercase tone="muted">Next move</MicroLabel>
          <div>
            <LabButton t={t} testId="price-law-seed-direction" onClick={onSeed}>
              Seed a reconcile direction for the {bad} contradiction{bad === 1 ? '' : 's'}
            </LabButton>
          </div>
          {seeded && (
            <span data-testid="price-law-seeded" role="status" style={{ ...line, color: t.ok }}>
              ✓ Placed in the Produce direction box. Read it there before you dispatch.
            </span>
          )}
          <span style={{ ...line, color: t.muted }}>Seeding fills the direction box only. Nothing is dispatched or graded here.</span>
        </div>
      )}
    </div>
  );
}
