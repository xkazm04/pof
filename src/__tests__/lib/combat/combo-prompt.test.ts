import { describe, it, expect } from 'vitest';
import { buildComboPrompt } from '@/lib/combat/combo-prompt';

describe('buildComboPrompt', () => {
  it('names the combo, weapon category, and trimmed instruction', () => {
    const p = buildComboPrompt('Whirlwind Slash', 'Sword', '  add a launcher finisher  ');
    expect(p).toContain('Whirlwind Slash');
    expect(p).toContain('Sword');
    expect(p).toContain('add a launcher finisher');
    expect(p).not.toContain('  add a launcher'); // trimmed
  });

  it('instructs reuse of montage combo windows / GAS rather than inventing a system', () => {
    const p = buildComboPrompt('X', 'Axe', 'faster');
    expect(p).toContain('AnimMontage');
    expect(p).toMatch(/GAS|ability/i);
  });

  it('works with an empty instruction', () => {
    const p = buildComboPrompt('Y', 'Mace', '');
    expect(p.length).toBeGreaterThan(0);
    expect(p).toContain('Y');
  });
});
