import { describe, it, expect } from 'vitest';
import {
  PROMPT_CHIPS,
  PROMPT_CHIP_GROUPS,
  composeVisualPrompt,
  getChip,
} from '@/lib/visual-gen/prompt-chips';
import { STYLE_RULES } from '@/lib/visual-gen/style-keywords';

describe('prompt-chips vocabulary', () => {
  it('exposes Material, Mood and Game-style groups', () => {
    expect(PROMPT_CHIP_GROUPS.map((g) => g.id)).toEqual(['material', 'mood', 'gameStyle']);
    for (const group of PROMPT_CHIP_GROUPS) {
      expect(group.chips.length).toBeGreaterThan(0);
    }
  });

  it('has unique chip ids', () => {
    const ids = PROMPT_CHIPS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the requirement examples', () => {
    const labels = PROMPT_CHIPS.map((c) => c.label.toLowerCase());
    for (const example of ['stone', 'metal', 'wood', 'fabric', 'glass', 'dark souls', 'hollow knight', 'zelda']) {
      expect(labels).toContain(example);
    }
  });

  // The whole point of the feature: chips reuse the style-transfer keyword
  // rules so a chip-built prompt is still understood by the same analyzer.
  it('grounds every chip keyword in a STYLE_RULES rule', () => {
    for (const chip of PROMPT_CHIPS) {
      const grounded = STYLE_RULES.some((rule) => rule.keywords.includes(chip.keyword));
      expect(grounded, `chip "${chip.id}" keyword "${chip.keyword}" must exist in STYLE_RULES`).toBe(true);
    }
  });

  it('embeds each chip keyword inside its fragment (stays analyzable downstream)', () => {
    for (const chip of PROMPT_CHIPS) {
      expect(
        chip.fragment.toLowerCase().includes(chip.keyword),
        `fragment for "${chip.id}" must contain keyword "${chip.keyword}"`,
      ).toBe(true);
    }
  });
});

describe('composeVisualPrompt', () => {
  it('returns empty string with no subject and no chips', () => {
    expect(composeVisualPrompt({})).toBe('');
    expect(composeVisualPrompt({ subject: '   ', chipIds: [] })).toBe('');
  });

  it('appends technical quality phrasing to a bare subject', () => {
    const out = composeVisualPrompt({ subject: 'a medieval sword' });
    expect(out.startsWith('a medieval sword,')).toBe(true);
    expect(out).toContain('game-ready 3D asset');
    expect(out).toContain('PBR materials');
  });

  it('injects the fragment for a selected chip', () => {
    const stone = getChip('mat-stone')!;
    const out = composeVisualPrompt({ subject: 'a tower', chipIds: ['mat-stone'] });
    expect(out).toContain(stone.fragment);
    expect(out).toContain('a tower');
  });

  it('orders fragments material → mood → gameStyle regardless of selection order', () => {
    const out = composeVisualPrompt({
      subject: 'a shield',
      chipIds: ['game-zelda', 'mood-glowing', 'mat-metal'],
    });
    const metalIdx = out.indexOf(getChip('mat-metal')!.fragment);
    const moodIdx = out.indexOf(getChip('mood-glowing')!.fragment);
    const styleIdx = out.indexOf(getChip('game-zelda')!.fragment);
    expect(metalIdx).toBeGreaterThan(-1);
    expect(metalIdx).toBeLessThan(moodIdx);
    expect(moodIdx).toBeLessThan(styleIdx);
  });

  it('works with chips only (no subject) for image-to-3d style direction', () => {
    const out = composeVisualPrompt({ chipIds: ['mat-wood'], mode: 'image-to-3d' });
    expect(out).toContain('wood');
    expect(out).toContain('game-ready 3D asset');
  });

  it('ignores unknown chip ids', () => {
    const out = composeVisualPrompt({ subject: 'a gem', chipIds: ['does-not-exist'] });
    expect(out.startsWith('a gem,')).toBe(true);
    expect(out).toContain('game-ready 3D asset');
  });
});
