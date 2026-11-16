import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';
import {
  AUTO_SAVE_TRIGGERS, AUTO_SAVE_CONFIG,
} from '@/components/modules/core-engine/sub_save/_shared/data-panels';

const item = (id: string) => ARPG_CHECKLISTS['arpg-save'].find((c) => c.id === id)!;

describe('auto-save panel agrees with the as-5 / as-6 checklist', () => {
  it('enables every trigger as-5 requires', () => {
    const required: Record<string, string> = { zone: 'zone transitions', boss: 'boss kill', levelup: 'level-up' };
    const prompt = item('as-5').prompt.toLowerCase();
    const off: string[] = [];
    for (const [id, phrase] of Object.entries(required)) {
      expect(prompt).toContain(phrase);
      if (!AUTO_SAVE_TRIGGERS.find((t) => t.id === id)?.enabled) off.push(id);
    }
    expect(off).toEqual([]);
  });

  it('offers as many auto-saves as as-6 has auto-save slots', () => {
    const m = /(\d+)\s+auto-save slot/i.exec(item('as-6').prompt);
    expect(m).not.toBeNull();
    expect(AUTO_SAVE_CONFIG.maxAutoSaves).toBe(Number(m![1]));
  });
});
