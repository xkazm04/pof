import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A raw NUL byte in a source file makes git classify it as BINARY: `git diff` / `git show` print
// "Bin 7977 -> 8150 bytes" and the change is unreviewable. A key separator must be written as the
// escape `\u0000` (as regrade.ts does), never as the byte itself.
const ROOTS = ['src'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('src carries no raw NUL byte', () => {
  it('every file is text to git', () => {
    const offenders = ROOTS.flatMap(files).filter((f) => readFileSync(f).includes(0));
    expect(offenders).toEqual([]);
  });
});
