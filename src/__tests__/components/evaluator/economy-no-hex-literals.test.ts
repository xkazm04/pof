import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The repo bans hardcoded hex colours (CLAUDE.md, "No Hardcoded Hex Colors"), but
// the ESLint rule does not see a hex string used as a `??` fallback. Scan the
// economy-simulator sources directly — comments stripped first, so a file that only
// TALKS about a colour cannot pass for one that uses a token.
const ROOT = join(process.cwd(), 'src/components/modules/evaluator');
// Derived from the folder, not hand-listed, so a new section file is covered too.
const FILES = [
  'EconomyCodeGenPanel.tsx',
  'EconomyRunsStrip.tsx',
  ...readdirSync(join(ROOT, 'EconomySimulatorView'))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `EconomySimulatorView/${f}`),
];
const HEX = /['"`]#[0-9a-fA-F]{3,8}['"`]/g;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('economy-simulator sources use colour tokens, not hex literals', () => {
  it('covers the whole folder', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(13);
  });

  it.each(FILES)('%s has no quoted hex colour', (file) => {
    const code = stripComments(readFileSync(join(ROOT, file), 'utf-8'));
    expect(code.match(HEX) ?? []).toEqual([]);
  });

  it('the matcher bites on a seeded violation', () => {
    expect(stripComments("const c = x ?? '#888'; // '#fff'").match(HEX)).toEqual(["'#888'"]);
  });
});
