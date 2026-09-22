// /diablo W04 (D15): the family check is the instrument that can FAIL a concept image — W03's
// "zombie" rendered as a skeleton 3 of 3 times and the selection-only checker could not see it.
import { describe, it, expect, vi } from 'vitest';
import { buildFamilyPrompt, checkFamily, parseFamilyReply } from '@/lib/visual-gen/family-check';

const IMG = { base64: 'x', mime: 'image/jpeg' };
const FAMILIES = ['zombie', 'skeleton', 'goat-demon'];

describe('family check — pure cores', () => {
  it('lists the families plus "other" and never names the expected one', () => {
    const p = buildFamilyPrompt(FAMILIES);
    expect(p).toContain('zombie | skeleton | goat-demon | other');
    expect(p).not.toMatch(/expected|should be|generated as/i);
  });

  it('parses the marker line, clamping confidence', () => {
    expect(parseFamilyReply('FAMILY=Skeleton; CONFIDENCE=1.4; CUES=bare ribs, no flesh', FAMILIES))
      .toEqual({ family: 'skeleton', confidence: 1, cues: 'bare ribs, no flesh' });
  });

  it('refuses a family that was not offered (a free answer cannot pass)', () => {
    expect(parseFamilyReply('FAMILY=ghoul; CONFIDENCE=0.8; CUES=x', FAMILIES)).toEqual({ error: 'FAMILY="ghoul" is not one of the offered families' });
    expect(parseFamilyReply('it is a zombie', FAMILIES)).toEqual({ error: 'no FAMILY= marker in the vision reply' });
  });
});

describe('checkFamily verdicts', () => {
  it('FAILS a zombie that reads as a skeleton, naming both', async () => {
    const v = await checkFamily(IMG, 'zombie', FAMILIES, { vision: async () => 'FAMILY=skeleton; CONFIDENCE=0.9; CUES=exposed rib cage' });
    expect(v.ok && v.pass).toBe(false);
    expect(v.ok && v.reason).toMatch(/generated as "zombie" but reads as "skeleton"/);
  });

  it('passes a figure that reads as its own family', async () => {
    const v = await checkFamily(IMG, 'Zombie', FAMILIES, { vision: async () => 'FAMILY=zombie; CONFIDENCE=0.7; CUES=slack flesh' });
    expect(v.ok && v.pass).toBe(true);
  });

  it('a vision failure or an unparseable reply is a described outcome, never a pass', async () => {
    const down = await checkFamily(IMG, 'zombie', FAMILIES, { vision: async () => { throw new Error('quota'); } });
    expect(down).toMatchObject({ ok: false, error: 'quota' });
    const junk = await checkFamily(IMG, 'zombie', FAMILIES, { vision: async () => 'looks scary' });
    expect(junk.ok).toBe(false);
  });

  it('refuses a rigged check whose expected family is not offered, without calling vision', async () => {
    const vision = vi.fn();
    const v = await checkFamily(IMG, 'zombie', ['skeleton'], { vision });
    expect(v.ok).toBe(false);
    expect(vision).not.toHaveBeenCalled();
  });
});
