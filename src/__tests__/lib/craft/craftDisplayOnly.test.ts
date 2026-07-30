/**
 * The A-axis is provably display-only — the structural guarantee the craft-loop spec
 * makes: nothing in the acceptance/grading path imports the craft modules, so a craft
 * gauge can never move an R-grade or an acceptance verdict.
 *
 * Source-level scan (same spirit as the spec linter): if a future change wires craft
 * into grading, this fails loudly and the change must be argued, not slipped in.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

/** The grading-owning surfaces per the architecture docs. */
const GRADING_DIRS = [
  'src/lib/catalog/acceptance',
  'src/lib/status/statusModel.ts',
  'src/lib/status/readiness.ts',
];

const CRAFT_IMPORT = /@\/lib\/craft\/|@\/lib\/status\/craft|craft-verdicts-db/;

function* sourceFiles(p: string): Generator<string> {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isFile()) {
    yield abs;
    return;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(p, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(child);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path.join(ROOT, child);
  }
}

describe('craft is display-only', () => {
  it('no grading module imports any craft module', () => {
    const offenders: string[] = [];
    for (const dir of GRADING_DIRS) {
      for (const file of sourceFiles(dir)) {
        const src = fs.readFileSync(file, 'utf8');
        if (CRAFT_IMPORT.test(src)) offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders, `grading modules importing craft: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the grading dirs this test guards actually exist (guard is not vacuous)', () => {
    for (const dir of GRADING_DIRS) {
      expect(fs.existsSync(path.join(ROOT, dir)), dir).toBe(true);
    }
  });
});
