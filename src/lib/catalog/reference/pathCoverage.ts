/**
 * Path coverage for a CODE reference — which files of the reference tree an ingest spec reads,
 * which are descoped with a reason, and which nobody has judged yet.
 *
 * A table source (Diablo's TSVs) is covered when each table has a spec. A source tree of
 * thousands of C++ files is covered file by file, and "covered" has to be DERIVED from the
 * tree as it actually is at the pin — never a number somebody wrote down — so a spec glob that
 * stops matching, or a descope that swallows too much, moves a count instead of rotting
 * silently. `open` is the honest bucket: a file neither read nor descoped is undecided, and
 * the loop is not finished while one exists.
 *
 * Pure: the caller walks the tree and hands in relative POSIX paths.
 */
import type { StoreReport } from './wrappers-db';

/**
 * Glob → RegExp over POSIX relative paths. `**` spans directories (a whole `**` segment also
 * matches zero of them), `*` and `?` stay inside one segment, `{a,b}` is alternation.
 */
export function globToRegExp(pattern: string): RegExp {
  let re = '';
  let i = 0;
  let inBrace = false;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      const segmentStart = i === 0 || pattern[i - 1] === '/';
      if (segmentStart && pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 3; continue; }
      re += '.*';
      i += 2;
      continue;
    }
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{' && !inBrace) { re += '(?:'; inBrace = true; }
    else if (c === '}' && inBrace) { re += ')'; inBrace = false; }
    else if (c === ',' && inBrace) re += '|';
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    i++;
  }
  return new RegExp(`^${re}$`);
}

/** A spec `file` is a glob when it carries a wildcard or an alternation. */
export const isGlobPattern = (path: string): boolean => /[*?{]/.test(path);

export const matchesGlob = (path: string, pattern: string): boolean => globToRegExp(pattern).test(path);

/** The files a glob selects, sorted, so a spec's read order (and its wrappers) is stable. */
export function expandGlob(files: readonly string[], pattern: string): string[] {
  const re = globToRegExp(pattern);
  return files.filter((f) => re.test(f)).sort();
}

export interface Descope {
  /** Glob over the reference tree (a directory is `dir/**`). */
  pattern: string;
  /** Why PoF does not need these files — in PoF's own words. */
  reason: string;
}

export interface CoverageCounts {
  total: number;
  covered: number;
  descoped: number;
  open: number;
}

export interface AreaCoverage extends CoverageCounts {
  area: string;
}

export interface PathCoverage extends CoverageCounts {
  areas: AreaCoverage[];
  /** Per descope: how many files it accounts for (a descope matching nothing is a finding). */
  descopes: { pattern: string; reason: string; files: number }[];
  /** Per spec glob: how many files it reads. */
  specs: { pattern: string; files: number }[];
  /** Open files, sorted — the undecided remainder. */
  openFiles: string[];
}

/** The area a path belongs to: its first `depth` segments (files above that depth group by their directory). */
export function areaOf(path: string, depth: number): string {
  const parts = path.split('/');
  return parts.slice(0, Math.min(depth, parts.length - 1)).join('/') || '.';
}

/**
 * Classify every file once. A file matched by a spec is COVERED even if a descope also matches
 * it — reading beats ignoring, and the overlap cannot double-count.
 */
export function computePathCoverage(
  files: readonly string[],
  specGlobs: readonly string[],
  descopes: readonly Descope[],
  areaDepth = 3,
): PathCoverage {
  const specRes = specGlobs.map((pattern) => ({ pattern, re: globToRegExp(pattern), files: 0 }));
  const descopeRes = descopes.map((d) => ({ ...d, re: globToRegExp(d.pattern), files: 0 }));
  const areas = new Map<string, AreaCoverage>();
  const totals: CoverageCounts = { total: 0, covered: 0, descoped: 0, open: 0 };
  const openFiles: string[] = [];

  for (const file of [...files].sort()) {
    const area = areaOf(file, areaDepth);
    const row = areas.get(area) ?? { area, total: 0, covered: 0, descoped: 0, open: 0 };
    areas.set(area, row);
    row.total++;
    totals.total++;
    const specHits = specRes.filter((s) => s.re.test(file));
    specHits.forEach((s) => { s.files++; });
    if (specHits.length) { row.covered++; totals.covered++; continue; }
    const descope = descopeRes.find((d) => d.re.test(file));
    if (descope) { descope.files++; row.descoped++; totals.descoped++; continue; }
    row.open++;
    totals.open++;
    openFiles.push(file);
  }

  return {
    ...totals,
    areas: [...areas.values()].sort((a, b) => a.area.localeCompare(b.area)),
    descopes: descopeRes.map(({ pattern, reason, files: n }) => ({ pattern, reason, files: n })),
    specs: specRes.map(({ pattern, files: n }) => ({ pattern, files: n })),
    openFiles,
  };
}

/* ── termination ────────────────────────────────────────────────────────── */

/** What one round (one `/zelda next` ingest) left behind — recorded with the ingest run. */
export interface RoundSnapshot {
  coverage: CoverageCounts;
  store: StoreReport;
  /** Learning outputs counted from the vault: Path nodes, Findings entries, Upgrade notes. */
  vault: { pathNodes: number; findings: number; upgrades: number };
}

export interface TerminationVerdict {
  met: boolean;
  /** Every file is covered or descoped (`open === 0`). */
  allAccounted: boolean;
  /** The newest round created / re-projected nothing and moved no count against the round before it. */
  roundMovedNothing: boolean;
  reasons: string[];
}

/**
 * The loop's STOP rule: everything accounted for AND a full round moved nothing. Both halves
 * are needed — a quiet round with open files is a stall, not a finish, and a fully accounted
 * tree whose last round still created wrappers or notes is still learning.
 *
 * `history` is newest first. Fewer than two rounds can never prove a round moved nothing.
 */
export function terminationVerdict(history: readonly RoundSnapshot[]): TerminationVerdict {
  const reasons: string[] = [];
  const [now, before] = history;
  if (!now) return { met: false, allAccounted: false, roundMovedNothing: false, reasons: ['no round recorded yet'] };

  const allAccounted = now.coverage.open === 0;
  if (!allAccounted) reasons.push(`${now.coverage.open} file(s) neither covered nor descoped`);

  let roundMovedNothing = false;
  if (!before) {
    reasons.push('only one round recorded — a quiet round needs a previous round to compare against');
  } else {
    const moved: string[] = [];
    const { created, rawChanged, reprojected } = now.store;
    if (created) moved.push(`created ${created}`);
    if (rawChanged) moved.push(`rawChanged ${rawChanged}`);
    if (reprojected) moved.push(`reprojected ${reprojected}`);
    if (now.coverage.covered !== before.coverage.covered) moved.push(`covered ${before.coverage.covered}→${now.coverage.covered}`);
    if (now.coverage.descoped !== before.coverage.descoped) moved.push(`descoped ${before.coverage.descoped}→${now.coverage.descoped}`);
    for (const key of ['pathNodes', 'findings', 'upgrades'] as const) {
      if (now.vault[key] !== before.vault[key]) moved.push(`${key} ${before.vault[key]}→${now.vault[key]}`);
    }
    roundMovedNothing = moved.length === 0;
    if (!roundMovedNothing) reasons.push(`the last round moved: ${moved.join(', ')}`);
  }

  return { met: allAccounted && roundMovedNothing, allAccounted, roundMovedNothing, reasons };
}
