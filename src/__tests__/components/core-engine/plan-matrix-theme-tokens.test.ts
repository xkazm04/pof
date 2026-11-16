/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, visual-craft): the
 * plan map chrome hard-coded text-gray-* / text-white / bg-blue-600 /
 * text-blue-200 (29 occurrences in 5 files) instead of the semantic tokens
 * (text-text, text-text-muted, --accent-blue-bold), so it ignored the theme.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/components/modules/core-engine/PlanMatrixMap');
const PALETTE = /text-gray-|text-white|bg-blue-600|text-blue-200/g;

describe('PlanMatrixMap uses theme tokens, not palette literals', () => {
  it('has 0 raw palette classes across its files', () => {
    const hits: Record<string, number> = {};
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n))) {
      const n = (readFileSync(join(DIR, f), 'utf-8').match(PALETTE) ?? []).length;
      if (n) hits[f] = n;
    }
    expect(hits).toEqual({});
  });
});
