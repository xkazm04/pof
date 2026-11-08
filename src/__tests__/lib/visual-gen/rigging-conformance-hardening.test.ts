import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VisionImage } from '@/lib/anim-critique/critique';
import type { RenderedView } from '@/lib/visual-gen/mesh-views';
import {
  critiqueReferenceConformance,
  parseConformanceReply,
  scoreConformance,
} from '@/lib/visual-gen/reference-conformance';

describe('reference conformance: a reply outside the scale is not a verdict', () => {
  it('refuses a severity below the scale rather than reading it as a match', () => {
    const reply = parseConformanceReply('DIVERGENCES=none; SEVERITY=-1');
    expect(reply.ok).toBe(false);
    expect(scoreConformance(reply).verdict).toBe('unmeasured');
  });

  it('still reads every value on the scale', () => {
    for (const s of [0, 1, 2, 3]) {
      expect(parseConformanceReply(`DIVERGENCES=none; SEVERITY=${s}`).severity).toBe(s);
    }
  });
});

describe('reference conformance: the "none" sentinel', () => {
  it('reads a punctuated none as no divergences, so severity 0 is a match', () => {
    const reply = parseConformanceReply('DIVERGENCES=None.; SEVERITY=0');
    expect(reply.divergences).toEqual([]);
    expect(scoreConformance(reply).verdict).toBe('match');
  });
});

describe('reference conformance: the image the vision call is told about', () => {
  it('announces a webp reference as webp', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pof-ref-'));
    try {
      const reference = join(dir, 'concept.webp');
      const render = join(dir, 'front.png');
      writeFileSync(reference, 'x');
      writeFileSync(render, 'x');
      let seen: VisionImage[] = [];
      await critiqueReferenceConformance(reference, [{ yawDeg: 0, imagePath: render } as RenderedView], {
        vision: async (images) => { seen = images; return 'DIVERGENCES=none; SEVERITY=0'; },
      });
      expect(seen[0].mime).toBe('image/webp');
      expect(seen[1].mime).toBe('image/png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
