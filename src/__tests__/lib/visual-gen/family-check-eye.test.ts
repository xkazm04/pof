// /diablo D28 (operator, 2026-09-24): the blind family check is judged by GEMINI. W08 measured the two eyes agreeing
// on the negative control 12/12 but splitting on recoloured skeletons (local model: zombie 0/6, gemini: skeleton 15/15)
// — the local model's colour prior was deciding. No silent fallback: an outage is an unchecked verdict, not a
// verdict from the eye the operator ruled out.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const seen: unknown[] = [];
vi.mock('@/lib/vision/seam', () => ({
  makeRoutedVisionText: (opts: unknown) => {
    seen.push(opts);
    return async () => 'FAMILY=skeleton; CONFIDENCE=0.9; CUES=ribs';
  },
}));

import { checkFamily, FAMILY_CHECK_PLAN } from '@/lib/visual-gen/family-check';

describe('the family check eye', () => {
  beforeEach(() => { seen.length = 0; });

  it('routes to gemini only — no local fallback', async () => {
    expect(FAMILY_CHECK_PLAN).toEqual(['gemini']);
    const v = await checkFamily({ base64: 'x', mime: 'image/jpeg' }, 'skeleton', ['zombie', 'skeleton']);
    expect(seen[0]).toEqual({ plan: ['gemini'] });
    expect(v.ok && v.eye).toBe('gemini');
  });

  it('names an injected eye as injected, never as gemini', async () => {
    const v = await checkFamily({ base64: 'x', mime: 'image/jpeg' }, 'skeleton', ['zombie', 'skeleton'], { vision: async () => 'FAMILY=zombie; CONFIDENCE=1; CUES=x' });
    expect(v.ok && v.eye).toBe('injected');
    expect(seen).toHaveLength(0);
  });
});
