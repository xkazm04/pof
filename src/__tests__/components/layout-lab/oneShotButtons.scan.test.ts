/**
 * Source scan: every raw <button> under layout-lab/one-shot/ carries the shared `.focus-ring`
 * class (what `LabButton` sets) and an explicit type="button". A bare button falls back to
 * the browser default outline, which the lab's themes do not guarantee is visible.
 * Comment-stripped; opening tags are read with brace-depth so `=>` inside handlers is not a tag end.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/components/layout-lab/one-shot');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every `<button …>` opening tag, read to its closing `>` at brace depth 0. */
export function buttonTags(src: string): string[] {
  const code = stripComments(src);
  const tags: string[] = [];
  for (let at = code.indexOf('<button'); at >= 0; at = code.indexOf('<button', at + 1)) {
    let depth = 0;
    let end = at;
    for (; end < code.length; end++) {
      const c = code[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && code[end - 1] !== '=') break;
    }
    tags.push(code.slice(at, end + 1));
  }
  return tags;
}

describe('one-shot buttons', () => {
  it('the scanner reads a multi-line tag with an arrow handler as one tag', () => {
    const tags = buttonTags('<button\n onClick={() => go()}\n className="x">go</button>');
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('className="x"');
  });

  it('the folder holds buttons to scan', () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => buttonTags(readFileSync(join(DIR, f), 'utf8')));
    expect(all.length).toBeGreaterThanOrEqual(11);
  });

  it('every <button> carries focus-ring and type="button"', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.tsx')).sort()) {
      for (const tag of buttonTags(readFileSync(join(DIR, f), 'utf8'))) {
        if (!/focus-ring/.test(tag)) offenders.push(`${f}: no focus-ring`);
        if (!/type="button"/.test(tag)) offenders.push(`${f}: no type="button"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
