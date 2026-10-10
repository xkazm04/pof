// The W08 descope review put path globs into folders that ALSO hold files the loop keeps open (data
// schemas, a map-kind table, a drop contract), so the descopes must stay narrow: none may reach a
// folder a spec reads, the sound-manager descope must stay at the top of its folder, no folder-level
// descope may reach a look-alike sibling folder, and a kept-open file beside descoped ones stays
// open. Every path below is synthetic: file names are coined here, or derived at run time from the
// descope patterns themselves (never written out).
import { describe, expect, it } from 'vitest';
import { BOTW_DESCOPES } from '@/lib/catalog/ingest/botw';
import { BOTW } from '@/lib/catalog/reference/sources';
import { computePathCoverage, matchesGlob } from '@/lib/catalog/reference/pathCoverage';

/** Every path a brace pattern names (`a{b,c}.{h,cpp}` gives four); wildcards are left in place. */
function expandBraces(pattern: string): string[] {
  const m = /\{([^}]*)\}/.exec(pattern);
  if (!m) return [pattern];
  const head = pattern.slice(0, m.index);
  const tail = pattern.slice(m.index + m[0].length);
  return m[1].split(',').flatMap((alt) => expandBraces(head + alt + tail));
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirname = (path: string) => path.slice(0, path.lastIndexOf('/'));
const descoped = (path: string) => BOTW_DESCOPES.some((d) => matchesGlob(path, d.pattern));
const SPEC_GLOBS = BOTW.tables.map((t) => t.file);

/** Concrete files a spec glob reads: each stem directly in its folder and one level down. */
function specSamples(glob: string, stems: readonly string[]): string[] {
  return expandBraces(glob).flatMap((p) => stems.flatMap((stem) => [
    p.replace('**/', '').replace('*', stem),
    p.replace('**/', 'coinedDeep/').replace('*', stem),
  ]));
}

/**
 * The W08 entries: every descope that names concrete code files (no earlier entry does), plus the
 * review's one folder-level glob, which sits in the core system folder.
 */
const W08 = BOTW_DESCOPES.filter((d) =>
  /\.(h|cpp|\{h,cpp\})$/.test(d.pattern) || d.pattern.startsWith('src/KingSystem/System/'));

/** One concrete path per W08 entry: its first named file, or a coined file under a folder glob. */
const derivedPath = (pattern: string) => expandBraces(pattern)[0].replace(/\*\*$/, 'coinedLayout.h');

describe('W08 descopes stay narrow', () => {
  it('has the review entries this suite reasons about', () => {
    // 20 entries: 10 in the core system folder, 4 physics, 1 sound, 1 heap helper, 2 + 2 top-level.
    expect(W08).toHaveLength(20);
    expect(W08.filter((d) => d.pattern.endsWith('/**')).map((d) => d.pattern)).toEqual(['src/KingSystem/System/UI/**']);
  });

  it('no descope pattern matches a path that any BOTW spec glob reads', () => {
    // The file stems the descopes name, planted inside every spec folder, plus a coined stem.
    const named = BOTW_DESCOPES.flatMap((d) => expandBraces(d.pattern)).map(basename)
      .filter((b) => /\.(h|cpp)$/.test(b) && !/[*?]/.test(b)).map((b) => b.replace(/\.(h|cpp)$/, ''));
    const stems = ['coinedSpecFile', ...new Set(named)];
    expect(stems).toHaveLength(1 + 64); // 64 distinct stems across the W08 entries (the older entries name none)
    for (const glob of SPEC_GLOBS) {
      for (const path of specSamples(glob, stems)) {
        expect(matchesGlob(path, glob)).toBe(true); // the sample really is a file the spec reads
        expect(descoped(path)).toBe(false);
      }
    }
  });

  it('the sound-manager descope never reaches the per-actor sound folder', () => {
    const sound = BOTW_DESCOPES.filter((d) => d.pattern.startsWith('src/KingSystem/Sound/'));
    expect(sound).toHaveLength(1);
    for (const path of expandBraces(sound[0].pattern)) {
      expect(descoped(path)).toBe(true); // the top-level manager file itself is descoped
      const name = basename(path);
      expect(descoped(`src/KingSystem/Sound/Actor/${name}`)).toBe(false);
      expect(descoped(`src/KingSystem/Sound/Actor/coinedDeep/${name}`)).toBe(false);
    }
    const cov = computePathCoverage(
      ['src/KingSystem/Sound/Actor/coinedVoiceNode.h', 'src/KingSystem/Sound/Actor/coinedVoiceNode.cpp', derivedPath(sound[0].pattern)],
      SPEC_GLOBS, BOTW_DESCOPES,
    );
    expect(cov).toMatchObject({ total: 3, covered: 0, descoped: 1, open: 2 });
  });

  it('no descope reaches a look-alike sibling folder whose name starts with the same folder name', () => {
    for (const d of BOTW_DESCOPES) {
      if (d.pattern.startsWith('src/**/')) continue; // tree-wide by design (build files, placeholders)
      const folderLevel = d.pattern.endsWith('/**');
      const folder = folderLevel ? d.pattern.slice(0, -3) : dirname(expandBraces(d.pattern)[0]);
      const names = folderLevel || d.pattern.endsWith('/*') ? ['coinedTwinFile.h'] : expandBraces(d.pattern).map(basename);
      for (const name of names) {
        expect(matchesGlob(`${folder}/${name}`, d.pattern)).toBe(true); // the instrument can fail
        expect(matchesGlob(`${folder}Twin/${name}`, d.pattern)).toBe(false);
        expect(matchesGlob(`${folder}2/${name}`, d.pattern)).toBe(false);
      }
    }
  });

  it('a kept-open file in a folder with descoped files stays open', () => {
    const folders = ['src/KingSystem/System', 'src/KingSystem/Physics/System', 'src/KingSystem/Sound', 'src/KingSystem', 'src/Game'];
    const kept = folders.flatMap((f) => [`${f}/coinedKeptSchema.h`, `${f}/coinedKeptSchema.cpp`]);
    const gone = W08.map((d) => derivedPath(d.pattern));
    const cov = computePathCoverage([...kept, ...gone], SPEC_GLOBS, BOTW_DESCOPES);
    expect(cov).toMatchObject({ total: 30, covered: 0, descoped: 20, open: 10 });
    expect(cov.openFiles).toEqual([...kept].sort());
    // A kept-open name that only EXTENDS a descoped one (a schema beside its engine binding) stays open.
    for (const path of W08.flatMap((d) => expandBraces(d.pattern))) {
      if (!/\.(h|cpp)$/.test(path)) continue;
      expect(descoped(path)).toBe(true);
      expect(descoped(path.replace(/\.(h|cpp)$/, 'Data.$1'))).toBe(false);
    }
  });
});
