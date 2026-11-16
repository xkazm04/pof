import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The repo's no-hex ESLint rule matches string literals, so a hex inside a
 * template literal (`#000000${OPACITY_80}`) slips past it. This guard covers
 * the movement / playground / AI-feel tabs: colours come from
 * `@/lib/chart-colors` tokens. Comments are stripped before matching.
 */

const ROOT = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_character');
const DIRS = ['movement', 'playground', 'ai-feel'];
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('feel playground colours come from tokens', () => {
  it('has no hex colour literals (template literals included)', () => {
    const hits: string[] = [];
    for (const dir of DIRS) {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        if (!/\.tsx?$/.test(f)) continue;
        const src = stripComments(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
        for (const m of src.match(HEX) ?? []) hits.push(`${dir}/${f}: ${m}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('the matcher bites on a seeded template-literal hex', () => {
    // Built by concatenation so this test file does not itself trip the lint rule.
    const black = `#${'0'.repeat(6)}`;
    expect(`fill={\`${black}\${OPACITY_80}\`}`.match(HEX)).toEqual([black]);
  });
});
