/**
 * The staged storygraph documents, read from disk.
 *
 * They are NOT copied into `src/` — they are real contest data (one of them 8 MB), and a copy in
 * the source tree would rot the moment the originals move.
 *
 * `.contest/` is gitignored (see `.gitignore:139`), so on a checkout without the contest arena
 * these documents are simply absent. The fixture-backed suites then **skip loudly** rather than
 * fail: a missing input is not a broken core, and a red gate everyone learns to ignore is worse
 * than a visible skip. `layout.test.ts` builds its own synthetic trees and always runs.
 */

import fs from 'fs';
import path from 'path';
import type { StoryGraph } from '@/lib/story/types';

/**
 * Where the staged documents live today. It is a parameter, not a constant, so moving the
 * fixtures (committing the two small documents, generating the synthetic one in code) changes the
 * call sites and not these helpers.
 */
export const ARENA_DATA_DIR = path.resolve(process.cwd(), '.contest', 'arena', 'storymap', 'data');

export type FixtureName = 'synthetic-scale' | 'mage-arena-season' | 'pof-exemplars';

const FIXTURE_FILES: FixtureName[] = ['synthetic-scale', 'mage-arena-season', 'pof-exemplars'];

/** True when every staged document is on this machine. */
export const FIXTURES_AVAILABLE = FIXTURE_FILES.every((n) =>
  fs.existsSync(path.join(ARENA_DATA_DIR, `${n}.json`)),
);

if (!FIXTURES_AVAILABLE) {
  console.error(
    `[orrery] staged storygraph documents not found in ${ARENA_DATA_DIR} — the fixture-backed Orrery ` +
      'suites are SKIPPED, not passing. Restore the contest arena to run them.',
  );
}

export function loadGraph(name: FixtureName, dir: string = ARENA_DATA_DIR): StoryGraph {
  return readGraph(path.join(dir, `${name}.json`));
}

/** Read one storygraph document from any path. */
export function readGraph(file: string): StoryGraph {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as StoryGraph;
}

/** The answer key for `synthetic-scale`. Test-only: no code under `src/lib` may read it. */
export interface SeededDefect {
  code: string;
  altitude: string;
  nodes?: string[];
  variables?: string[];
}

export function loadSeededDefects(dir: string = ARENA_DATA_DIR): { total: number; defects: SeededDefect[] } {
  return JSON.parse(fs.readFileSync(path.join(dir, 'seeded-defects.json'), 'utf8')) as {
    total: number;
    defects: SeededDefect[];
  };
}
