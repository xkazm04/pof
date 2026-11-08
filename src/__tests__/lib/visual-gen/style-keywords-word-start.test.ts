import { describe, it, expect } from 'vitest';
import { STYLE_RULES, matchesStyleKeyword } from '@/lib/visual-gen/style-keywords';
import { PROMPT_CHIPS } from '@/lib/visual-gen/prompt-chips';

const hits = (text: string) =>
  STYLE_RULES.filter((r) => r.keywords.some((kw) => matchesStyleKeyword(text.toLowerCase(), kw)));

describe('style keyword matching starts at a word', () => {
  it('does not read a keyword out of the middle of another word', () => {
    expect(matchesStyleKeyword('weathered rock surface', 'face')).toBe(false);
    expect(matchesStyleKeyword('forest environment', 'iron')).toBe(false);
    expect(matchesStyleKeyword('a low price', 'ice')).toBe(false);
  });

  it('still matches the keyword as a word and as a word stem', () => {
    expect(matchesStyleKeyword('a stone face', 'face')).toBe(true);
    expect(matchesStyleKeyword('glowing runes', 'glow')).toBe(true);
    expect(matchesStyleKeyword('dark souls mood', 'dark souls')).toBe(true);
  });

  it('no chip fragment reads as skin because it says "surface"', () => {
    const skin = STYLE_RULES.find((r) => r.surfaceType === 'skin')!;
    const wrong = PROMPT_CHIPS.filter((c) => hits(c.fragment).includes(skin)).map((c) => c.id);
    // "faceted" begins with "face" but is not it (STEM_LOOKALIKES), so no chip reads as skin.
    expect(wrong).toEqual([]);
  });

  it('every chip keyword still resolves in its own fragment', () => {
    for (const c of PROMPT_CHIPS) expect(matchesStyleKeyword(c.fragment.toLowerCase(), c.keyword), c.id).toBe(true);
  });
});
