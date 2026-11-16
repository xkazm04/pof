import { describe, it, expect } from 'vitest';
import { distillStyleDna, parseStyleDnaReply, styleDnaToPromptFragment } from '@/lib/visual-gen/style-dna';
import { validateStyleDna } from '@/lib/visual-gen/style-dna-edit';

const img = { mime: 'image/png', base64: 'AAAA' };
const EMPTY_REPLY = 'PALETTE=none; MATERIALS=none; MOOD=none; RENDER=none; MOTIFS=none.';

describe('distillStyleDna — a reply naming no style is a failure, never a saved profile', () => {
  it('the hole: an all-empty DNA renders a fragment with no style in it', () => {
    const dna = { palette: [], materials: [], mood: [], render: [], motifs: [] };
    // What would be appended to every generation prompt once this profile became active.
    expect(styleDnaToPromptFragment(dna)).toBe('In the established project art style — .');
    // ...and the edit path already refuses exactly this DNA.
    expect(validateStyleDna(dna).ok).toBe(false);
  });

  it('refuses an all-none reply with the reason and the raw text', async () => {
    const r = await distillStyleDna([img], { vision: async () => EMPTY_REPLY });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/no style chips/);
      expect(r.raw).toBe(EMPTY_REPLY);
    }
  });

  it("the protocol's own closing period is not part of the last chip", () => {
    // buildStyleDnaPrompt asks for the line to END with '.', so a compliant reply carries it.
    expect(parseStyleDnaReply('PALETTE=red; MATERIALS=iron; MOOD=grim; RENDER=painterly; MOTIFS=none.').dna?.motifs).toEqual([]);
    expect(parseStyleDnaReply('PALETTE=red; MATERIALS=iron; MOOD=grim; RENDER=painterly; MOTIFS=skulls, chains.').dna?.motifs)
      .toEqual(['skulls', 'chains']);
  });

  it('still accepts a reply with at least one chip', async () => {
    const r = await distillStyleDna([img], { vision: async () => 'PALETTE=none; MATERIALS=none; MOOD=grim; RENDER=none; MOTIFS=none' });
    expect(r.ok).toBe(true);
  });
});
