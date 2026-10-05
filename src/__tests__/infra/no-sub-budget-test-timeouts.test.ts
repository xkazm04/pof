import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guard for the global test budget in `vitest.config.ts` (testTimeout/hookTimeout 60 s).
 *
 * A per-suite or per-test timeout BELOW that budget overrides it and brings the full-suite flake
 * back (the full suite runs ~1800 jsdom files on 16 workers; a slow-but-correct test needs far
 * more under that load). See docs/architecture/test-infrastructure.md.
 *
 * Scope: a numeric timeout passed to `describe` / `it` / `test` — either an options object
 * (`{ timeout: N }`) or the trailing number (`}, N);`) — and `vi.setConfig({ testTimeout|hookTimeout })`.
 * NOT in scope: `findBy*` / `waitFor` budgets, or any `timeout:` in a test body (child-process or
 * product options) — those are not test budgets, and the scan only reads the arguments of the
 * `describe`/`it`/`test` call itself.
 */
const BUDGET_MS = 60_000;

/**
 * Sites that may keep a timeout under the budget because the test's own timeout is the thing
 * under test. Keyed by repo-relative path; every entry needs a reason. Empty on purpose: the
 * sites audited when this guard landed (harness kill tests, process-spawn tests, heavy renders)
 * all measure their own internal timers, not the vitest budget, so none needed to keep one.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [];

interface Finding {
  line: number;
  value: number;
  kind: 'options' | 'trailing' | 'setConfig';
}

const CALL_RE = /\b(?:describe|it|test)(?:\.\w+(?:\([^()]*\))?)*\(/g;
const SET_CONFIG_RE = /\bvi\.setConfig\(\s*\{[^}]*?\b(?:testTimeout|hookTimeout)\s*:\s*(\d[\d_]*)/g;
const toMs = (digits: string): number => Number(digits.replace(/_/g, ''));

/** Split the arguments of the call whose `(` is at `open`: [start offset, text] per top-level arg. */
function splitArgs(src: string, open: number): Array<[number, string]> {
  const args: Array<[number, string]> = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i < 1) break; continue; }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push([start, src.slice(start, i)]); return args; }
    } else if (c === ',' && depth === 1) {
      args.push([start, src.slice(start, i)]);
      start = i + 1;
    }
  }
  return args;
}

/** Every describe/it/test/setConfig timeout in `src` that is under the global budget. */
function findSubBudgetTimeouts(src: string): Finding[] {
  const lineAt = (offset: number) => src.slice(0, offset).split('\n').length;
  const found: Finding[] = [];
  for (const m of src.matchAll(CALL_RE)) {
    for (const [start, raw] of splitArgs(src, m.index! + m[0].length - 1)) {
      const arg = raw.trim();
      const at = start + raw.indexOf(arg);
      const trailing = /^(\d[\d_]*)$/.exec(arg);
      const options = /^\{[^]*?\btimeout\s*:\s*(\d[\d_]*)\b[^]*\}$/.exec(arg);
      const hit = trailing ?? options;
      if (hit && toMs(hit[1]) < BUDGET_MS) {
        found.push({ line: lineAt(at), value: toMs(hit[1]), kind: trailing ? 'trailing' : 'options' });
      }
    }
  }
  for (const m of src.matchAll(SET_CONFIG_RE)) {
    if (toMs(m[1]) < BUDGET_MS) found.push({ line: lineAt(m.index!), value: toMs(m[1]), kind: 'setConfig' });
  }
  return found.sort((a, b) => a.line - b.line);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('findSubBudgetTimeouts — the matcher proves itself', () => {
  const flagged: Array<[string, string, number]> = [
    ['describe options', "describe('s', { timeout: 20_000 }, () => {\n});", 20_000],
    ['it options', "it('x', { timeout: 30000 }, async () => {});", 30_000],
    ['test options', "test('x', { timeout: 59_999 }, () => {});", 59_999],
    ['trailing number', "it('x', async () => {\n  await go();\n}, 15_000);", 15_000],
    ['modifier + trailing', "it.runIf(isWindows)('x', async () => {\n}, 30_000);", 30_000],
    ['it.skip trailing', "it.skip('x', () => {}, 1000);", 1_000],
    ['setConfig', 'vi.setConfig({ testTimeout: 20_000 });', 20_000],
    ['setConfig hook', 'vi.setConfig({ hookTimeout: 5_000 });', 5_000],
  ];
  it.each(flagged)('flags %s', (_name, sample, value) => {
    const hits = findSubBudgetTimeouts(sample);
    expect(hits.map((h) => h.value)).toEqual([value]);
  });

  it('reports the line of the offending argument', () => {
    expect(findSubBudgetTimeouts("it('a', () => {});\n\nit('b', () => {\n}, 10_000);")[0].line).toBe(4);
  });

  const clean: Array<[string, string]> = [
    ['findBy with { timeout: 20_000 }', "it('x', async () => {\n  await screen.findByRole('button', { name: /go/ }, { timeout: 20_000 });\n});"],
    ['waitFor option', "it('x', async () => {\n  await waitFor(() => expect(a).toBe(1), { timeout: 3000 });\n});"],
    ['multi-line waitFor option', "it('x', async () => {\n  await waitFor(\n    () => expect(a).toBe(1),\n    { timeout: 20_000 },\n  );\n});"],
    ['child-process timeout in the body', "it('x', () => {\n  spawnSync(cmd, args, { timeout: 30_000 });\n});"],
    ['option at the budget', "describe('s', { timeout: 60_000 }, () => {});"],
    ['option above the budget', "it('x', { timeout: 120_000 }, () => {});"],
    ['trailing at the budget', "it('x', () => {\n}, 60000);"],
    ['trailing above the budget', "it('x', () => {\n}, 300_000);"],
    ['numeric arg of a nested call', "it('x', () => {\n  expect(observe(ledger, 2)).toBe(1);\n  setTimeout(() => {}, 0);\n});"],
    ['no timeout at all', "describe('s', () => { it('x', () => {}); });"],
    ['setConfig at the budget', 'vi.setConfig({ testTimeout: 60_000 });'],
  ];
  it.each(clean)('does not flag %s', (_name, sample) => {
    expect(findSubBudgetTimeouts(sample)).toEqual([]);
  });
});

describe(`no describe/it/test timeout under the ${BUDGET_MS / 1000} s global budget`, () => {
  it('src/__tests__ carries no per-suite or per-test timeout below the budget', () => {
    const root = path.resolve(__dirname, '..');
    const repo = path.resolve(root, '..', '..');
    const self = path.resolve(__filename);
    const allowed = new Set(ALLOWLIST.map((a) => a.file));
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (path.resolve(file) === self) continue; // its samples are deliberate violations
      const rel = path.relative(repo, file).split(path.sep).join('/');
      if (allowed.has(rel)) continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const f of findSubBudgetTimeouts(src)) offenders.push(`${rel}:${f.line} — ${f.kind} timeout ${f.value} ms`);
    }
    expect(
      offenders,
      `A timeout under ${BUDGET_MS} ms overrides vitest.config.ts and re-introduces the full-suite flake — delete it ` +
        '(see docs/architecture/test-infrastructure.md), or allowlist the file with a reason if the timeout itself is under test.',
    ).toEqual([]);
  });

  it('every allowlist entry names an existing file and gives a reason', () => {
    const repo = path.resolve(__dirname, '..', '..', '..');
    for (const a of ALLOWLIST) {
      expect(fs.existsSync(path.join(repo, a.file)), a.file).toBe(true);
      expect(a.reason.trim().length, a.file).toBeGreaterThan(0);
    }
  });
});
