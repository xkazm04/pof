#!/usr/bin/env node
/**
 * token-parity — the status colour vocabulary spans two runtimes and TWO ROLES. Keep the
 * roles kin, and keep each one fit for its own job.
 *
 * ## What this looked like, and what it actually is
 *
 * A 2026-08-31 conformance pass read `src/lib/chart-colors.ts` and `src/app/globals.css`
 * defining `success` / `warning` / `info` at different values and recorded a
 * `cross-language-token-parity` deviation: one vocabulary, two hand-maintained copies.
 *
 * Unifying them on the CSS values broke three assertions in
 * `src/__tests__/lib/contrast.test.ts` — the chart fills stopped meeting WCAG 1.4.11
 * non-text contrast (>= 3:1) against the surfaces they render on, at the reduced alphas the
 * charts actually use (amber/50, blue/70). The two palettes are not drift. They are:
 *
 *   MARK   `chart-colors.ts`  Tailwind-400  a fill a reader must SEE on a dark surface,
 *                                           often at 50-70% alpha -> contrast-constrained.
 *   HALO   `globals.css`      Tailwind-500  a box-shadow glow at 0.4 alpha, decorative,
 *                                           sitting BEHIND content -> not contrast-bearing.
 *
 * On a dark theme a mark must be lighter than a halo of the same hue. Forcing them equal
 * makes one of the two roles wrong, and the repo already had a test proving which.
 *
 * ## So what is the real invariant?
 *
 * Not value equality — **hue kinship plus role fitness**:
 *
 *   1. the two roles are the same HUE family (so the design reads as one vocabulary), and
 *   2. the mark is at least as light as the halo (so the contrast-constrained one has the
 *      headroom its job needs).
 *
 * Value equality is enforced by nothing here on purpose. WCAG fitness is enforced by
 * `contrast.test.ts`, which owns that question and tests it against the real surfaces.
 *
 * Per `gate-sees-target` this parses the ARTIFACTS BOTH RUNTIMES CONSUME — the real `.ts`
 * and the real `.css` — and it FAILS LOUDLY on parsing zero tokens (exit 2) rather than
 * reporting kinship it never checked. A checker that reads nothing and says "in parity" is
 * the empty-success lie.
 *
 * Usage:
 *   node scripts/token-parity.mjs            # exit 1 if a role drifts out of its family
 *   node scripts/token-parity.mjs --report   # advisory; always exit 0
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TS = path.join(ROOT, 'src/lib/chart-colors.ts');
const CSS = path.join(ROOT, 'src/app/globals.css');
const reportOnly = process.argv.includes('--report');

/** Roles that exist in both runtimes. Add a row when a role gains a second home. */
const ROLES = [
  { role: 'success', ts: 'STATUS_SUCCESS', css: '--glow-success' },
  { role: 'warning', ts: 'STATUS_WARNING', css: '--glow-warning' },
  { role: 'info', ts: 'STATUS_INFO', css: '--glow-info' },
];

/** Same hue family: hues within this many degrees are the same colour to a reader. */
const HUE_TOLERANCE = 20;

const die = (code, msg) => { console.error(msg); process.exit(code); };
for (const f of [TS, CSS]) if (!fs.existsSync(f)) die(2, `token-parity INSTRUMENT FAILURE: ${path.relative(ROOT, f)} does not exist. The gate is pinned to an artifact that moved; repoint it rather than deleting the check.`);

const tsSrc = fs.readFileSync(TS, 'utf8');
const cssSrc = fs.readFileSync(CSS, 'utf8');

const readTs = (name) => (tsSrc.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['"](#[0-9a-fA-F]{6})['"]`)) ?? [])[1];
const readCss = (name) => {
  const raw = (cssSrc.match(new RegExp(`${name}\\s*:\\s*([^;]+);`)) ?? [])[1]?.trim();
  if (!raw) return undefined;
  const rgba = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgba) return '#' + rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  const hex = raw.match(/#([0-9a-fA-F]{6})/);
  return hex ? `#${hex[1]}` : undefined;
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Hue in degrees, and perceived lightness (HSL L), enough to judge family and order. */
const hsl = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, l: (max + min) / 2 };
};
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const rows = ROLES.map((r) => {
  const mark = readTs(r.ts), halo = readCss(r.css);
  if (!mark || !halo) return { ...r, mark, halo, missing: true };
  const M = hsl(mark), H = hsl(halo);
  const gap = hueGap(M.h, H.h);
  return { ...r, mark, halo, gap, markL: M.l, haloL: H.l, sameFamily: gap <= HUE_TOLERANCE, markLighter: M.l >= H.l - 0.001 };
});

const parsedTs = rows.filter((r) => r.mark).length;
const parsedCss = rows.filter((r) => r.halo).length;
if (!parsedTs || !parsedCss) {
  die(2, `token-parity INSTRUMENT FAILURE: parsed ${parsedTs} token(s) from chart-colors.ts and ${parsedCss} from globals.css.\n` +
    '  A checker that reads zero tokens and reports kinship is an empty success. One of the two\n' +
    '  files changed shape; fix the reader, do not lower the check.');
}

console.log('token-parity — MARK (chart fill, contrast-bearing) vs HALO (glow, decorative)\n');
console.log(`  role     mark      halo      hue gap  mark lighter  verdict`);
for (const r of rows) {
  if (r.missing) { console.log(`  ${r.role.padEnd(8)} ${(r.mark ?? '—').padEnd(9)} ${(r.halo ?? '—').padEnd(9)} ${'—'.padEnd(8)} ${'—'.padEnd(13)} MISSING`); continue; }
  const ok = r.sameFamily && r.markLighter;
  console.log(`  ${r.role.padEnd(8)} ${r.mark.padEnd(9)} ${r.halo.padEnd(9)} ${(r.gap.toFixed(0) + '°').padEnd(8)} ${(r.markLighter ? 'yes' : 'NO').padEnd(13)} ${ok ? 'ok' : 'BROKEN'}`);
}

const bad = rows.filter((r) => r.missing || !r.sameFamily || !r.markLighter);
if (!bad.length) {
  console.log(`\n  ${rows.length} role(s) kin across both runtimes: same hue family, mark lighter than halo.`);
  console.log('  Value equality is NOT asserted and must not be — the mark is contrast-constrained');
  console.log('  (WCAG 1.4.11, owned by src/__tests__/lib/contrast.test.ts) and the halo is not.');
  process.exit(0);
}
console.log(`\n  ${bad.length} role(s) broke the mark/halo relationship.`);
for (const r of bad) {
  if (r.missing) console.log(`  - ${r.role}: one runtime does not define it (set equality is part of parity).`);
  else if (!r.sameFamily) console.log(`  - ${r.role}: hue gap ${r.gap.toFixed(0)}° exceeds ${HUE_TOLERANCE}° — these read as different colours.`);
  else console.log(`  - ${r.role}: the mark is DARKER than the halo, so the contrast-constrained role has less headroom than the decorative one.`);
}
if (reportOnly) { console.log('\n  --report: advisory run, exiting 0.'); process.exit(0); }
process.exit(1);
