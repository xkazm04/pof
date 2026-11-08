import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { simulateRolls, rollAffixesWithDNA } from '@/lib/item-dna/rolling-engine';
import {
  PRESET_GENOMES, DEMO_AFFIX_POOL, affixDisplayName,
} from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { SimulatorResults } from '@/components/modules/core-engine/sub_inventory/dna-genome/SimulatorResults';
import { RollResultCard } from '@/components/modules/core-engine/sub_inventory/dna-genome/RollResultCard';

/**
 * scan-sweep inventory-genome-economy: one affix had two display names. RollResultCard
 * printed a prefix as "Fierce Item" (and a suffix with a stray leading space), the
 * Monte Carlo table printed the same prefix as bare "Fierce". Both now read one rule.
 */

afterEach(cleanup);

const blade = PRESET_GENOMES[0];

describe('affix display name - one rule, two surfaces', () => {
  it('names prefixes and suffixes around the item', () => {
    const fierce = DEMO_AFFIX_POOL.find((a) => a.id === 'aff-atk')!;
    const strength = DEMO_AFFIX_POOL.find((a) => a.id === 'aff-str')!;
    expect(affixDisplayName(fierce)).toBe('Fierce Item');
    expect(affixDisplayName(strength)).toBe('Item of Strength');
  });

  it('the Monte Carlo per-affix table uses it for every row', () => {
    const stats = simulateRolls(blade, 'Legendary', 10, DEMO_AFFIX_POOL, 300, 0.85);
    const entries = Object.values(stats.affixFrequency);
    expect(entries.some((e) => e.affix.isPrefix)).toBe(true);
    render(<SimulatorResults stats={stats} />);
    for (const e of entries) {
      expect(screen.getAllByText(affixDisplayName(e.affix)).length).toBeGreaterThan(0);
    }
  });

  it('the roll card uses it for every rolled affix', () => {
    const result = rollAffixesWithDNA(blade, 'Legendary', 10, DEMO_AFFIX_POOL);
    const { container } = render(<RollResultCard result={result} genome={blade} />);
    const names = Array.from(container.querySelectorAll('span.font-bold.font-mono'))
      .map((el) => el.textContent ?? '');
    for (const ra of result.affixes) {
      expect(names).toContain(affixDisplayName(ra.affix));
    }
  });
});
