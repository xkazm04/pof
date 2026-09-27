import { SCALING_LINES, RARITY_DIST, ITEM_SETS } from './data';
import type { ItemData } from './data';
import type { ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import type { ItemRarity } from '@/types/economy-simulator';
import { deriveAffixPool, deriveDpsTable, rarityEvidence } from './balance-evidence';

/** Optional measured evidence: an economy-sim run and the level to read its rarity bracket at. */
export interface BalanceEvidenceInput {
  sim?: ItemEconomyResult | null;
  /** Level whose rarity bracket is quoted (default 14). */
  level?: number;
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function raritySection(evidence: BalanceEvidenceInput): string {
  const ev = rarityEvidence(evidence.sim ?? null, evidence.level ?? 14);
  const heading = `## Rarity Distribution at Level ${ev.level} (design target vs measured)`;
  if (ev.state === 'unmeasured') {
    const rows = RARITY_DIST.map(r => ({ rarity: r.rarity, designTarget: pct(r.expected) }));
    return `${heading}\n${JSON.stringify(rows, null, 2)}\nMeasured: UNMEASURED - ${ev.reason}. Treat the measured distribution as unknown; do not infer one.`;
  }
  const rows = RARITY_DIST.map(r => ({
    rarity: r.rarity, designTarget: pct(r.expected),
    measured: pct(ev.shares[r.rarity.toLowerCase() as ItemRarity] ?? 0),
  }));
  return `${heading}\n${JSON.stringify(rows, null, 2)}\nBasis: ${ev.basis}`;
}

function dpsSection(items: ItemData[]): string {
  const weapons = items.filter(i => i.type === 'Weapon');
  const { rows, unparsed } = deriveDpsTable(weapons);
  const byReason: Record<string, string[]> = {};
  for (const u of unparsed) (byReason[u.reason] ??= []).push(u.name);
  const unparsedNote = unparsed.length === 0 ? '' :
    `\nUnparsed: ${unparsed.length} of ${weapons.length} weapons state no DPS-computable Damage/Speed; they are excluded, not zero:\n${JSON.stringify(byReason, null, 2)}`;
  return `## Effective DPS by Item (avg damage per hit x attacks per second, from each weapon's own stats; ${rows.length} of ${weapons.length} weapons)\n${JSON.stringify(rows, null, 2)}${unparsedNote}`;
}

/**
 * Build the AI Balance Advisor prompt. Every section is derived from `items` or
 * from a measured sim run in `evidence`; what was not measured says UNMEASURED.
 */
export function buildBalancePrompt(items: ItemData[], evidence: BalanceEvidenceInput = {}): string {
  const itemSummary = items.map(item => ({
    name: item.name, type: item.type, subtype: item.subtype, rarity: item.rarity,
    stats: item.stats.map(s => `${s.label}: ${s.value}`).join(', '),
    affixes: item.affixes?.map(a => `${a.name} (${a.stat}, ${a.category})`).join('; ') ?? 'none',
    effect: item.effect ?? 'none',
  }));
  const scalingSummary = SCALING_LINES.map(line => ({
    curve: line.label, range: `Level ${line.points[0].level}-${line.points[line.points.length - 1].level}`,
    minAtStart: line.points[0].min.toFixed(1), maxAtEnd: line.points[line.points.length - 1].max.toFixed(1),
  }));
  const affixPool = deriveAffixPool(items);
  const setBonusSummary = ITEM_SETS.map(set => ({ name: set.name, pieces: set.pieces.length, bonuses: set.bonuses.map(b => `${b.pieces}pc: ${b.description}`).join(', ') }));

  return `You are an expert ARPG item economy balance advisor. Analyze the following item catalog data and produce a structured balance report.

## Item Catalog (${items.length} items)
${JSON.stringify(itemSummary, null, 2)}

## Affix Pool (${affixPool.length} distinct affix name${affixPool.length === 1 ? '' : 's'} carried by the items above)
${JSON.stringify(affixPool, null, 2)}

## Item Level Scaling Curves
${JSON.stringify(scalingSummary, null, 2)}

${raritySection(evidence)}

## Set Bonuses
${JSON.stringify(setBonusSummary, null, 2)}

${dpsSection(items)}

---

Evaluate the item economy balance by checking:
1. **Power Budget per Rarity Tier**
2. **Affix Magnitude vs Item Level Curves**
3. **DPS Outliers**
4. **Set Bonus Power vs Individual Items**
5. **Rarity Distribution Health** (only if measured above; an UNMEASURED distribution is a coverage gap to report, not a value to judge)

Return your analysis as a structured report with:
- An overall balance score (0-100)
- A list of specific balance warnings (severity: low/medium/high/critical)
- Suggested tuning values for each warning
- A brief summary paragraph`;
}
