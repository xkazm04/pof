import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SimulatorResults } from '@/components/modules/core-engine/sub_inventory/dna-genome/SimulatorResults';
import { EvolutionTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EvolutionTab';
import { PRESET_GENOMES, DEMO_AFFIX_POOL } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { simulateRolls } from '@/lib/item-dna/rolling-engine';
import { EVOLUTION_TIERS, tierBonus } from '@/lib/item-dna/rules';

/**
 * Acceptance for scan-sweep --challenge card inventory-genome-economy/A (cases 6-8):
 * the dna-genome tabs render the item-DNA law from src/lib/item-dna/rules.ts, so a
 * caption can never again disagree with the engine that applies it.
 */

afterEach(cleanup);

describe('item-DNA rule displays', () => {
  it('case 6: the god-roll caption prints the threshold the run used', () => {
    const stats = simulateRolls(PRESET_GENOMES[0], 'Rare', 10, DEMO_AFFIX_POOL, 20);
    render(<SimulatorResults stats={{ ...stats, godRollThreshold: 0.9 }} />);
    expect(screen.getByText(/≥90% coherent/)).toBeTruthy();
    expect(screen.queryByText(/≥85% coherent/)).toBeNull();
  });

  it('case 7: the evolution panel reads the engine thresholds and its cumulative tier bonus', () => {
    const genome = {
      ...PRESET_GENOMES[1],
      evolution: { usageCount: 1, evolutionXP: 40, tier: 0, dominantTraits: [] },
    };
    render(<EvolutionTab selected={genome} doEvolve={vi.fn()} />);
    const next = screen.getByText('Next').parentElement!;
    expect(within(next).getByText('60')).toBeTruthy();

    const rows = screen.getAllByTestId('evolution-tier-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => within(r).getByTestId('evolution-tier-xp').textContent)).toEqual(['100 XP', '500 XP', '2000 XP']);
    const bonusTexts = rows.map((r) => within(r).getByTestId('evolution-tier-bonus').textContent);
    // Tier 2 is what case 1 applies: Mage Staff 0.80 -> 0.95 = +15%.
    expect(bonusTexts[1]).toBe('+15% dominant weight');
    expect(bonusTexts).toEqual(
      EVOLUTION_TIERS.map((t) => `+${Math.round(tierBonus(t.tier) * 100)}% dominant weight`),
    );
  });

  it('case 8: no dna-genome tab re-types an item-DNA rule literal', () => {
    const dir = path.resolve(__dirname, '../../../components/modules/core-engine/sub_inventory/dna-genome');
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(5);
    const forbidden: Array<[string, RegExp]> = [
      ['evolution thresholds', /\[\s*100\s*,\s*500\s*,\s*2000\s*\]/],
      ['god-roll threshold', /GOD_ROLL_THRESHOLD\s*=/],
      ['rarity order', /\[\s*'Common'\s*,\s*'Uncommon'\s*,\s*'Rare'\s*,\s*'Epic'\s*,\s*'Legendary'\s*\]/],
      ['item types', /\[\s*'Weapon'\s*,\s*'Armor'\s*,\s*'Consumable'\s*,\s*'Material'\s*,\s*'Accessory'\s*\]/],
      ['affix-count display map', /'Rare'\s*:\s*'3-4'/],
      ['level-scale formula', /1 \+ 0\.1 \*/],
      ['tier-row xp literal', /\bxp:\s*\d+/],
      ['tier-row bonus literal', /\+\d+% dominant weight/],
    ];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      for (const [name, re] of forbidden) {
        if (re.test(src)) hits.push(`${f}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
