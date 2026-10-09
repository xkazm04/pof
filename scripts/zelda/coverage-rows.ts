/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Re-derive the vault's Coverage.md row counts from the pinned tree and PROVE the rows partition
 * it. Read-only: it prints, it never writes the vault (prose and tables are edited by hand).
 *
 *   npx tsx scripts/zelda/coverage-rows.ts --root <botw clone> [--vault <Zelda vault dir>] [--all]
 *
 * The row globs live in the vault, not here — this repo carries no map of the tree. A row's glob
 * cell holds one or more backticked globs joined by ` · `; a glob after the word `except` is
 * subtracted from the row (a bare name is relative to the directory of the glob before it). Each file is classified as `status.ts` does (a spec glob → covered,
 * else a descope → descoped, else open). The partition check fails loudly: a file owned by two
 * rows (overlap) or by none (unowned), or a row sum different from the tree, exits 1.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOTW_DESCOPES } from '@/lib/catalog/ingest/botw';
import { globToRegExp } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { arg, DEFAULT_VAULT, flag, requireClone, treeFiles } from './shared';

const root = arg('root');
requireClone(root);
const vault = arg('vault') ?? DEFAULT_VAULT;

interface Row { label: string; include: RegExp[]; exclude: RegExp[]; cells: string[] }

/** The table rows of Coverage.md whose second cell holds a glob. */
function readRows(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('| ') || !line.includes('`src/')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const include: RegExp[] = [];
    const exclude: RegExp[] = [];
    let dir = '';
    for (const m of cells[1].matchAll(/(except\s+)?`([^`]+)`/g)) {
      // A bare name after `except` is relative to the glob it qualifies (`src/a/b*` except `bx*` = `src/a/bx*`).
      const glob = m[2].includes('/') ? m[2] : `${dir}${m[2]}`;
      dir = glob.slice(0, glob.lastIndexOf('/') + 1);
      (m[1] ? exclude : include).push(globToRegExp(glob));
    }
    rows.push({ label: cells[0], include, exclude, cells });
  }
  return rows;
}

const specs = BOTW.tables.map((t) => globToRegExp(t.file));
const descopes = BOTW_DESCOPES.map((d) => globToRegExp(d.pattern));
const classify = (f: string): 'covered' | 'descoped' | 'open' =>
  specs.some((re) => re.test(f)) ? 'covered' : descopes.some((re) => re.test(f)) ? 'descoped' : 'open';

const rows = readRows(readFileSync(join(vault, 'Coverage.md'), 'utf8'));
if (rows.length === 0) {
  console.error(`REFUSED: no glob rows found in ${join(vault, 'Coverage.md')}`);
  process.exit(2);
}
const files = treeFiles(root as string);
const counts = rows.map(() => ({ files: 0, covered: 0, descoped: 0, open: 0 }));
let overlaps = 0;
const unowned: string[] = [];
for (const f of files) {
  const owners = rows.flatMap((r, i) => (r.include.some((re) => re.test(f)) && !r.exclude.some((re) => re.test(f)) ? [i] : []));
  if (owners.length === 0) { unowned.push(f); continue; }
  if (owners.length > 1) overlaps++;
  const c = counts[owners[0]];
  c.files++;
  c[classify(f)]++;
}

let changed = 0;
for (const [i, r] of rows.entries()) {
  const c = counts[i];
  const old = r.cells.slice(2, 6).map(Number);
  const moved = old[0] !== c.files || old[1] !== c.covered || old[2] !== c.descoped || old[3] !== c.open;
  if (moved) changed++;
  if (moved || flag('all')) {
    console.log(`${moved ? 'MOVED ' : '      '}| ${[r.cells[0], r.cells[1], c.files, c.covered, c.descoped, c.open, ...r.cells.slice(6)].join(' | ')} |`);
    if (moved) console.log(`       was ${old.join(' / ')}`);
  }
}
const sum = counts.reduce((n, c) => n + c.files, 0);
const tot = counts.reduce((t, c) => ({ covered: t.covered + c.covered, descoped: t.descoped + c.descoped, open: t.open + c.open }), { covered: 0, descoped: 0, open: 0 });
console.log(`\nrows ${rows.length} · tree ${files.length} · row sum ${sum} · overlaps ${overlaps} · unowned ${unowned.length} · rows moved ${changed}`);
console.log(`totals: covered ${tot.covered} · descoped ${tot.descoped} · open ${tot.open}`);
for (const f of unowned.slice(0, 10)) console.log(`  unowned: ${f}`);
const ok = overlaps === 0 && unowned.length === 0 && sum === files.length;
console.log(ok ? 'PARTITION: ok' : 'PARTITION: BROKEN — fix the row globs before trusting any row');
process.exit(ok ? 0 : 1);
