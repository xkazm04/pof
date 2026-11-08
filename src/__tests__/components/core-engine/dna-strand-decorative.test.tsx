import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { DNAStrand } from '@/components/modules/core-engine/sub_inventory/dna-genome/DNAStrand';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/** scan-sweep inventory-genome-economy: the strand is decorative (the radar carries the data) and its comment must state the real base count. */

afterEach(cleanup);

describe('DNAStrand', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<DNAStrand genome={createGenome('Probe', ACCENT_VIOLET, {})} />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('its comment states the rendered pair count, not a stale 40', () => {
    const file = path.join(process.cwd(), 'src/components/modules/core-engine/sub_inventory/dna-genome/DNAStrand.tsx');
    const src = fs.readFileSync(file, 'utf8');
    const rendered = Number(/const bases = (\d+)/.exec(src)![1]);
    const claimed = /(\d+) base pairs/.exec(src);
    expect(claimed && Number(claimed[1])).toBe(rendered);
  });
});
