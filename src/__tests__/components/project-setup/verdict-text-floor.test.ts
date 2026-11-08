/**
 * Verdict-bearing text (a status colour, role=status, aria-live) in the Bridge
 * Endpoints and Test Harness panels never uses the 10px `text-2xs` meta size;
 * labels and captions may.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src/components/modules/project-setup');
const DIRS = ['BridgeEndpointHealth', 'TestHarnessPanel'];
const VERDICT = /STATUS_|outcomeColor|role="status"|aria-live/;

/** The JSX opening tag around index `at` (back to `<`, forward to the `>` outside `{}`). */
function openingTag(src: string, at: number): string {
  const start = src.lastIndexOf('<', at);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth <= 0 && src[i - 1] !== '=') return src.slice(start, i + 1);
  }
  return src.slice(start);
}

export function verdictsAtMeta(): string[] {
  const hits: string[] = [];
  for (const dir of DIRS) {
    for (const file of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.tsx'))) {
      const src = fs.readFileSync(path.join(ROOT, dir, file), 'utf-8');
      let at = src.indexOf('text-2xs');
      while (at !== -1) {
        const line = src.slice(0, at).split('\n').length;
        if (VERDICT.test(openingTag(src, at))) hits.push(`${dir}/${file}:${line}`);
        at = src.indexOf('text-2xs', at + 1);
      }
    }
  }
  return hits;
}

describe('verdict text legibility floor', () => {
  it('no verdict-bearing element uses text-2xs', () => {
    expect(verdictsAtMeta()).toEqual([]);
  });
});
