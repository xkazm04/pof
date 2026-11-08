/**
 * The Item Stats Summary's Synergies count is coloured by the WORST active
 * synergy, so a "broken" combo is never painted with a milder severity just
 * because a milder rule comes first in SYNERGY_RULES.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ItemStatsSummary } from '@/components/modules/core-engine/sub_loot/affix-workbench/ItemStatsSummary';
import { SYNERGY_RULES } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import type { SynergyRule } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { defaultWallet, zeroWallet } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';

afterEach(() => cleanup());

const rule = (label: string) => {
  const r = SYNERGY_RULES.find((s) => s.label === label);
  if (!r) throw new Error(`no rule ${label}`);
  return r;
};

function synergyColor(active: SynergyRule[]): string {
  const { container } = render(
    <ItemStatsSummary craftedAffixes={[]} maxAffixes={4} itemLevel={25} activeSynergies={active}
      wallet={defaultWallet()} prefixLocked={false} suffixLocked={false} totalSpent={zeroWallet()} />,
  );
  const row = [...container.querySelectorAll('div')].find((d) => d.firstElementChild?.textContent === 'Synergies');
  if (!row) throw new Error('no Synergies row');
  const color = (row.lastElementChild as HTMLElement).style.color;
  cleanup();
  return color;
}

describe('ItemStatsSummary — synergy count colour', () => {
  it('a broken synergy wins over a strong one that precedes it in rule order', () => {
    const strong = rule('Crit Stacking');
    const broken = rule('Immortal');
    expect(SYNERGY_RULES.indexOf(strong)).toBeLessThan(SYNERGY_RULES.indexOf(broken));
    expect(synergyColor([strong, broken])).toBe(synergyColor([broken]));
  });
});
