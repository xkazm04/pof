import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';

const COMBAT = ARPG_CHECKLISTS['arpg-combat'];

describe('arpg-combat wiring contracts', () => {
  it('every combat checklist item names the four wiring points', () => {
    for (const item of COMBAT) {
      const p = item.prompt;
      expect(p, `${item.id} Granted by`).toMatch(/Granted by/i);
      expect(p, `${item.id} Activated by`).toMatch(/Activated by/i);
      expect(p, `${item.id} Damage path`).toMatch(/Damage path/i);
      expect(p, `${item.id} Required content assets`).toMatch(/Required content assets/i);
    }
  });

  it('the melee item defaults its damage path to Direct (gray-box)', () => {
    const acb1 = COMBAT.find((c) => c.id === 'acb-1')!;
    expect(acb1.prompt).toMatch(/Damage path[^\n]*Direct/i);
    expect(acb1.prompt).toContain('bUseAnimationDrivenDamage');
  });

  it('the combat checklist prompts are stable', () => {
    expect(COMBAT.map((c) => ({ id: c.id, prompt: c.prompt }))).toMatchSnapshot();
  });
});
