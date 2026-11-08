import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Muted text dimmed further (by a `/NN` colour modifier OR by an `opacity-NN`
 * class on the same element) drops below WCAG AA 1.4.3 on the dark surfaces —
 * proved in src/__tests__/lib/muted-text-contrast.test.ts. The repo-wide
 * legibility guard only sees the `/NN` form, so this context-scoped guard also
 * catches the `opacity-NN` form for the movement / playground / AI-feel tabs.
 * Comments are stripped before matching so prose about the rule cannot satisfy it.
 */

const ROOT = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_character');
const DIRS = ['movement', 'playground', 'ai-feel'];

const DIMMED_SUFFIX = /text-text-(?:muted|subtle)\/(?:20|30|40|50|60|70)\b/g;
/** One className string holding both a muted text token and a sub-100 opacity class. */
const CLASS_STRING = /className=(?:"[^"]*"|\{`[^`]*`\})/g;
const MUTED = /\btext-text-(?:muted|subtle)\b/;
const OPACITY = /(?:^|[\s"`])opacity-(?:[1-9]0|[1-9])\b/;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function hits(): string[] {
  const out: string[] = [];
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = stripComments(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
      for (const m of src.match(DIMMED_SUFFIX) ?? []) out.push(`${dir}/${f}: ${m}`);
      for (const cls of src.match(CLASS_STRING) ?? []) {
        if (MUTED.test(cls) && OPACITY.test(cls)) out.push(`${dir}/${f}: ${cls}`);
      }
    }
  }
  return out;
}

describe('feel playground muted-text contrast', () => {
  it('has no muted text dimmed below AA', () => {
    expect(hits()).toEqual([]);
  });

  it('the matcher bites on a seeded violation', () => {
    const seeded = '<p className="text-xs text-text-muted opacity-60">x</p> <input className="placeholder:text-text-muted/50" />';
    const classes = seeded.match(CLASS_STRING) ?? [];
    expect(classes.some((c) => MUTED.test(c) && OPACITY.test(c))).toBe(true);
    expect((seeded.match(DIMMED_SUFFIX) ?? []).length).toBe(1);
  });
});
