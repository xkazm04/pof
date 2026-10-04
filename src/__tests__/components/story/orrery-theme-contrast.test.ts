import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  contrastRatio,
  meetsContrastAA,
  WCAG_AA_TEXT,
  WCAG_AA_NON_TEXT,
} from '@/lib/contrast';

/**
 * The two Orrery themes, held to WCAG AA and to the 12px legibility floor.
 *
 * `src/lib/contrast.ts` existed in this repo but was imported by tests only — a
 * util that proves nothing about any surface. This file wires it to the surface
 * the contest winner was ported into, and it does it by PARSING the two theme
 * stylesheets rather than restating their colours, so the assertion cannot
 * drift from the CSS it is about:
 *
 *   - `src/app/globals.css` `:root`               -> the product's token values
 *   - `themes/orrery.css`  `[data-orrery-theme="orrery"]`     -> theme 1 tokens
 *   - `themes/blueprint.css` `[data-orrery-theme="blueprint"]` -> theme 2 tokens
 *
 * Blueprint expresses every colour as `var(--...)` / `color-mix()` over the
 * product's own tokens, so the resolver below follows both. `color-mix(in srgb,
 * A p%, transparent)` is how an alpha surface is written without a literal, so
 * resolved colours carry alpha and are flattened onto the surface they float
 * over before being measured — the blend is what the eye sees.
 *
 * ── One recorded deviation, not hidden ──────────────────────────────────────
 * `--or-dim` on `--or-panel` in theme 1 measures 4.45:1, just under AA's 4.5.
 * It is the winner's own `--dim: #6a7d9c` on its own `--panel: #0a1322`, and the
 * `mono` role's `color` is PINNED by the captured style contract — the owner
 * accepted a font-size lift on that role and nothing else, so brightening it
 * would be an unapproved departure from the design the owner chose. The
 * shortfall is therefore recorded here with its measured ratio, asserted to
 * still clear the 3:1 non-text grade, and asserted to be the ONLY such pair:
 * a new failure cannot hide behind it, and if the pair is ever fixed this test
 * fails as stale. Blueprint has no exceptions.
 */

const THEMES_DIR = path.join(process.cwd(), 'src', 'components', 'story', 'orrery', 'themes');
const ORRERY_CSS = path.join(THEMES_DIR, 'orrery.css');
const BLUEPRINT_CSS = path.join(THEMES_DIR, 'blueprint.css');
const GLOBALS_CSS = path.join(process.cwd(), 'src', 'app', 'globals.css');

/* ------------------------------------------------------------------ parsing */

type Rgba = { r: number; g: number; b: number; a: number };

/** Pull `--name: value;` declarations out of the first block matching `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', at);
  // Blocks here are flat (no nesting), so the first `}` closes them.
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Every `--name: value;` in a file, regardless of block — used for the token census. */
function allDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!out.has(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}

function parseHex(hex: string): Rgba {
  let h = hex.replace('#', '').trim();
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}

const NAMED: Record<string, Rgba> = {
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/** Split a `color-mix()` argument list on top-level commas. */
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim());
}

/**
 * Resolve a CSS colour expression to rgba, following `var()` through a token
 * table and evaluating `color-mix(in srgb, …)` the way the spec does for sRGB:
 * premultiplied by alpha, which is what makes `color-mix(C p%, transparent)`
 * equal to "C at p% alpha".
 */
function resolve(expr: string, tokens: Map<string, string>, seen = new Set<string>()): Rgba {
  const v = expr.trim();

  if (v.startsWith('#')) return parseHex(v);
  if (NAMED[v]) return NAMED[v];

  const rgbFn = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/);
  if (rgbFn) {
    return { r: +rgbFn[1], g: +rgbFn[2], b: +rgbFn[3], a: +rgbFn[4] };
  }

  const varFn = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (varFn) {
    const name = varFn[1];
    if (seen.has(name)) throw new Error(`cyclic token: ${name}`);
    const next = tokens.get(name);
    if (next === undefined) throw new Error(`unresolved token: ${name}`);
    return resolve(next, tokens, new Set(seen).add(name));
  }

  if (v.startsWith('color-mix(')) {
    const inner = v.slice('color-mix('.length, v.lastIndexOf(')'));
    const parts = splitTop(inner);
    const space = parts.shift();
    if (space !== 'in srgb') throw new Error(`only "in srgb" is supported: ${space}`);
    const read = (part: string): { c: Rgba; p: number | null } => {
      const m = part.match(/^(.*?)\s+([\d.]+)%$/);
      if (m) return { c: resolve(m[1], tokens, seen), p: +m[2] / 100 };
      return { c: resolve(part, tokens, seen), p: null };
    };
    const [a, b] = parts.map(read);
    let pa = a.p;
    let pb = b.p;
    if (pa === null && pb === null) { pa = 0.5; pb = 0.5; }
    else if (pa === null) pa = 1 - (pb as number);
    else if (pb === null) pb = 1 - pa;
    const sum = pa + (pb as number);
    pa /= sum;
    pb = (pb as number) / sum;
    // Premultiplied sRGB interpolation.
    const alpha = a.c.a * pa + b.c.a * pb;
    const chan = (k: 'r' | 'g' | 'b') =>
      alpha === 0 ? 0 : (a.c[k] * a.c.a * pa + b.c[k] * b.c.a * pb) / alpha;
    return { r: chan('r'), g: chan('g'), b: chan('b'), a: alpha };
  }

  throw new Error(`unsupported colour expression: ${v}`);
}

function toHex(c: Rgba): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** Flatten a (possibly translucent) colour onto an opaque floor. */
function flatten(c: Rgba, floor: Rgba): string {
  if (c.a >= 1) return toHex(c);
  const m = (k: 'r' | 'g' | 'b') => c[k] * c.a + floor[k] * (1 - c.a);
  return toHex({ r: m('r'), g: m('g'), b: m('b'), a: 1 });
}

/* ------------------------------------------------------------ theme loading */

const globals = declarations(fs.readFileSync(GLOBALS_CSS, 'utf-8'), ':root');

function loadTheme(file: string, selector: string): Map<string, string> {
  const css = fs.readFileSync(file, 'utf-8');
  const own = declarations(css, selector);
  // The theme block resolves against itself first, then the product's :root.
  return new Map<string, string>([...globals, ...own]);
}

const THEME_TOKENS = {
  orrery: loadTheme(ORRERY_CSS, "[data-orrery-theme='orrery']"),
  blueprint: loadTheme(BLUEPRINT_CSS, "[data-orrery-theme='blueprint']"),
} as const;

type ThemeName = keyof typeof THEME_TOKENS;
const THEMES = Object.keys(THEME_TOKENS) as ThemeName[];

/**
 * A pair to measure: the ink token, the surface token it sits on, and — when the
 * surface is translucent — the opaque floor that surface floats over.
 */
type Pair = readonly [ink: string, surface: string, floor?: string];

/** Where the stylesheet actually puts ink on a surface. One row per real pairing. */
const TEXT_PAIRS: Pair[] = [
  // body ink
  ['--or-ink', '--or-panel'],
  ['--or-ink', '--or-bg'],
  ['--or-ink', '--or-bg2'],
  ['--or-ink', '--or-field-bg'],
  ['--or-ink', '--or-tag-bg'],
  ['--or-ink', '--or-audit-bg'],
  ['--or-ink', '--or-card-bg'],
  ['--or-ink', '--or-kbd-bg'],
  ['--or-ink', '--or-detail-bg'],
  ['--or-ink', '--or-row-hover'],
  ['--or-ink', '--or-row-hover-hi'],
  ['--or-ink', '--or-script-hover'],
  ['--or-ink', '--or-script-current'],
  ['--or-ink', '--or-popover-bg'],
  ['--or-ink', '--or-float-bg', '--or-stage-core'],
  ['--or-ink', '--or-float-bg-solid', '--or-stage-core'],
  ['--or-ink', '--or-topbar-core'],
  // emphasised ink
  ['--or-ink-hi', '--or-pressed-bg'],
  ['--or-ink-hi', '--or-tab-active-bg'],
  ['--or-ink-hi', '--or-go-bg'],
  ['--or-ink-hi', '--or-float-bg', '--or-stage-core'],
  ['--or-ink-hi', '--or-tip-bg', '--or-stage-core'],
  // secondary ink
  ['--or-mut', '--or-panel'],
  ['--or-mut', '--or-bg'],
  ['--or-mut', '--or-legend-bg', '--or-stage-core'],
  ['--or-mut', '--or-float-bg', '--or-stage-core'],
  ['--or-mut', '--or-tip-bg', '--or-stage-core'],
  ['--or-mut', '--or-veil', '--or-stage-core'],
  // de-emphasised ink. `--or-dim` is the winner's own value and is used by ONE
  // role (`mono`), whose colour the style contract pins; `--or-dim-text` is the
  // AA-clearing token every other de-emphasised use reads.
  ['--or-dim', '--or-panel'],
  ['--or-dim-text', '--or-panel'],
  ['--or-dim-text', '--or-bg'],
  ['--or-dim-text', '--or-audit-bg'],
  ['--or-dim-text', '--or-popover-bg'],
  ['--or-dim-text', '--or-legend-bg', '--or-stage-core'],
  ['--or-dim-text', '--or-topbar-core'],
  // accents used AS TEXT
  ['--or-brass', '--or-panel'],
  ['--or-brass', '--or-topbar-core'],
  ['--or-brass', '--or-legend-bg', '--or-stage-core'],
  ['--or-amber', '--or-panel'],
  ['--or-amber', '--or-tag-bg'],
  ['--or-rose', '--or-tag-bg'],
  ['--or-violet', '--or-tag-bg'],
  ['--or-teal', '--or-panel'],
  ['--or-violet', '--or-panel'],
  ['--or-infl', '--or-panel'],
  ['--or-ok', '--or-panel'],
  // reading prose
  ['--or-reading-ink', '--or-reading-bg'],
  ['--or-reading-filler-ink', '--or-reading-bg'],
  // state chips and counts
  ['--or-chipw-ink', '--or-chipw-bg'],
  ['--or-chipw-pos', '--or-chipw-bg'],
  ['--or-chipw-neg', '--or-chipw-bg'],
  ['--or-count-bad-ink', '--or-count-bad-bg'],
  ['--or-count-warn-ink', '--or-count-warn-bg'],
  ['--or-count-ok-ink', '--or-count-ok-bg'],
  ['--or-tab-count-ink', '--or-tab-count-bg'],
  ['--or-chip-warn-ink', '--or-float-bg', '--or-stage-core'],
  ['--or-chip-bad-ink', '--or-float-bg', '--or-stage-core'],
  ['--or-chip-ok-ink', '--or-float-bg', '--or-stage-core'],
];

/**
 * Non-text, meaning-bearing: the legend swatches, the edge inks drawn on the
 * stage, the reach-bar fill, the active-tab underline. WCAG 1.4.11, 3:1.
 */
const MEANING_PAIRS: Pair[] = [
  ['--or-brass', '--or-stage-core'],
  ['--or-amber', '--or-stage-core'],
  ['--or-teal', '--or-stage-core'],
  ['--or-violet', '--or-stage-core'],
  ['--or-rose', '--or-stage-core'],
  ['--or-infl', '--or-stage-core'],
  ['--or-ok', '--or-stage-core'],
  ['--or-teal', '--or-bar-track'],
  ['--or-brass', '--or-topbar-core'],
  ['--or-amber', '--or-script-current'],
];

/**
 * Structural hairlines. These are NOT an AA claim: the winner's 1px rules
 * measure 1.4–1.8:1 against their own surfaces, well under 1.4.11's 3:1. They
 * are separators and control rims in a deliberately low-contrast instrument
 * panel, and raising them would move `borderLeftColor` on eight contract roles —
 * an unapproved departure from the design the owner chose. Recorded with the
 * measured baseline so the HOUSE theme can be held to "no worse than the
 * winner", and so a regression is visible.
 */
const HAIRLINE_PAIRS: Pair[] = [
  ['--or-line', '--or-bg'],
  ['--or-line', '--or-panel'],
  ['--or-line2', '--or-panel'],
  ['--or-line2', '--or-field-bg'],
  ['--or-line2', '--or-stage-core'],
  ['--or-line-hot', '--or-field-bg'],
];

/** Winner-inherited AA shortfalls, with the ratio measured when recorded. */
const RECORDED_TEXT_EXCEPTIONS: Record<ThemeName, { pair: Pair; ratio: number; why: string }[]> = {
  orrery: [
    {
      pair: ['--or-dim', '--or-panel'],
      ratio: 4.45,
      why:
        "the winner's own --dim on its own --panel; the `mono` role's colour is pinned by the " +
        'captured contract and the owner accepted only a font-size lift on it',
    },
  ],
  blueprint: [],
};

function ratioFor(theme: ThemeName, [ink, surface, floor]: Pair): number {
  const tokens = THEME_TOKENS[theme];
  const floorRgba = resolve(`var(${floor ?? '--or-bg'})`, tokens);
  const bgHex = flatten(resolve(`var(${surface})`, tokens), floorRgba);
  const bgRgba = parseHex(bgHex);
  const fgHex = flatten(resolve(`var(${ink})`, tokens), bgRgba);
  return contrastRatio(fgHex, bgHex);
}

const key = (p: Pair) => `${p[0]} on ${p[1]}${p[2] ? ` over ${p[2]}` : ''}`;

/* ------------------------------------------------------------------- suites */

describe('Orrery themes — the resolver itself', () => {
  it('reads the product tokens the blueprint theme is built from', () => {
    // Asserted as resolved channels, not as hex literals: the repo bans hex in
    // .ts, and the channel values are the thing the ratios actually depend on.
    for (const token of ['--core', '--surface-deep', '--text-subtle']) {
      expect(globals.get(token), token).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(resolve('var(--core)', globals)).toMatchObject({ r: 59, g: 130, b: 246, a: 1 });
    expect(resolve('var(--surface-deep)', globals)).toMatchObject({ r: 20, g: 20, b: 44 });
    expect(resolve('var(--text-subtle)', globals)).toMatchObject({ r: 126, g: 132, b: 168 });
  });

  it('resolves var(), color-mix() and alpha the way a browser would', () => {
    const t = new Map([['--a', 'black'], ['--b', 'white']]);
    const mid = resolve('color-mix(in srgb, var(--a) 50%, var(--b))', t);
    expect([mid.r, mid.g, mid.b]).toEqual([127.5, 127.5, 127.5]);
    const half = resolve('color-mix(in srgb, var(--b) 50%, transparent)', t);
    expect(half.a).toBeCloseTo(0.5, 3);
    expect(flatten(half, NAMED.black)).toBe(toHex({ r: 127.5, g: 127.5, b: 127.5, a: 1 }));
    // 8-digit hex alpha, read off the winner's own floating-chip surface.
    expect(resolve('var(--or-float-bg)', THEME_TOKENS.orrery).a).toBeCloseTo(0.8, 2);
  });

  it('resolves every token both themes name, in both themes', () => {
    const named = new Set<string>([
      ...TEXT_PAIRS.flatMap((p) => [p[0], p[1], p[2]]),
      ...MEANING_PAIRS.flatMap((p) => [p[0], p[1], p[2]]),
      ...HAIRLINE_PAIRS.flatMap((p) => [p[0], p[1], p[2]]),
    ].filter((n): n is string => !!n));
    for (const theme of THEMES) {
      for (const token of named) {
        expect(() => resolve(`var(${token})`, THEME_TOKENS[theme]), `${theme} ${token}`).not.toThrow();
      }
    }
  });
});

describe.each(THEMES)('Orrery theme "%s" — WCAG AA', (theme) => {
  const exceptions = RECORDED_TEXT_EXCEPTIONS[theme];
  const excepted = new Set(exceptions.map((e) => key(e.pair)));

  it(`every ink-on-surface pair clears ${WCAG_AA_TEXT}:1 (1.4.3)`, () => {
    const failures = TEXT_PAIRS.filter((p) => !excepted.has(key(p)) && ratioFor(theme, p) < WCAG_AA_TEXT)
      .map((p) => `${key(p)} = ${ratioFor(theme, p).toFixed(2)}:1`);
    expect(failures).toEqual([]);
  });

  it('the recorded exception list is exact — no extra failures, no stale entries', () => {
    const failing = new Set(
      TEXT_PAIRS.filter((p) => ratioFor(theme, p) < WCAG_AA_TEXT).map(key),
    );
    // Nothing fails that is not recorded …
    expect([...failing].filter((k) => !excepted.has(k))).toEqual([]);
    // … and nothing recorded has quietly been fixed (if it has, delete the entry).
    expect([...excepted].filter((k) => !failing.has(k))).toEqual([]);
  });

  it('each recorded exception still clears the 3:1 non-text grade, at the ratio recorded', () => {
    for (const e of exceptions) {
      const r = ratioFor(theme, e.pair);
      expect(r, `${key(e.pair)} (${e.why})`).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      expect(r, `${key(e.pair)} drifted from its recorded ratio`).toBeCloseTo(e.ratio, 1);
    }
  });

  it(`every meaning-bearing non-text token clears ${WCAG_AA_NON_TEXT}:1 (1.4.11)`, () => {
    const failures = MEANING_PAIRS.filter((p) => ratioFor(theme, p) < WCAG_AA_NON_TEXT)
      .map((p) => `${key(p)} = ${ratioFor(theme, p).toFixed(2)}:1`);
    expect(failures).toEqual([]);
  });

  it('uses meetsContrastAA, the shared util, for the same verdict', () => {
    const tokens = THEME_TOKENS[theme];
    const panel = flatten(resolve('var(--or-panel)', tokens), NAMED.black);
    const ink = flatten(resolve('var(--or-ink)', tokens), parseHex(panel));
    expect(meetsContrastAA(ink, panel, 'text')).toBe(true);
  });
});

describe('Orrery themes — the house theme does not make contrast worse', () => {
  it('blueprint is at least as legible as orrery on every hairline', () => {
    const worse: string[] = [];
    for (const p of HAIRLINE_PAIRS) {
      const a = ratioFor('orrery', p);
      const b = ratioFor('blueprint', p);
      // 0.15 of slack: a re-theme is allowed to land near, not below.
      if (b < a - 0.15) worse.push(`${key(p)}: orrery ${a.toFixed(2)} -> blueprint ${b.toFixed(2)}`);
    }
    expect(worse).toEqual([]);
  });

  it("records the winner's hairlines as sitting below 1.4.11 — a deviation, not a claim", () => {
    // Stated about theme 1 only, where the values ARE the winner's and the
    // contract pins the eight roles that would have to move to raise them.
    // Blueprint is free to do better (and does on one rim), so it is only held
    // to "no worse", above.
    const measured = HAIRLINE_PAIRS.map((p) => [key(p), ratioFor('orrery', p)] as const);
    for (const [k, r] of measured) {
      expect(r, `orrery ${k}`).toBeGreaterThan(1);
      expect(r, `orrery ${k} now clears 3:1 — the deviation is fixed, update this guard`)
        .toBeLessThan(WCAG_AA_NON_TEXT);
    }
    // The whole set, so the report can quote it rather than re-measure it.
    expect(measured.length).toBe(HAIRLINE_PAIRS.length);
  });
});

/* ------------------------------------------------- the owner's 12px floor */

describe('Orrery themes — the type floor the owner asked for', () => {
  const FILES = { orrery: ORRERY_CSS, blueprint: BLUEPRINT_CSS };

  it.each(Object.entries(FILES))('%s declares nothing below 12px', (_name, file) => {
    const css = fs.readFileSync(file, 'utf-8');
    const tooSmall: string[] = [];
    for (const m of css.matchAll(/font-size\s*:\s*([^;]+);/g)) {
      const v = m[1].trim();
      const px = v.match(/^([\d.]+)px$/);
      if (px && parseFloat(px[1]) < 12) tooSmall.push(v);
      const tok = v.match(/^var\(\s*(--or-fs-[\w-]+)\s*\)$/);
      if (tok) {
        const decl = allDeclarations(fs.readFileSync(ORRERY_CSS, 'utf-8')).get(tok[1]);
        const n = decl?.match(/^([\d.]+)px$/);
        if (!n) tooSmall.push(`${tok[1]} (unresolved)`);
        else if (parseFloat(n[1]) < 12) tooSmall.push(`${tok[1]} = ${decl}`);
      }
    }
    expect(tooSmall).toEqual([]);
  });

  it('every size token in the scale is at or above the 12px floor', () => {
    const decls = allDeclarations(fs.readFileSync(ORRERY_CSS, 'utf-8'));
    const sizes = [...decls].filter(([k]) => k.startsWith('--or-fs-'));
    expect(sizes.length).toBeGreaterThan(5);
    for (const [k, v] of sizes) {
      const n = v.match(/^([\d.]+)px$/);
      expect(n, `${k} is not a px literal: ${v}`).toBeTruthy();
      expect(parseFloat(n![1]), k).toBeGreaterThanOrEqual(12);
    }
    expect(decls.get('--or-fs-min')).toBe('12px');
  });

  it('keeps the two sizes the owner did not ask to change', () => {
    const decls = allDeclarations(fs.readFileSync(ORRERY_CSS, 'utf-8'));
    expect(decls.get('--or-fs-title')).toBe('19px'); // panel title
    expect(decls.get('--or-fs-read')).toBe('15px'); // reading prose
  });
});

/* --------------------------------------------- the overlay stays an overlay */

describe('Orrery themes — the blueprint overlay is complete and structural-free', () => {
  const orreryTokens = declarations(
    fs.readFileSync(ORRERY_CSS, 'utf-8'),
    "[data-orrery-theme='orrery']",
  );
  const blueprintTokens = declarations(
    fs.readFileSync(BLUEPRINT_CSS, 'utf-8'),
    "[data-orrery-theme='blueprint']",
  );

  it('blueprint redefines every colour token orrery declares', () => {
    const missing = [...orreryTokens.keys()].filter((k) => !blueprintTokens.has(k));
    expect(missing).toEqual([]);
  });

  it('blueprint invents no token orrery does not have, except private intermediates', () => {
    const extra = [...blueprintTokens.keys()].filter(
      (k) => !orreryTokens.has(k) && !k.startsWith('--or-_'),
    );
    expect(extra).toEqual([]);
  });

  it('blueprint declares no structural value — geometry and type live in the shared layer', () => {
    const structural = [...blueprintTokens.keys()].filter((k) =>
      /^--or-(fs|lh|r)-/.test(k) || k === '--or-sans' || k === '--or-mono' ||
      k === '--or-topbar-h' || k === '--or-panel-w' || k === '--or-lh',
    );
    expect(structural).toEqual([]);
  });

  it('blueprint contains no colour literal — the house theme repaints with the product', () => {
    const css = fs.readFileSync(BLUEPRINT_CSS, 'utf-8');
    const body = css.slice(css.indexOf('*/') + 2); // skip the file header comment
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('the shared structural layer keeps the winner-measured font stacks', () => {
    const shared = declarations(fs.readFileSync(ORRERY_CSS, 'utf-8'), '[data-orrery-theme] {');
    expect(shared.get('--or-sans')).toContain('ui-sans-serif');
    expect(shared.get('--or-mono')).toContain('ui-monospace');
  });
});
