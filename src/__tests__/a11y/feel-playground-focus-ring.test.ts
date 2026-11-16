import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every <button> in the movement / playground / AI-feel tabs shows a visible
 * keyboard focus indicator via the shared `.focus-ring` utility (reads
 * --focus-accent). Most buttons here already had it; the rest were invisible
 * to a keyboard user once focused. A className given as an identifier
 * (`className={iconBtn}`) counts when that identifier's definition in the same
 * file carries focus-ring. Comments are stripped before matching.
 */

const ROOT = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_character');
const DIRS = ['movement', 'playground', 'ai-feel'];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The opening tag text: from `<button` to the first line that closes it with `>`. */
function openingTag(src: string, at: number): string {
  let tag = '';
  for (const line of src.slice(at).split(/\r?\n/)) {
    tag += `${line}\n`;
    const t = line.trim();
    if (t.endsWith('>') && !t.endsWith('=>')) break;
  }
  return tag;
}

export function buttonsWithoutFocusRing(src: string, file: string): string[] {
  const code = stripComments(src);
  const misses: string[] = [];
  let i = code.indexOf('<button');
  while (i >= 0) {
    const tag = openingTag(code, i);
    const ident = /className=\{([A-Za-z_$][\w$]*)\}/.exec(tag)?.[1];
    const viaIdent = ident
      ? new RegExp(`const ${ident}\\s*=[^;]*focus-ring`).test(code)
      : false;
    if (!/focus-ring/.test(tag) && !viaIdent) {
      misses.push(`${file}:${code.slice(0, i).split('\n').length}`);
    }
    i = code.indexOf('<button', i + 1);
  }
  return misses;
}

describe('feel playground buttons show keyboard focus', () => {
  it('every button carries focus-ring', () => {
    const misses: string[] = [];
    for (const dir of DIRS) {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        if (!f.endsWith('.tsx')) continue;
        misses.push(...buttonsWithoutFocusRing(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'), `${dir}/${f}`));
      }
    }
    expect(misses).toEqual([]);
  });

  it('the matcher bites on a seeded violation and honours identifier classNames', () => {
    const seeded = [
      "const ok = 'p-1 focus-ring';",
      '<button className={ok}>a</button>',
      '<button',
      '  onClick={() => go()}',
      '  className="px-2"',
      '>b</button>',
    ].join('\n');
    expect(buttonsWithoutFocusRing(seeded, 'x.tsx')).toEqual(['x.tsx:3']);
  });
});
