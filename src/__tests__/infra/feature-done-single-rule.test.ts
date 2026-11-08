/**
 * `isFeatureDone` (src/lib/feature-done.ts) is THE feature-done rule. A site that
 * re-spells `status === 'implemented' || status === 'improved'` drifts the day the
 * rule changes (built features once stuck as blockers because a reader counted only
 * `implemented`). Comment-stripped scan of the app source; only feature-done.ts may
 * hold the pair.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '../..');
const ALLOWED = 'lib/feature-done.ts';
const PAIR = /([\w.?]+)\s*===\s*['"](implemented|improved)['"]\s*\|\|\s*\1\s*===\s*['"](implemented|improved)['"]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export function inlineDoneRestatements(): string[] {
  const hits: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, '/');
    if (rel === ALLOWED) continue;
    const text = stripComments(readFileSync(file, 'utf-8'));
    for (const m of text.matchAll(PAIR)) {
      if (m[2] !== m[3]) hits.push(`${rel}: ${m[0]}`);
    }
  }
  return hits;
}

describe('one feature-done rule', () => {
  it('no inline implemented||improved restatement outside lib/feature-done.ts', () => {
    expect(inlineDoneRestatements()).toEqual([]);
  });
});
