/**
 * What both /zelda tools share: argument parsing, the clone check they REFUSE on, the walk of the
 * reference's `src/` tree, the coverage it derives, and the learning counts read from the vault.
 * Read-only — nothing here writes the clone, the vault or the database.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BOTW_DESCOPES, BOTW_PIN, BOTW_TREE } from '@/lib/catalog/ingest/botw';
import { listFilesUnder } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, type CoverageCounts, type PathCoverage, type RoundSnapshot } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';

export const DEFAULT_VAULT = 'C:/Users/kazda/Documents/Obsidian/pof/Zelda';

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const git = (root: string, ...args: string[]): string =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export type CloneCheck = { ok: true; head: string } | { ok: false; reason: string };

/** The reference is only meaningful at the pin: a missing, moved or dirty clone is refused. */
export function checkClone(root: string | undefined): CloneCheck {
  if (!root) return { ok: false, reason: 'no --root given (the botw clone, e.g. C:/Users/kazda/kiro/reference/botw)' };
  if (!existsSync(root) || !statSync(root).isDirectory()) return { ok: false, reason: `root ${root} does not exist` };
  if (!existsSync(join(root, BOTW_TREE))) return { ok: false, reason: `root ${root} has no ${BOTW_TREE}/ — not the botw clone, or the sparse checkout is missing it` };
  let head: string;
  try {
    head = git(root, 'rev-parse', 'HEAD');
  } catch {
    return { ok: false, reason: `root ${root} is not a git checkout` };
  }
  if (head !== BOTW_PIN) return { ok: false, reason: `clone HEAD ${head} is not the pin ${BOTW_PIN} — check out the pin, or move the pin deliberately (a Decision)` };
  const dirty = git(root, 'status', '--porcelain');
  if (dirty) return { ok: false, reason: `clone at ${root} has local changes — the records would not be the pin's:\n${dirty.split('\n').slice(0, 5).join('\n')}` };
  return { ok: true, head };
}

/** Exit 2 with the reason when the clone is refused; otherwise return its HEAD. */
export function requireClone(root: string | undefined): string {
  const check = checkClone(root);
  if (!check.ok) {
    console.error(`REFUSED: ${check.reason}`);
    process.exit(2);
  }
  return check.head;
}

/** Every file of the in-scope tree, as POSIX paths relative to the clone root (`src/...`). */
export function treeFiles(root: string): string[] {
  return listFilesUnder(join(root, BOTW_TREE)).map((f) => `${BOTW_TREE}/${f}`);
}

export function botwCoverage(root: string, depth = 3): PathCoverage {
  return computePathCoverage(treeFiles(root), BOTW.tables.map((t) => t.file), BOTW_DESCOPES, depth);
}

export const countsOf = (c: CoverageCounts): CoverageCounts => ({ total: c.total, covered: c.covered, descoped: c.descoped, open: c.open });

/**
 * The learning outputs a round can add, counted from the vault: Path nodes (notes in `Path/`
 * other than the index), Findings entries (`## F<n>` headings) and Upgrade notes (`Upgrades/U*.md`).
 */
export function vaultCounts(vault: string): RoundSnapshot['vault'] & { vaultFound: boolean } {
  const mdIn = (dir: string, keep: (name: string) => boolean): number =>
    existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.md') && keep(n)).length : 0;
  const findingsFile = join(vault, 'Findings.md');
  return {
    vaultFound: existsSync(vault),
    pathNodes: mdIn(join(vault, 'Path'), (n) => n !== 'Index.md'),
    findings: existsSync(findingsFile) ? (readFileSync(findingsFile, 'utf8').match(/^## F\d+/gm) ?? []).length : 0,
    upgrades: mdIn(join(vault, 'Upgrades'), (n) => /^U\d+/.test(n)),
  };
}
