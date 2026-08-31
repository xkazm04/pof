#!/usr/bin/env node
/**
 * token-parity — the status-colour vocabulary exists in two runtimes; keep them honest.
 *
 * ## Why this exists
 *
 * The semantic status palette is authored twice: as TS constants in `src/lib/chart-colors.ts`
 * (charts, SVG fills, badges) and as CSS custom properties in `src/app/globals.css` (glows,
 * status surfaces). One vocabulary with two hand-maintained copies is not redundancy — it is a
 * race with a delay fuse, and it has already fired: a 2026-08-31 conformance pass found the two
 * layers disagreeing on success, warning and info.
 *
 * The registry's `design-tokens/cross-language-token-parity` ranks the fixes: one source with a
 * generated mirror is strongest, runtime readback next, and a **gated mirror** — both copies
 * authored, an automated check comparing them — is the acceptable floor. This is that floor.
 *
 * ## What it refuses to do
 *
 * Per `gate-sees-target`, a parity checker must parse the ARTIFACTS BOTH RUNTIMES CONSUME, not
 * a doc describing them — so this reads the real `.ts` and the real `.css`. And it must **fail
 * loudly when it finds zero tokens on either side**: a checker that parses nothing and reports
 * parity is the empty-success lie, and it is the failure mode that makes a green gate worthless.
 * Finding no tokens is an instrument failure here (exit 2), never a pass.
 *
 * Parity is set equality as well as value equality: a role present in one runtime and absent in
 * the other means consumers there are building on vocabulary the design system never issued.
 *
 * Usage:
 *   node scripts/token-parity.mjs            # report; exit 1 on drift
 *   node scripts/token-parity.mjs --report   # report only; exit 0 (for an advisory run)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TS = path.join(ROOT, 'src/lib/chart-colors.ts');
const CSS = path.join(ROOT, 'src/app/globals.css');
const reportOnly = process.argv.includes('--report');

/** The roles that genuinely exist in both runtimes. Add a row when a role gains a second home. */
const ROLES = [
  { role: 'success', ts: 'STATUS_SUCCESS', css: '--glow-success' },
  { role: 'warning', ts: 'STATUS_WARNING', css: '--glow-warning' },
  { role: 'info', ts: 'STATUS_INFO', css: '--glow-info' },
];

const die = (code, msg) => { console.error(msg); process.exit(code); };

for (const f of [TS, CSS]) if (!fs.existsSync(f)) die(2, `token-parity INSTRUMENT FAILURE: ${path.relative(ROOT, f)} does not exist. The gate is pinned to an artifact that moved; repoint it rather than deleting the check.`);

const tsSrc = fs.readFileSync(TS, 'utf8');
const cssSrc = fs.readFileSync(CSS, 'utf8');

/** `export const NAME = '#rrggbb'` */
const readTs = (name) => (tsSrc.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['"](#[0-9a-fA-F]{3,8})['"]`)) ?? [])[1];
/** `--name: rgba(r, g, b, a)` or `--name: #rrggbb[aa]` -> normalized #rrggbb (alpha dropped) */
const readCss = (name) => {
  const raw = (cssSrc.match(new RegExp(`${name}\\s*:\\s*([^;]+);`)) ?? [])[1]?.trim();
  if (!raw) return undefined;
  const rgba = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgba) return '#' + rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  const hex = raw.match(/#([0-9a-fA-F]{6})/);
  return hex ? `#${hex[1]}` : undefined;
};

const rows = ROLES.map((r) => {
  const ts = readTs(r.ts);
  const css = readCss(r.css);
  return { ...r, tsValue: ts, cssValue: css, missing: !ts || !css, equal: !!ts && !!css && ts.toLowerCase() === css.toLowerCase() };
});

// The empty-success guard. Parsing nothing is an instrument failure, not parity.
const parsedTs = rows.filter((r) => r.tsValue).length;
const parsedCss = rows.filter((r) => r.cssValue).length;
if (!parsedTs || !parsedCss) {
  die(2, `token-parity INSTRUMENT FAILURE: parsed ${parsedTs} token(s) from chart-colors.ts and ${parsedCss} from globals.css.\n` +
    '  A parity checker that reads zero tokens and reports parity is an empty success. One of the\n' +
    '  two files changed shape; fix the reader, do not lower the check.');
}

const w = Math.max(...rows.map((r) => r.role.length));
console.log('token-parity — the status vocabulary in both runtimes\n');
console.log(`  ${'role'.padEnd(w)}  ${'chart-colors.ts'.padEnd(17)} ${'globals.css'.padEnd(17)} verdict`);
for (const r of rows) {
  const verdict = r.missing ? 'MISSING' : r.equal ? 'ok' : 'DRIFTED';
  console.log(`  ${r.role.padEnd(w)}  ${(r.tsValue ?? '—').padEnd(17)} ${(r.cssValue ?? '—').padEnd(17)} ${verdict}`);
}

const bad = rows.filter((r) => r.missing || !r.equal);
if (!bad.length) { console.log(`\n  ${rows.length} role(s) in parity across both runtimes.`); process.exit(0); }

console.log(`\n  ${bad.length} of ${rows.length} role(s) disagree between the two runtimes.`);
console.log('  These are one vocabulary with two authors. Unify them in ONE direction and delete');
console.log('  the other copy or generate it — a comment asking the next person to keep them in');
console.log('  sync is not a strategy (design-tokens/cross-language-token-parity).');
if (reportOnly) { console.log('\n  --report: advisory run, exiting 0.'); process.exit(0); }
process.exit(1);
