// cpp-decls@3: a definition record's key names its defining file (vault Decision Z-D22), and an
// enumeration written as one upper-case macro call is an enum record, recognised by its argument
// shape (Z-D23). Every fixture is synthetic C++ written for this test — no code, name or value from
// any reference project; the macro names are coined here.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { CPP_DEFINITIONS_SEGMENT, cppDefinitionsSegment, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { botwClassMap } from '@/lib/catalog/ingest/botw';
import { gap } from '@/lib/catalog/ingest/fieldMap';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { REFERENCE_SOURCES, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const read = (text: string, file: string) => parseCppDecls(text, { file });
const keys = (text: string, file: string) => read(text, file).rows.map((r) => [r.kind, r.qualifiedName]);

const PUMICER_H = `
namespace tessel {
class Pumicer {
public:
    int nibbleDepth() const;
    void whetEdge();
    void scourFace();
};
inline int Pumicer::nibbleDepth() const { return 1; }
}`;
const PUMICER_CPP = 'namespace tessel { void Pumicer::whetEdge() {} }';
const PUMICER_SCOUR_CPP = 'namespace tessel { void Pumicer::scourFace() {} }';

describe('cpp-decls@3 — a definition record is keyed by its defining file', () => {
  it('a header and a source that both define one owner out of line yield two distinct keys', () => {
    const header = read(PUMICER_H, 'src/Tessel/pumicer.h').rows.filter((r) => r.kind === 'definition');
    const source = read(PUMICER_CPP, 'src/Tessel/pumicer.cpp').rows;
    expect(header.map((r) => [r.qualifiedName, r.methods])).toEqual([['tessel::Pumicer::(definitions@src/Tessel/pumicer.h)', 'nibbleDepth']]);
    expect(source.map((r) => [r.qualifiedName, r.methods])).toEqual([['tessel::Pumicer::(definitions@src/Tessel/pumicer.cpp)', 'whetEdge']]);
    expect(header[0].qualifiedName).not.toBe(source[0].qualifiedName);
  });

  it('two sources that define one owner out of line yield two distinct keys too', () => {
    expect(keys(PUMICER_CPP, 'src/Tessel/pumicer.cpp')).toEqual([['definition', 'tessel::Pumicer::(definitions@src/Tessel/pumicer.cpp)']]);
    expect(keys(PUMICER_SCOUR_CPP, 'src/Tessel/pumicerScour.cpp')).toEqual([['definition', 'tessel::Pumicer::(definitions@src/Tessel/pumicerScour.cpp)']]);
  });

  it('mints the key from the record\'s own file only, and keeps the file-less segment when no file is given', () => {
    expect(cppDefinitionsSegment('a/b.cpp')).toBe('(definitions@a/b.cpp)');
    expect(cppDefinitionsSegment('')).toBe(CPP_DEFINITIONS_SEGMENT);
    expect(parseCppDecls(PUMICER_CPP).rows.map((r) => r.qualifiedName)).toEqual([`tessel::Pumicer::${CPP_DEFINITIONS_SEGMENT}`]);
    // The class record keeps its key; only the definition record carries the file.
    expect(keys(PUMICER_H, 'src/Tessel/pumicer.h')).toEqual([
      ['class', 'tessel::Pumicer'],
      ['definition', 'tessel::Pumicer::(definitions@src/Tessel/pumicer.h)'],
    ]);
  });
});

// Every macro below has bare-identifier arguments; only the first is an enumeration by shape.
const GRAIN_H = `
namespace tessel {
GRAINAGE_LIST(Grainage, Grainsome, Grainmid, Grainfew)
TESSEL_STAMP(Pumicer)
TALLY_PAIRING(readGrainage, Grainweight)
GRAINAGE_LIST(Lustreness, Lustredull = 0, Lustrebright = 1)
GRAINAGE_LIST(Spanwidth, int, Spanbreadth)
GRAINAGE_LIST(Lonegrain)
GRAINAGE_LIST(Burrstone, Burrlow,
               Burrhigh)
class Gravelwright {
    HEFT_KINDING(Gravelwright, Rubbleman)
public:
    GRAINAGE_LIST(Swingage, Swingshort, Swinglong)
    int strikeRubble();
    float mHeftage;
};
}`;
// The same text with every macro call blanked line for line: what the class walk reads either way.
const GRAIN_H_NO_MACROS = GRAIN_H.replace(/^[ \t]*[A-Z_]+\([^)\n]*\)?$/gm, '').replace(/^[ \t]+Burrhigh\)$/m, '');

const GRAVELWRIGHT = {
  file: 'src/Tessel/grain.h', line: '11', kind: 'class', name: 'Gravelwright', qualifiedName: 'tessel::Gravelwright',
  namespace: 'tessel', outer: '', templateParams: '', bases: '', methods: 'strikeRubble', fields: 'mHeftage',
};

describe('cpp-decls@3 — an enumeration written as one macro call', () => {
  it('yields one enum record per enumeration-shaped call, enumerator NAMES in fields, and nothing for any other identifier-only call', () => {
    const table = read(GRAIN_H, 'src/Tessel/grain.h');
    expect(table.malformed).toEqual([]);
    expect(table.rows.map((r) => [r.kind, r.qualifiedName, r.fields])).toEqual([
      ['enum', 'tessel::Grainage', 'Grainsome;Grainmid;Grainfew'],
      // since v4 a valued call whose values are one unsigned literal each is read by name (it was no record under v3)
      ['enum', 'tessel::Lustreness', 'Lustredull;Lustrebright'],
      // a call spread over two lines is still one call
      ['enum', 'tessel::Burrstone', 'Burrlow;Burrhigh'],
      ['class', 'tessel::Gravelwright', 'mHeftage'],
      ['enum', 'tessel::Gravelwright::Swingage', 'Swingshort;Swinglong'],
    ]);
    expect(table.rows[0]).toEqual({
      file: 'src/Tessel/grain.h', line: '3', kind: 'enum', name: 'Grainage', qualifiedName: 'tessel::Grainage',
      namespace: 'tessel', outer: '', templateParams: '', bases: '', methods: '', fields: 'Grainsome;Grainmid;Grainfew',
    });
    expect(table.rows[4]).toMatchObject({ outer: 'Gravelwright', line: '14' });
  });

  it('negative control: a class that contains such a macro or sits beside one keeps a byte-identical class record', () => {
    const withMacros = read(GRAIN_H, 'src/Tessel/grain.h').rows;
    const withoutMacros = read(GRAIN_H_NO_MACROS, 'src/Tessel/grain.h').rows;
    expect(withoutMacros).toEqual([GRAVELWRIGHT]);
    expect(withMacros.filter((r) => r.kind === 'class')).toEqual([GRAVELWRIGHT]);
    // Any loosening of the shape rule (one argument, a lower-case first argument, a keyword argument,
    // or the enclosing class's own name first) adds a record here; the valued call is read since v4.
    expect(withMacros).toHaveLength(5);
  });

  it('reads a line-spliced call (a trailing backslash is whitespace)', () => {
    const SPLICED = 'namespace tessel {\nGRAINAGE_LIST(Quernage,\\\nQuernfine,\\\nQuernrough)\n}';
    expect(read(SPLICED, 'src/Tessel/quern.h').rows.map((r) => [r.kind, r.name, r.fields])).toEqual([['enum', 'Quernage', 'Quernfine;Quernrough']]);
  });
});

describe('cpp-decls@3 through the wrapper store', () => {
  const FILES: Record<string, string> = {
    'src/Tessel/pumicer.h': PUMICER_H,
    'src/Tessel/pumicer.cpp': PUMICER_CPP,
    'src/Tessel/pumicerScour.cpp': PUMICER_SCOUR_CPP,
    'src/Tessel/grain.h': GRAIN_H,
  };
  const MAP = botwClassMap({ bases: gap('fixture'), methods: gap('fixture'), fields: gap('fixture') });
  const SOURCE_SPEC: ReferenceSource = {
    id: 'cppv3-fixture', game: 'Fixture', project: 'synthetic', licenceNote: 'synthetic test fixture',
    idPrefix: 'cv3', obtain: 'n/a', canonProfile: 'pof',
    tables: [{ file: 'src/Tessel/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: MAP }],
  };
  let db: Database.Database;
  const deps = () => ({
    db,
    readFile: (p: string) => FILES[p.replace(/\\/g, '/').replace(/^root\//, '')],
    listFiles: () => Object.keys(FILES),
    now: '2026-10-10T00:00:00.000Z',
  });
  beforeAll(() => { REFERENCE_SOURCES[SOURCE_SPEC.id] = SOURCE_SPEC; });
  afterAll(() => { delete REFERENCE_SOURCES[SOURCE_SPEC.id]; });
  beforeEach(() => { db = new Database(':memory:'); });

  it('holds one owner\'s three definition records under three entity ids, and a second ingest is idempotent', () => {
    const first = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(first.tables[0]).toMatchObject({ status: 'ingested', rows: 9, duplicateKeys: 0, unclassified: [], malformed: 0 });
    expect(first.store).toEqual({ created: 9, rawChanged: 0, reprojected: 0, unchanged: 0 });
    const wrappers = listWrappers(db, { sourceId: SOURCE_SPEC.id });
    expect(wrappers.filter((w) => w.raw.kind === 'definition').map((w) => w.entity.id)).toEqual([
      'cv3-tessel::Pumicer::(definitions@src/Tessel/pumicer.cpp)',
      'cv3-tessel::Pumicer::(definitions@src/Tessel/pumicer.h)',
      'cv3-tessel::Pumicer::(definitions@src/Tessel/pumicerScour.cpp)',
    ]);
    expect(new Set(wrappers.map((w) => w.entity.id)).size).toBe(wrappers.length);
    expect(wrappers.every((w) => w.technique === 'cpp-decls@4')).toBe(true);

    const second = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 9 });
  });
});
