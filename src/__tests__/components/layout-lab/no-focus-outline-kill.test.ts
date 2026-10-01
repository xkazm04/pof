/**
 * Guard (lab-ui-primitives/A): no layout-lab source may kill the keyboard focus indicator.
 *
 * The app's focus indicator is `:focus-visible { outline: … }` (src/app/globals.css) plus the
 * `.focus-ring*` utilities. An inline `outline: 'none'` (or the `outline-none` utility) beats
 * that rule, so a keyboard user tabbing through the lab loses track of where they are. Six
 * such sites in five files survived two bug-ui scans; the fix lives in the primitives
 * (`steps/controls.tsx` rides `ui/Field`, whose controls carry `focus-ring-inset`), and this
 * scan stops the outline kill from reappearing at a call site.
 *
 * A control that wants a custom indicator uses a `.focus-ring*` class — those rules replace
 * the outline only while `:focus-visible` and paint a ring instead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const LAB_ROOT = join(process.cwd(), 'src', 'components', 'layout-lab');
const OUTLINE_KILL = /outline\s*:\s*(?:['"]none['"]|0(?![.\d]))|\boutline-none\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('layout-lab keeps the keyboard focus indicator', () => {
  it('the pattern catches every outline-kill spelling (self-test)', () => {
    for (const s of ["outline: 'none'", 'outline:"none"', 'outline: 0,', 'className="outline-none"']) {
      expect(OUTLINE_KILL.test(s), s).toBe(true);
    }
    for (const s of ["outline: '2px solid red'", 'outlineOffset: 0', 'className="focus-ring-outline"']) {
      expect(OUTLINE_KILL.test(s), s).toBe(false);
    }
  });

  it('no layout-lab source sets outline none', () => {
    const files = walk(LAB_ROOT);
    expect(files.length).toBeGreaterThan(50);
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (OUTLINE_KILL.test(line)) hits.push(`${relative(LAB_ROOT, f).split(sep).join('/')}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
