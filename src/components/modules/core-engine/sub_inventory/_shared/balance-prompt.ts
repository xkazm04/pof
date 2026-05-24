import {
  DUMMY_ITEMS, SCALING_LINES, RARITY_DIST, AFFIX_EXAMPLES, ITEM_SETS,
  COMPARABLE_ITEMS, computeEffectiveDPS,
} from './data';
import type { ItemData } from './data';

/** Build the AI Balance Advisor prompt from current catalog data */
export function buildBalancePrompt(items: ItemData[]): string {
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
  const rarityDistSummary = RARITY_DIST.map(r => ({ rarity: r.rarity, expected: `${(r.expected * 100).toFixed(0)}%`, actual: `${(r.actual * 100).toFixed(0)}%` }));
  const affixPoolSummary = AFFIX_EXAMPLES.map(a => ({ name: a.name, modifier: a.stat, tier: a.tier, rarity: a.rarity }));
  const setBonusSummary = ITEM_SETS.map(set => ({ name: set.name, pieces: set.pieces.length, bonuses: set.bonuses.map(b => `${b.pieces}pc: ${b.description}`).join(', ') }));
  const dpsComparison = COMPARABLE_ITEMS.filter(i => i.stats.some(s => s.key === 'baseDmg' && s.value > 0)).map(i => {
    const { dps } = computeEffectiveDPS(i);
    return { name: i.name, rarity: i.rarity, slot: i.slot, effectiveDPS: dps.toFixed(1) };
  });

  return `You are an expert ARPG item economy balance advisor. Analyze the following item catalog data and produce a structured balance report.

## Item Catalog (${items.length} items)
${JSON.stringify(itemSummary, null, 2)}

## Affix Pool
${JSON.stringify(affixPoolSummary, null, 2)}

## Item Level Scaling Curves
${JSON.stringify(scalingSummary, null, 2)}

## Rarity Distribution (Expected vs Actual at Level 14)
${JSON.stringify(rarityDistSummary, null, 2)}

## Set Bonuses
${JSON.stringify(setBonusSummary, null, 2)}

## Effective DPS by Item
${JSON.stringify(dpsComparison, null, 2)}

---

Evaluate the item economy balance by checking:
1. **Power Budget per Rarity Tier**
2. **Affix Magnitude vs Item Level Curves**
3. **DPS Outliers**
4. **Set Bonus Power vs Individual Items**
5. **Rarity Distribution Health**

Return your analysis as a structured report with:
- An overall balance score (0-100)
- A list of specific balance warnings (severity: low/medium/high/critical)
- Suggested tuning values for each warning
- A brief summary paragraph`;
}
