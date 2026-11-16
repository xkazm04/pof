import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '../../../components/modules/core-engine/sub_progression');
const INTERNALS = join(ROOT, '_internals');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '_internals' ? [] : sources(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Enumerates _internals on disk, so a superseded copy cannot sit there unnoticed. */
describe('sub_progression/_internals', () => {
  it('every entry is imported from outside _internals', () => {
    const live = sources(ROOT).map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');
    const orphans = readdirSync(INTERNALS)
      .map((entry) => entry.replace(/\.tsx?$/, ''))
      .filter((name) => !live.includes(`_internals/${name}'`));
    expect(orphans).toEqual([]);
  });
});
