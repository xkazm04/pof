import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';
import type { ChecklistItem } from '@/types/modules';

const ui = (ARPG_CHECKLISTS as Record<string, ChecklistItem[]>)['arpg-ui'];
const byId = (id: string): ChecklistItem => {
  const item = ui.find((x) => x.id === id);
  if (!item) throw new Error(`No arpg-ui item ${id}`);
  return item;
};

describe('arpg-ui visualCheck opt-in flags', () => {
  for (const id of ['au-1', 'au-3', 'au-4', 'au-7', 'au-8']) {
    it(`${id} (renders an on-screen element) opts into visual verification`, () => {
      expect(byId(id).visualCheck).toBe(true);
    });
  }

  for (const id of ['au-2', 'au-5', 'au-6']) {
    it(`${id} (no new rendered element / slice-skip) does not opt in`, () => {
      expect(byId(id).visualCheck ?? false).toBe(false);
    });
  }
});
