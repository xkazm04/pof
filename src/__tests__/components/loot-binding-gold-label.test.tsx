import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';
import { EnemyLootBindingSection } from '@/components/modules/core-engine/sub_loot/core/EnemyLootBinding';

beforeEach(() => resetLootTuning());
afterEach(cleanup);

// The card's figure is simKillCount * bonusGold: bonus gold only, no item value. The EV
// calculator's per-kill total includes items, so this line must not also say "Total gold".
describe('Enemy loot binding card gold line', () => {
  it('names the kills * bonusGold figure as bonus gold', () => {
    const { container } = render(<EnemyLootBindingSection />);
    expect(container.textContent).toContain('Bonus gold (100 kills)');
    expect(container.textContent).not.toContain('Total gold (');
  });
});
