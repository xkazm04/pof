/**
 * scan-sweep (cross-module-features): the Features dashboard draws from design
 * tokens, not hard-coded hex Tailwind classes. ESLint's no-hex rule reads string
 * literals but not arbitrary-value class names like `text-[#f87171]`, so these
 * slipped past the repo convention. Comments are stripped before matching so a
 * file that only DESCRIBES the rule cannot satisfy it. The file list is read from
 * the folder, not typed by hand, so a new file is covered on arrival.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/components/modules/evaluator/CrossModuleFeatureDashboard');
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ARBITRARY_HEX = /\[#[0-9a-fA-F]{3,8}\]/g;

describe('CrossModuleFeatureDashboard — no arbitrary hex classes', () => {
  it('reads every source file in the folder', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(FILES)('%s has zero `[#rrggbb]` Tailwind arbitrary colours', (file) => {
    const src = stripComments(readFileSync(path.join(DIR, file), 'utf-8'));
    expect(src.match(ARBITRARY_HEX) ?? []).toEqual([]);
  });

  it('the matcher bites on a seeded violation', () => {
    expect('className="text-[#f87171]"'.match(ARBITRARY_HEX)).toHaveLength(1);
  });
});
