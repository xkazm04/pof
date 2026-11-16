/**
 * The coach-adjacent lab banners and digests read the lab's type/spacing/radius tokens
 * (`--lab-fs-* / --lab-s* / --lab-r-*`, lab-tokens.css), as the two coaches beside them do.
 * A raw px fontSize / gap / borderRadius / padding here follows no density change and can sit
 * below the lab's 14px type floor. Ratchet: the count of raw sites is pinned at zero.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/components/layout-lab');
const FILES = [
  'DriftBanner.tsx', 'ProduceErrorBanner.tsx', 'ProduceLogPanel.tsx',
  'RefreshFromServer.tsx', 'RefreshCatalogFromServer.tsx', 'CatalogChangesDigest.tsx',
];
const RAW = /(?:fontSize|gap|borderRadius):\s*\d+|padding:\s*'[^']*\d+px/g;
const LOW_TEXT = /fontSize:\s*(?:\d|1[0-3])\b(?!\d)/g;

const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

describe('coach-adjacent surfaces use the lab tokens', () => {
  it.each(FILES)('%s has no raw px font size, gap, radius or padding', (f) => {
    expect(read(f).match(RAW) ?? []).toEqual([]);
  });

  it.each(FILES)('%s has no text below the lab type floor', (f) => {
    expect(read(f).match(LOW_TEXT) ?? []).toEqual([]);
  });

  it('actually reads the lab tokens (the scan is not vacuous)', () => {
    const uses = FILES.reduce((n, f) => n + (read(f).match(/var\(--lab-(?:fs|s|r)/g) ?? []).length, 0);
    expect(uses).toBeGreaterThan(20);
  });
});
