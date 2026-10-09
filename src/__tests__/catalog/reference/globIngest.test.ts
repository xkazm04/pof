// A GLOB spec reads every matching file of a code tree with one technique and one map. The
// store's promise holds per file: a re-run that changed nothing reports `unchanged` for every
// record, and a mapping change shows up as `reprojected` and nothing else. Fixtures are
// synthetic C++ written for this test.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { DIABLO1, REFERENCE_SOURCES, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { isGlobPattern } from '@/lib/catalog/reference/pathCoverage';
import { listRuns, listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { botwClassMap } from '@/lib/catalog/ingest/botw';
import { gap, mapped } from '@/lib/catalog/ingest/fieldMap';
import { split } from '@/lib/catalog/ingest/decode';

const FILES: Record<string, string> = {
  'src/Hero/hero.h': `
namespace demo::hero {
class Hero : public Pawn {
public:
    void dash(float distance);
    void climb();
private:
    float mStamina = 0;
};
}
`,
  'src/Hero/hero.cpp': `
#include "hero.h"
namespace demo::hero {
void Hero::dash(float distance) { mStamina -= distance; }
void Hero::climb() {}
}
`,
  'src/Hero/Moves/glide.h': `
namespace demo::hero {
struct Glide : GaitBase { int mLift; struct Wind { float speed; }; };
class Hero {};   // the same name defined again in another file
}
`,
  'src/Hero/notes.txt': 'not code',
  'src/World/sky.h': 'class Sky {};',
};

const CLASS_MAP = botwClassMap({
  bases: gap('fixture: no taxonomy'),
  methods: gap('fixture: no behaviour list'),
  fields: gap('fixture: no state'),
});

const SOURCE: ReferenceSource = {
  id: 'glob-fixture', game: 'Fixture', project: 'synthetic', licenceNote: 'synthetic test fixture',
  idPrefix: 'gx', obtain: 'n/a', canonProfile: 'pof',
  tables: [
    { file: 'src/Hero/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: CLASS_MAP },
    { file: 'src/Nowhere/**/*.h', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: CLASS_MAP },
  ],
};

const posix = (p: string) => p.replace(/\\/g, '/').replace(/^root\//, '');
const deps = (db: Database.Database, extra: Record<string, unknown> = {}) => ({
  db,
  readFile: (p: string) => {
    const text = FILES[posix(p)];
    if (text === undefined) throw new Error(`no fixture ${p}`);
    return text;
  },
  listFiles: () => Object.keys(FILES),
  now: '2026-10-09T00:00:00.000Z',
  ...extra,
});

let db: Database.Database;
beforeAll(() => { REFERENCE_SOURCES[SOURCE.id] = SOURCE; });
afterAll(() => { delete REFERENCE_SOURCES[SOURCE.id]; });
beforeEach(() => { db = new Database(':memory:'); });

describe('glob spec ingest', () => {
  it('wraps every matching file, keeps each record on its own path, and summarises the spec once', () => {
    const run = ingestSourceFromDir(SOURCE.id, 'root', deps(db));
    const [hero, nowhere] = run.tables;
    // cpp-decls@2: hero.cpp's out-of-line definitions are a fifth record, so no file is record-less.
    expect(hero).toMatchObject({
      file: 'src/Hero/**/*.{h,cpp}', status: 'ingested', rows: 5,
      unclassified: [], declaredButAbsent: [], malformed: 0, mapped: 5, gaps: 3,
      files: { matched: 3, withoutRecords: 0, refused: [] },
    });
    expect(hero.coverage).toBeCloseTo(5 / 11);
    // `demo::hero::Hero` is defined in two files: two wrappers, one reported duplicate id — and the
    // definition record of the same owner adds none.
    expect(hero.duplicateKeys).toBe(1);
    // A glob that matches nothing is a finding, never an empty success.
    expect(nowhere).toMatchObject({ status: 'missing', rows: 0, files: { matched: 0, withoutRecords: 0, refused: [] } });

    const wrappers = listWrappers(db, { sourceId: SOURCE.id });
    expect(wrappers.map((w) => w.wrapperId)).toEqual([
      'glob-fixture:src/Hero/Moves/glide.h:demo::hero::Glide',
      'glob-fixture:src/Hero/Moves/glide.h:demo::hero::Glide::Wind',
      'glob-fixture:src/Hero/Moves/glide.h:demo::hero::Hero',
      'glob-fixture:src/Hero/hero.cpp:demo::hero::Hero::(definitions)',
      'glob-fixture:src/Hero/hero.h:demo::hero::Hero',
    ]);
    const heroWrapper = wrappers.find((w) => w.file === 'src/Hero/hero.h')!;
    expect(heroWrapper.technique).toBe('cpp-decls@2');
    expect(heroWrapper.raw).toMatchObject({ file: 'src/Hero/hero.h', bases: 'Pawn', methods: 'dash;climb', fields: 'mStamina' });
    expect(heroWrapper.entity).toMatchObject({
      id: 'gx-demo::hero::Hero', name: 'Hero', catalogId: 'player-movement',
      data: { declKind: 'class', qualifiedName: 'demo::hero::Hero', namespace: 'demo::hero' },
      provenance: { sourceFile: 'src/Hero/hero.h', sourceRow: 'qualifiedName=demo::hero::Hero', licenceNote: 'synthetic test fixture' },
    });
    expect(run.store).toEqual({ created: 5, rawChanged: 0, reprojected: 0, unchanged: 0 });
  });

  it('is idempotent: a second ingest of the same tree reports everything unchanged', () => {
    ingestSourceFromDir(SOURCE.id, 'root', deps(db));
    const second = ingestSourceFromDir(SOURCE.id, 'root', deps(db, { now: '2026-10-10T00:00:00.000Z' }));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 5 });
  });

  it('a mapping change re-projects exactly the records whose projection moved, and nothing else', () => {
    ingestSourceFromDir(SOURCE.id, 'root', deps(db));
    const spec = SOURCE.tables[0];
    const original = spec.map;
    spec.map = { ...CLASS_MAP, methods: mapped('data.methods[]', split(';')) };
    try {
      const run = ingestSourceFromDir(SOURCE.id, 'root', deps(db));
      // Only Hero's class record and its definition record carry methods; the other three project
      // identically under the new map.
      expect(run.store).toEqual({ created: 0, rawChanged: 0, reprojected: 2, unchanged: 3 });
      const hero = listWrappers(db, { sourceId: SOURCE.id }).find((w) => w.file === 'src/Hero/hero.h')!;
      expect(hero.entity.data.methods).toEqual(['dash', 'climb']);
      const defs = listWrappers(db, { sourceId: SOURCE.id }).find((w) => w.file === 'src/Hero/hero.cpp')!;
      expect(defs.entity.data.methods).toEqual(['dash', 'climb']);
    } finally {
      spec.map = original;
    }
  });

  it('stores a loop’s extra measurements with the run', () => {
    ingestSourceFromDir(SOURCE.id, 'root', deps(db, { runExtras: { pathCoverage: { total: 5, covered: 3, descoped: 0, open: 2 } } }));
    const [latest] = listRuns(db, SOURCE.id, 1);
    expect((latest.summary as { pathCoverage: unknown }).pathCoverage).toEqual({ total: 5, covered: 3, descoped: 0, open: 2 });
  });

  it('never routes a Diablo table through the glob path', () => {
    expect(DIABLO1.tables.filter((t) => isGlobPattern(t.file))).toEqual([]);
  });
});
