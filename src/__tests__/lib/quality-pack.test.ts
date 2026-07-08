import { describe, it, expect } from 'vitest';
import { qualityPack, PROMPT_VERSION } from '@/lib/prompts/quality';
import { DIMENSIONS, STYLE_ANCHORS } from '@/lib/judge/dimensions';

describe('quality prompt pack (WS1)', () => {
  it('has a stamped version', () => {
    expect(PROMPT_VERSION).toMatch(/^q\d+$/);
  });

  it('shares the judge’s craft checklist (anti-drift: same DIMENSIONS source)', () => {
    const pack = qualityPack('2d-art', 'items');
    for (const d of DIMENSIONS['2d-art']) {
      expect(pack).toContain(d.key);
      expect(pack).toContain(d.bar);
    }
  });

  it('carries role framing, the named anchor, and hard constraints', () => {
    const pack = qualityPack('3d-mesh', 'items');
    expect(pack).toMatch(/senior 3D/);
    expect(pack).toContain(STYLE_ANCHORS['3d-mesh']);
    expect(pack).toMatch(/hero framing/); // a 3d negative constraint
    expect(pack).toContain('items');
  });

  it('text-config pack forbids filler and sibling contradictions', () => {
    const pack = qualityPack('text-config', 'quests');
    expect(pack).toMatch(/filler|boilerplate/);
    expect(pack).toMatch(/contradiction/);
  });
});
