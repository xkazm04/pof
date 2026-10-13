import { PRICE_RATIO } from '@/lib/catalog/acceptance/invariants';

/** The `?ux=` slug that opts into this prototype. */
export const PRICE_LAW_UX = 'price-law';
/** The step the [UX] proposal is about, and the one catalog whose cells carry the price law. */
export const PRICE_LAW_STEPS: ReadonlySet<string> = new Set(['Economy']);
export const PRICE_LAW_CATALOG = 'items';

/** The three power slots the registered `sumReconciles` checker adds up. */
export const POWER_SLOTS = ['dpsPower', 'implicitAccuracyPower', 'affixPower'] as const;

/** The law constants as THIS cell's stored `itemsPriceLaw` block states them; null = not stated. */
export interface PriceLaw {
  rung: number | null;
  multipliers: Record<string, number>;
  buybackPct: number | null;
}

/** How the law prices this item: the ilvl rung, a hand-set Unique anchor, or off the rung (consumable). */
export type PriceKind = 'rung' | 'anchor' | 'off-rung';
export type TermVerdict = 'agrees' | 'contradicts' | 'derived' | 'unstated' | 'underivable' | 'anchor';

export interface PriceInput { key: string; label: string; value: string | number | null; from: string }
export interface PriceTerm {
  term: string;
  formula: string;
  law: number | null;
  stored: number | null;
  /** Field path the stored figure was read from. */
  at: string;
  verdict: TermVerdict;
}
export interface PriceLawCheck {
  kind: PriceKind;
  lawStated: boolean;
  inputs: PriceInput[];
  terms: PriceTerm[];
  contradictions: PriceTerm[];
  /** The ratio the checker grades (top-level `pricePowerRatio`) and the power band it can bite inside. */
  graded: number | null;
  biteBand: { lo: number; hi: number } | null;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Read the law constants out of the cell's own stored block. Nothing is defaulted. */
export function parseLaw(block: unknown): PriceLaw {
  const b = obj(block);
  const rung = /(\d+(?:\.\d+)?)\s*g\s*(?:per\s+itemLevel\s*)?x\s*itemLevel/i.exec(String(b.gearNormalRung ?? ''));
  const buyback = /sell\s*=\s*(\d+(?:\.\d+)?)\s*%/i.exec(String(b.buyback ?? ''));
  const multipliers = Object.fromEntries(Object.entries(obj(b.rarityMultiplier))
    .map(([k, v]) => [k, num(v)] as const).filter((e): e is [string, number] => e[1] != null));
  return { rung: rung ? Number(rung[1]) : null, multipliers, buybackPct: buyback ? Number(buyback[1]) : null };
}

/** Rounding tolerance per term: whole gold, 2dp ratio, 3dp gold-per-power, exact points. */
function judge(law: number | null, stored: number | null, tol: number): TermVerdict {
  if (law == null) return 'underivable';
  if (stored == null) return 'unstated';
  return Math.abs(law - stored) <= tol + 1e-9 ? 'agrees' : 'contradicts';
}

/**
 * Re-derive an items Economy cell from ITEMS-PRICE-LAW as the cell itself states it, and set every
 * figure the cell stores beside the law's own value. Pure; reads only `data`.
 */
export function checkPriceLaw(data: Record<string, unknown>): PriceLawCheck {
  const e = obj(data.economy);
  const cm = obj(e.costModel);
  const pc = obj(e.priceCheck);
  const vendor = obj(e.vendor);
  const law = parseLaw(e.itemsPriceLaw);
  const lawStated = law.rung != null || Object.keys(law.multipliers).length > 0 || law.buybackPct != null;

  const ilvl = num(cm.itemLevel) ?? num(e.itemLevel);
  const anchor = num(cm.anchor);
  const kind: PriceKind = anchor != null ? 'anchor' : ilvl != null ? 'rung' : 'off-rung';
  const rarity = str(cm.rarity) ?? str(e.rarity) ?? (kind === 'anchor' ? 'Unique' : null);
  // A Unique is anchored to the same-ilvl Rare rung (the law's own wording), never multiplied.
  const multKey = kind === 'anchor' ? 'Rare' : rarity;
  const mult = multKey ? law.multipliers[multKey] ?? null : null;
  const cost = num(e.baseValue);
  const breakdown = obj(e.powerBreakdown);
  const slots = POWER_SLOTS.map((k) => num(breakdown[k]));
  const powerSum = slots.every((s) => s != null) ? slots.reduce((a: number, s) => a + (s as number), 0) : null;
  const power = num(e.powerScore);

  const inputs: PriceInput[] = [
    { key: 'itemLevel', label: 'Item level', value: ilvl, from: 'economy.costModel.itemLevel' },
    { key: 'rarity', label: 'Rarity', value: rarity, from: str(cm.rarity) ? 'economy.costModel.rarity' : kind === 'anchor' ? 'economy.costModel.anchor (Unique)' : 'economy.rarity' },
    { key: 'rung', label: 'Vendor rung (g per ilvl)', value: law.rung, from: 'itemsPriceLaw.gearNormalRung' },
    { key: 'mult', label: `Rarity multiplier${multKey && multKey !== rarity ? ` (${multKey} rung)` : ''}`, value: mult, from: `itemsPriceLaw.rarityMultiplier${multKey ? `.${multKey}` : ''}` },
    { key: 'buyback', label: 'Sell ratio', value: law.buybackPct != null ? `${law.buybackPct}%` : null, from: 'itemsPriceLaw.buyback' },
    { key: 'power', label: 'Power score', value: power, from: 'economy.powerScore' },
  ];

  const onRung = kind !== 'off-rung' && law.rung != null && ilvl != null;
  const vendorBase = onRung ? law.rung! * ilvl! : null;
  const rungCost = vendorBase != null && mult != null ? Math.round(vendorBase * mult) : null;
  const gpp = vendorBase != null && mult != null ? (vendorBase * mult) / 100 : null;
  const expected = gpp != null && power != null ? power * gpp : null;
  const fair = num(pc.effectFairValue);
  const ratioLaw = kind === 'off-rung'
    ? (cost != null && fair ? cost / fair : null)
    : (cost != null && expected ? cost / expected : null);
  const storedRatio = num(e.pricePowerRatio);
  const graded = num(data.pricePowerRatio);
  const sellLaw = cost != null && law.buybackPct != null ? cost * law.buybackPct / 100 : null;

  const terms: PriceTerm[] = [];
  const push = (t: Omit<PriceTerm, 'verdict'>, tol: number, verdict?: TermVerdict) => terms.push({ ...t, verdict: verdict ?? judge(t.law, t.stored, tol) });
  if (kind !== 'off-rung') {
    push({ term: 'vendorBaseValue', formula: `rung ${law.rung ?? '?'}g × ilvl ${ilvl ?? '?'}`, law: vendorBase, stored: num(cm.vendorBaseValue), at: 'economy.costModel.vendorBaseValue' }, 0.5);
    if (kind === 'anchor') {
      push({ term: 'cost (Unique anchor)', formula: `hand-set; Rare rung = round(${vendorBase ?? '?'} × ${mult ?? '?'}) = ${rungCost ?? '?'}g${rungCost && cost != null ? ` → anchor is ${(cost / rungCost).toFixed(3)}× the rung` : ''}`, law: rungCost, stored: cost, at: 'economy.baseValue' }, 0, 'anchor');
    } else {
      push({ term: 'cost', formula: `round(${vendorBase ?? '?'} × ${rarity ?? '?'} ${mult ?? '?'})`, law: rungCost, stored: cost, at: 'economy.baseValue' }, 0.5);
    }
    push({ term: 'goldPerPower', formula: `${law.rung ?? '?'} × ${ilvl ?? '?'} × ${mult ?? '?'} / 100`, law: gpp, stored: num(pc.goldPerPower), at: 'economy.priceCheck.goldPerPower' }, 0.0005);
  }
  push({ term: 'powerScore', formula: POWER_SLOTS.map((k, i) => `${k} ${slots[i] ?? '?'}`).join(' + '), law: powerSum, stored: power, at: 'economy.powerScore' }, 0);
  if (kind !== 'off-rung') {
    push({ term: 'expectedPrice', formula: `powerScore ${power ?? '?'} × goldPerPower ${gpp != null ? Math.round(gpp * 1000) / 1000 : '?'}`, law: expected, stored: null, at: '(not stored as a number)' }, 0, expected != null ? 'derived' : 'underivable');
  }
  push({ term: 'pricePowerRatio', formula: kind === 'off-rung' ? `cost ${cost ?? '?'} / effect-fair ${fair ?? '?'}` : `cost ${cost ?? '?'} / expectedPrice ${expected != null ? round2(expected) : '?'}`, law: ratioLaw, stored: storedRatio, at: 'economy.pricePowerRatio' }, 0.005);
  push({ term: 'pricePowerRatio (graded copy)', formula: 'the checker grades this top-level copy', law: storedRatio, stored: graded, at: 'pricePowerRatio' }, 0);
  push({ term: 'sell', formula: `${cost ?? '?'} × ${law.buybackPct ?? '?'}%`, law: sellLaw, stored: num(vendor.sell) ?? num(e.sellValue), at: num(vendor.sell) != null ? 'economy.vendor.sell' : 'economy.sellValue' }, 0.5);

  // On the rung, cost and expectedPrice share every factor but power, so the ratio is 100 / power:
  // it can only leave the canon band when power leaves [100 / max, 100 / min].
  const biteBand = kind === 'rung' ? { lo: round2(100 / PRICE_RATIO.max), hi: round2(100 / PRICE_RATIO.min) } : null;
  return { kind, lawStated, inputs, terms, contradictions: terms.filter((t) => t.verdict === 'contradicts'), graded, biteBand };
}

const fmt = (n: number | null) => (n == null ? '—' : Number.isInteger(n) ? String(n) : String(round2(n)));

/** A Produce direction naming each contradiction with the law's own figure. Empty when none. */
export function priceLawDirection(entityName: string, r: PriceLawCheck): string {
  if (!r.contradictions.length) return '';
  const lines = r.contradictions.map((t) => `${t.term} stores ${fmt(t.stored)} at ${t.at}; the law gives ${fmt(t.law)} (${t.formula}).`);
  return `Reconcile the Economy cell for "${entityName}" with ITEMS-PRICE-LAW as this cell states it. ${lines.join(' ')} Change the stored figure or the input that produced it, and keep every mirror (pricePowerRatio top-level and economy) equal.`;
}

export { fmt as formatPriceFigure };
