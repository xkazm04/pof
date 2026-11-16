/**
 * PathBrowser draws from design tokens, not hard-coded hex Tailwind classes.
 *
 * ESLint's no-hex rule reads string literals as colours but not arbitrary-value
 * class names like `bg-[#0d0d24]`, so these slipped past the repo's
 * "no hardcoded hex colors" convention. Comments are stripped before matching
 * so a file that only DESCRIBES the rule cannot satisfy it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'src/components/modules/project-setup/PathBrowser/index.tsx');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ARBITRARY_HEX = /\[#[0-9a-fA-F]{3,8}\]/g;

describe('PathBrowser — no arbitrary hex classes', () => {
  it('has zero `[#rrggbb]` Tailwind arbitrary colours', () => {
    const src = stripComments(readFileSync(FILE, 'utf-8'));
    expect(src.match(ARBITRARY_HEX) ?? []).toEqual([]);
  });

  it('the matcher bites on a seeded violation', () => {
    expect('className="bg-[#0d0d24]"'.match(ARBITRARY_HEX)).toHaveLength(1);
  });
});
