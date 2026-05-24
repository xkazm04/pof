import { describe, it, expect } from 'vitest';
import { ENEMY_CONTRAST_MATERIALS } from '@/lib/knowledge/ue-known-assets';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

describe('ENEMY_CONTRAST_MATERIALS', () => {
  it('offers at least red/blue/green strong-contrast choices', () => {
    const colors = ENEMY_CONTRAST_MATERIALS.map((m) => m.color);
    expect(colors).toContain('red');
    expect(colors).toContain('blue');
    expect(colors).toContain('green');
  });

  it('defaults to the strong-red M_EnemyRed (not a subtle mannequin MI)', () => {
    const def = ENEMY_CONTRAST_MATERIALS.find((m) => m.isDefault);
    expect(def, 'a default contrast material').toBeTruthy();
    expect(def!.color).toBe('red');
    expect(def!.path).toBe('/Game/VerticalSlice/M_EnemyRed');
  });

  it('never recommends a mannequin MI as a contrast choice', () => {
    for (const m of ENEMY_CONTRAST_MATERIALS) {
      expect(m.path).not.toContain('MI_Manny');
    }
  });

  it('every entry has non-empty fields', () => {
    for (const m of ENEMY_CONTRAST_MATERIALS) {
      expect(m.id, 'id').toBeTruthy();
      expect(m.label, `label for ${m.id}`).toBeTruthy();
      expect(m.color, `color for ${m.id}`).toBeTruthy();
      expect(m.path, `path for ${m.id}`).toBeTruthy();
      expect(m.description, `description for ${m.id}`).toBeTruthy();
    }
  });
});

describe('arpg-enemy-ai create-enemy-variant flow bakes the contrast default', () => {
  const mod = SUB_MODULE_MAP['arpg-enemy-ai'];

  it('has a create-enemy quick action that defaults to a strong-contrast material', () => {
    const qa = (mod!.quickActions ?? []).find((a) => /enemy (type|variant)/i.test(a.label));
    expect(qa, 'a create-enemy quick action').toBeTruthy();
    expect(qa!.prompt).toContain('M_EnemyRed');
    expect(/strong(ly)?[- ]contrast/i.test(qa!.prompt)).toBe(true);
    // Bakes the lesson: do NOT use a subtle mannequin material instance.
    expect(/MI_Manny|material instance/i.test(qa!.prompt)).toBe(true);
  });
});
