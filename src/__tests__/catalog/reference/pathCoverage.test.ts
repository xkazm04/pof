// Path coverage is the /zelda loop's measuring stick: covered / descoped / open is DERIVED from
// the tree and the globs, never written down, and the STOP rule must be able to say "not yet".
import { describe, expect, it } from 'vitest';
import {
  areaOf, computePathCoverage, expandGlob, globToRegExp, isGlobPattern, matchesGlob,
  terminationVerdict, type RoundSnapshot,
} from '@/lib/catalog/reference/pathCoverage';

const TREE = [
  'src/Core/Clock/clock.h',
  'src/Core/Clock/clock.cpp',
  'src/Core/Clock/CMakeLists.txt',
  'src/Core/root.h',
  'src/Game/Hero/hero.h',
  'src/Game/Hero/hero.cpp',
  'src/Game/Hero/Moves/dash.h',
  'src/Game/Hero/Moves/dash.cpp',
  'src/Game/Hero/Moves/notes.txt',
  'src/Game/Kitchen/pot.h',
  'src/top.h',
  'README.md',
];

describe('globs', () => {
  it('** spans directories (and zero of them), * and ? stay in one segment, {a,b} alternates', () => {
    expect(matchesGlob('src/Game/Hero/hero.h', 'src/Game/Hero/**/*.{h,cpp}')).toBe(true);
    expect(matchesGlob('src/Game/Hero/Moves/dash.cpp', 'src/Game/Hero/**/*.{h,cpp}')).toBe(true);
    expect(matchesGlob('src/Game/Hero/Moves/notes.txt', 'src/Game/Hero/**/*.{h,cpp}')).toBe(false);
    expect(matchesGlob('src/Game/Hero/Moves/dash.h', 'src/Game/Hero/*')).toBe(false);
    expect(matchesGlob('src/Game/Hero/hero.h', 'src/Game/Hero/*')).toBe(true);
    expect(matchesGlob('src/Core/Clock/CMakeLists.txt', 'src/**/CMakeLists.txt')).toBe(true);
    expect(matchesGlob('src/Core/Clock/clock.h', 'src/Core/Clock/clock.?')).toBe(true);
    expect(matchesGlob('src/Core/Clock/clock.h', 'src/Core/**')).toBe(true);
    // Regex metacharacters in a path are literal.
    expect(globToRegExp('a+b/(c).h').test('a+b/(c).h')).toBe(true);
    expect(globToRegExp('a+b/(c).h').test('aab/c.h')).toBe(false);
  });

  it('expands a glob to the sorted matching files, and says which spec files are globs', () => {
    expect(expandGlob(TREE, 'src/Game/Hero/**/*.{h,cpp}')).toEqual([
      'src/Game/Hero/Moves/dash.cpp', 'src/Game/Hero/Moves/dash.h', 'src/Game/Hero/hero.cpp', 'src/Game/Hero/hero.h',
    ]);
    expect(expandGlob(TREE, 'src/Nowhere/**')).toEqual([]);
    expect(isGlobPattern('monsters/monstdat.tsv')).toBe(false);
    expect(isGlobPattern('src/**/*.h')).toBe(true);
    expect(isGlobPattern('src/x.{h,cpp}')).toBe(true);
  });
});

describe('computePathCoverage', () => {
  const descopes = [
    { pattern: 'src/**/CMakeLists.txt', reason: 'build wiring' },
    { pattern: 'src/Core/**', reason: 'engine core' },
    { pattern: 'src/Unmatched/**', reason: 'matches nothing' },
  ];
  const cov = computePathCoverage(TREE.filter((f) => f.startsWith('src/')), ['src/Game/Hero/**/*.{h,cpp}'], descopes);

  it('classifies every file exactly once: covered, else descoped, else open', () => {
    expect({ total: cov.total, covered: cov.covered, descoped: cov.descoped, open: cov.open })
      .toEqual({ total: 11, covered: 4, descoped: 4, open: 3 });
    expect(cov.covered + cov.descoped + cov.open).toBe(cov.total);
    expect(cov.openFiles).toEqual(['src/Game/Hero/Moves/notes.txt', 'src/Game/Kitchen/pot.h', 'src/top.h']);
  });

  it('breaks the counts down per area and reports what each descope and spec accounts for', () => {
    expect(cov.areas).toEqual([
      { area: 'src', total: 1, covered: 0, descoped: 0, open: 1 },
      { area: 'src/Core', total: 1, covered: 0, descoped: 1, open: 0 },
      { area: 'src/Core/Clock', total: 3, covered: 0, descoped: 3, open: 0 },
      { area: 'src/Game/Hero', total: 5, covered: 4, descoped: 0, open: 1 },
      { area: 'src/Game/Kitchen', total: 1, covered: 0, descoped: 0, open: 1 },
    ]);
    // The first matching descope claims a file; a descope that matches nothing is visible as 0.
    expect(cov.descopes.map((d) => d.files)).toEqual([1, 3, 0]);
    expect(cov.specs).toEqual([{ pattern: 'src/Game/Hero/**/*.{h,cpp}', files: 4 }]);
  });

  it('counts a file matched by a spec AND a descope as covered — reading beats ignoring', () => {
    const both = computePathCoverage(['src/Core/root.h'], ['src/Core/*.h'], [{ pattern: 'src/Core/**', reason: 'x' }]);
    expect(both).toMatchObject({ covered: 1, descoped: 0, open: 0 });
  });

  it('areaOf groups by the first segments, files above that depth by their directory', () => {
    expect(areaOf('src/Game/Hero/Moves/dash.h', 3)).toBe('src/Game/Hero');
    expect(areaOf('src/top.h', 3)).toBe('src');
    expect(areaOf('top.h', 3)).toBe('.');
  });
});

describe('terminationVerdict', () => {
  const round = (over: Partial<RoundSnapshot> = {}): RoundSnapshot => ({
    coverage: { total: 10, covered: 6, descoped: 4, open: 0 },
    store: { created: 0, rawChanged: 0, reprojected: 0, unchanged: 30 },
    vault: { pathNodes: 3, findings: 2, upgrades: 5 },
    ...over,
  });

  it('is met only when nothing is open AND the last round moved nothing against the one before', () => {
    expect(terminationVerdict([round(), round()])).toEqual({ met: true, allAccounted: true, roundMovedNothing: true, reasons: [] });
  });

  it('cannot be met by one round, or by none', () => {
    expect(terminationVerdict([]).met).toBe(false);
    const single = terminationVerdict([round()]);
    expect(single.met).toBe(false);
    expect(single.reasons[0]).toMatch(/only one round/);
  });

  it('a quiet round with open files is a stall, not a finish', () => {
    const open = round({ coverage: { total: 10, covered: 5, descoped: 4, open: 1 } });
    const v = terminationVerdict([open, open]);
    expect(v).toMatchObject({ met: false, allAccounted: false, roundMovedNothing: true });
    expect(v.reasons).toEqual(['1 file(s) neither covered nor descoped']);
  });

  it('any created / reprojected wrapper, coverage move or new vault note keeps the loop running', () => {
    const cases: [Partial<RoundSnapshot>, RegExp][] = [
      [{ store: { created: 2, rawChanged: 0, reprojected: 0, unchanged: 28 } }, /created 2/],
      [{ store: { created: 0, rawChanged: 0, reprojected: 7, unchanged: 23 } }, /reprojected 7/],
      [{ store: { created: 0, rawChanged: 1, reprojected: 0, unchanged: 29 } }, /rawChanged 1/],
      [{ coverage: { total: 10, covered: 7, descoped: 3, open: 0 } }, /covered 6→7/],
      [{ vault: { pathNodes: 4, findings: 2, upgrades: 5 } }, /pathNodes 3→4/],
      [{ vault: { pathNodes: 3, findings: 2, upgrades: 6 } }, /upgrades 5→6/],
    ];
    for (const [change, reason] of cases) {
      const v = terminationVerdict([round(change), round()]);
      expect(v.met).toBe(false);
      expect(v.roundMovedNothing).toBe(false);
      expect(v.reasons.join(' ')).toMatch(reason);
    }
  });
});
