/**
 * lab-ui-primitives — legibility floor for the primitives' caption text.
 *
 * Stat's label and Field's label are 14px (`--lab-fs-xs`) caption text, so WCAG 1.4.3 AA
 * (4.5:1) applies. The colour each renders is resolved from `lab-tokens.css` for BOTH lab
 * themes and measured against the page floor (`--lab-bg`) and the panel composited over it
 * (`--lab-panel` is translucent) — the two surfaces these captions actually sit on.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, cleanup } from '@testing-library/react';
import { Stat } from '@/components/layout-lab/ui/Stat';
import { Field } from '@/components/layout-lab/ui/Field';
import { blendOver, contrastRatio, WCAG_AA_TEXT } from '@/lib/contrast';

afterEach(cleanup);

const CSS = readFileSync(join(process.cwd(), 'src/components/layout-lab/lab-tokens.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

function themeBlock(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`theme ${selector} not found`);
  const body = CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const THEMES = { blueprint: themeBlock('[data-theme="blueprint"]'), studio: themeBlock('[data-theme="studio"]') };

/** `rgba(r, g, b, a)` composited over an opaque hex; a hex is returned as-is. */
function opaque(value: string, under: string): string {
  const m = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (!m) return value;
  const hex = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
  return blendOver(hex, Number(m[4]), under);
}

function tokenOf(el: HTMLElement): string {
  const m = el.style.color.match(/var\((--[\w-]+)\)/);
  if (!m) throw new Error(`expected a var() colour, got "${el.style.color}"`);
  return m[1];
}

function worstContrast(token: string): { theme: string; ratio: number } {
  let worst = { theme: '', ratio: Infinity };
  for (const [theme, t] of Object.entries(THEMES)) {
    const fg = t[token];
    if (!fg) throw new Error(`${token} is not defined in the ${theme} theme`);
    const bg = t['--lab-bg'];
    for (const surface of [bg, opaque(t['--lab-panel'], bg)]) {
      const r = contrastRatio(fg, surface);
      if (r < worst.ratio) worst = { theme, ratio: r };
    }
  }
  return worst;
}

describe('lab primitive captions meet the AA text floor in both themes', () => {
  it('Stat label', () => {
    render(<Stat label="lifecycle" value="verified" />);
    const w = worstContrast(tokenOf(screen.getByText('lifecycle')));
    expect(w.ratio, `${w.theme} ${w.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
  it('Field label', () => {
    render(<Field label="Title" htmlFor="x"><input id="x" /></Field>);
    const w = worstContrast(tokenOf(screen.getByText('Title')));
    expect(w.ratio, `${w.theme} ${w.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
  it('--lab-muted (the shared muted text token) clears the floor in both themes on both surfaces', () => {
    const w = worstContrast('--lab-muted');
    expect(w.ratio, `${w.theme} ${w.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
  it('[seeded control] the instrument bites: the old Blueprint grey #647488 measures under the floor', () => {
    expect(contrastRatio('#647488', THEMES.blueprint['--lab-bg'])).toBeLessThan(WCAG_AA_TEXT); // eslint-disable-line no-restricted-syntax -- the retired sub-floor grey, a literal on purpose
  });
});
