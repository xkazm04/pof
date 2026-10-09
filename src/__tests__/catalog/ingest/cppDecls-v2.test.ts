// cpp-decls@2: enum records and out-of-line definition records, read in the same eleven columns as
// the class records. Every fixture is synthetic C++ written for this test — no code, name or value
// from any reference project.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { CPP_DEFINITIONS_SEGMENT, CPP_LIST_SEP, CPP_RECORD_COLUMNS, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { botwClassMap } from '@/lib/catalog/ingest/botw';
import { gap } from '@/lib/catalog/ingest/fieldMap';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { REFERENCE_SOURCES, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const list = (cell: string | undefined) => (cell ? cell.split(CPP_LIST_SEP) : []);
const read = (text: string, file = 'demo/kiln.cpp') => parseCppDecls(text, { file });
const byKey = (text: string, file?: string) => Object.fromEntries(read(text, file).rows.map((r) => [r.qualifiedName, r]));
const cells = (rows: Record<string, string>[]) => rows.flatMap((r) => Object.values(r)).join('\n');

describe('cpp-decls@2 — enum records', () => {
  const ENUMS = `
namespace kiln {
enum class Glaze : unsigned char { Matte = 7, Gloss = 1 << 3, Crackle };
enum Firing { kBisque, kStoneware, };   // trailing comma
enum class Opaque : int;                 // opaque: not a record
enum Later;                              // forward: not a record
enum { kAnonymousLimit = 12 };           // anonymous: not a record
typedef enum Shelf { kTop, kLow } ShelfAlias;
enum class [[nodiscard]] Vent { Open, Shut };

class Oven : public Appliance {
public:
    enum class Stage { Warm = 0x10, Peak, Cool };
    void fire(Stage stage);
private:
    Stage mStage;
    enum Door { Closed, Ajar } mDoor;    // a field typed by an inline enum stays a field
};
}  // namespace kiln
`;

  it('reads every named enum definition with its enumerator NAMES and nothing else', () => {
    const table = read(ENUMS, 'demo/kiln.h');
    expect(table.malformed).toEqual([]);
    expect(table.columns).toEqual([...CPP_RECORD_COLUMNS]);
    const enums = table.rows.filter((r) => r.kind === 'enum');
    expect(enums.map((r) => r.qualifiedName)).toEqual([
      'kiln::Glaze', 'kiln::Firing', 'kiln::Shelf', 'kiln::Vent', 'kiln::Oven::Stage', 'kiln::Oven::Door',
    ]);
    const rows = byKey(ENUMS, 'demo/kiln.h');
    expect(rows['kiln::Glaze']).toEqual({
      file: 'demo/kiln.h', line: '3', kind: 'enum', name: 'Glaze', qualifiedName: 'kiln::Glaze', namespace: 'kiln',
      outer: '', templateParams: '', bases: '', methods: '', fields: 'Matte;Gloss;Crackle',
    });
    expect(list(rows['kiln::Firing'].fields)).toEqual(['kBisque', 'kStoneware']);
    expect(list(rows['kiln::Shelf'].fields)).toEqual(['kTop', 'kLow']);
    expect(list(rows['kiln::Vent'].fields)).toEqual(['Open', 'Shut']);
    expect(rows['kiln::Oven::Stage']).toMatchObject({ kind: 'enum', name: 'Stage', namespace: 'kiln', outer: 'Oven', fields: 'Warm;Peak;Cool' });
  });

  it('never captures an enumerator value or the underlying type', () => {
    // Every column but the position (file, line) is checked: a value could only leak into one of them.
    const enums = read(ENUMS, 'demo/kiln.h').rows.filter((r) => r.kind === 'enum');
    const text = enums.flatMap((r) => Object.entries(r).filter(([column]) => column !== 'file' && column !== 'line').map(([, cell]) => cell)).join('\n');
    for (const value of ['7', '1', '3', '12', '0x10', 'unsigned', 'char', 'int', 'ShelfAlias', 'kAnonymousLimit']) {
      expect(text.split(/[\n;:]/)).not.toContain(value);
    }
    expect(text).not.toMatch(/<<|=/);
  });

  it('records no enum for a forward or opaque declaration, nor for an anonymous enum', () => {
    const rows = byKey(ENUMS, 'demo/kiln.h');
    expect(rows['kiln::Opaque']).toBeUndefined();
    expect(rows['kiln::Later']).toBeUndefined();
    expect(read('enum class Phase : short;\nenum Mode;\nenum { kOnly = 1 };\n').rows).toEqual([]);
  });

  it('leaves the enclosing class record exactly as v1 read it', () => {
    expect(byKey(ENUMS, 'demo/kiln.h')['kiln::Oven']).toEqual({
      file: 'demo/kiln.h', line: '11', kind: 'class', name: 'Oven', qualifiedName: 'kiln::Oven', namespace: 'kiln',
      outer: '', templateParams: '', bases: 'Appliance', methods: 'fire', fields: 'mStage;mDoor',
    });
  });
});

describe('cpp-decls@2 — out-of-line definition records', () => {
  const SOURCE = `
#include "kiln.h"
namespace kiln {
namespace {
const char* kLabel = "Oven::fake(";   // a literal is never read
}

Oven::Oven(int heat) : Appliance(heat), mStage{Stage::Warm}, mDoor(Closed) {}
Oven::~Oven() = default;
void Oven::fire(Stage stage) { if (stage == Stage::Peak) { struct Local { int x; }; } }
void Oven::fire(int ticks, float scale) { (void)ticks; (void)scale; }
bool Oven::operator==(const Oven& other) const { return &other == this; }
bool Oven::operator>=(const Oven& other) const { return true; }
int Oven::operator()(int a) { return a; }
Oven::operator bool() const { return true; }
void Oven::Rack::slide(int slot) {}
template <typename T> void Tray<T>::load(T item) {}
template <typename T> Tray<T>::~Tray() {}
void helper(int unused) {}
}  // namespace kiln

void kiln::Oven::cool() {}
void ::kiln::Oven::Rack::lift() {}
`;

  it('reads one record per owner per file: the owner as written and its function NAMES in order', () => {
    const table = read(SOURCE);
    expect(table.malformed).toEqual([]);
    expect(table.rows.map((r) => [r.kind, r.qualifiedName])).toEqual([
      ['definition', 'kiln::Oven::(definitions)'],
      ['definition', 'kiln::Oven::Rack::(definitions)'],
      ['definition', 'kiln::Tray<T>::(definitions)'],
    ]);
    const rows = byKey(SOURCE);
    expect(rows['kiln::Oven::(definitions)']).toEqual({
      file: 'demo/kiln.cpp', line: '8', kind: 'definition', name: 'Oven', qualifiedName: 'kiln::Oven::(definitions)',
      namespace: 'kiln', outer: '', templateParams: '', bases: '', fields: '',
      // constructor, defaulted destructor, overloads collapsed, operators, then the definition
      // written with its namespace outside the namespace block.
      methods: ['Oven', '~Oven', 'fire', 'operator==', 'operator>=', 'operator()', 'operator bool', 'cool'].join(CPP_LIST_SEP),
    });
    expect(rows['kiln::Oven::Rack::(definitions)']).toMatchObject({ name: 'Oven::Rack', methods: 'slide;lift' });
    expect(rows['kiln::Tray<T>::(definitions)']).toMatchObject({ name: 'Tray<T>', templateParams: 'typename T', methods: 'load;~Tray' });
  });

  it('never reads a body, a parameter list or a literal, and no free function becomes a record', () => {
    const text = cells(read(SOURCE).rows);
    for (const leak of ['heat', 'ticks', 'scale', 'other', 'slot', 'item', 'unused', 'helper', 'Local', 'fake', 'kLabel', 'Peak', 'Closed']) {
      expect(text).not.toContain(leak);
    }
  });

  it('keys a definition record apart from the class record of the same owner in the same file', () => {
    const SAME_FILE = `
namespace kiln {
class Bellows { void pump(); };
void Bellows::pump() {}
}`;
    const rows = read(SAME_FILE).rows;
    expect(rows.map((r) => [r.kind, r.qualifiedName])).toEqual([
      ['class', 'kiln::Bellows'],
      ['definition', `kiln::Bellows::${CPP_DEFINITIONS_SEGMENT}`],
    ]);
    expect(new Set(rows.map((r) => r.qualifiedName)).size).toBe(rows.length);
  });

  it('reads definitions inside a header too, and nothing inside a class body', () => {
    const HEADER = `
namespace kiln {
template <typename T> struct Crate { void open(); void close() {} };
template <typename T> inline void Crate<T>::open() {}
}`;
    expect(read(HEADER, 'demo/crate.h').rows.map((r) => [r.kind, r.qualifiedName, r.methods])).toEqual([
      ['struct', 'kiln::Crate', 'open;close'],
      ['definition', 'kiln::Crate<T>::(definitions)', 'open'],
    ]);
  });
});

describe('cpp-decls@2 through the wrapper store', () => {
  const FILES: Record<string, string> = {
    'src/Kiln/oven.h': 'namespace kiln { class Oven { public: enum class Stage { Warm, Peak }; void fire(); }; }',
    'src/Kiln/oven.cpp': 'namespace kiln { Oven::Oven() {} void Oven::fire() {} }',
    'src/Kiln/inline.h': 'namespace kiln { struct Pot { void spin(); }; inline void Pot::spin() {} }',
    'src/Kiln/notes.cpp': '#include "oven.h"\n',
  };
  const MAP = botwClassMap({ bases: gap('fixture'), methods: gap('fixture'), fields: gap('fixture') });
  const SOURCE_SPEC: ReferenceSource = {
    id: 'cppv2-fixture', game: 'Fixture', project: 'synthetic', licenceNote: 'synthetic test fixture',
    idPrefix: 'cv2', obtain: 'n/a', canonProfile: 'pof',
    tables: [{ file: 'src/Kiln/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: MAP }],
  };
  let db: Database.Database;
  let files: Record<string, string>;
  const deps = () => ({
    db,
    readFile: (p: string) => files[p.replace(/\\/g, '/').replace(/^root\//, '')],
    listFiles: () => Object.keys(files),
    now: '2026-10-09T00:00:00.000Z',
  });
  beforeAll(() => { REFERENCE_SOURCES[SOURCE_SPEC.id] = SOURCE_SPEC; });
  afterAll(() => { delete REFERENCE_SOURCES[SOURCE_SPEC.id]; });
  beforeEach(() => { db = new Database(':memory:'); files = { ...FILES }; });

  it('wraps class, enum and definition records with 0 duplicate ids, and a second ingest is idempotent', () => {
    const first = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(first.tables[0]).toMatchObject({
      status: 'ingested', rows: 5, duplicateKeys: 0, unclassified: [], malformed: 0,
      files: { matched: 4, withoutRecords: 1, refused: [] },
    });
    expect(first.store).toEqual({ created: 5, rawChanged: 0, reprojected: 0, unchanged: 0 });
    const wrappers = listWrappers(db, { sourceId: SOURCE_SPEC.id });
    expect(wrappers.map((w) => [w.wrapperId, w.technique, w.raw.kind])).toEqual([
      ['cppv2-fixture:src/Kiln/inline.h:kiln::Pot', 'cpp-decls@2', 'struct'],
      ['cppv2-fixture:src/Kiln/inline.h:kiln::Pot::(definitions)', 'cpp-decls@2', 'definition'],
      ['cppv2-fixture:src/Kiln/oven.cpp:kiln::Oven::(definitions)', 'cpp-decls@2', 'definition'],
      ['cppv2-fixture:src/Kiln/oven.h:kiln::Oven', 'cpp-decls@2', 'class'],
      ['cppv2-fixture:src/Kiln/oven.h:kiln::Oven::Stage', 'cpp-decls@2', 'enum'],
    ]);
    expect(wrappers.map((w) => w.entity.id)).toEqual([
      'cv2-kiln::Pot', 'cv2-kiln::Pot::(definitions)', 'cv2-kiln::Oven::(definitions)', 'cv2-kiln::Oven', 'cv2-kiln::Oven::Stage',
    ]);
    expect(wrappers.find((w) => w.entity.id === 'cv2-kiln::Oven::Stage')!.entity.data).toMatchObject({ declKind: 'enum', outer: 'Oven' });
    expect(wrappers.find((w) => w.entity.id === 'cv2-kiln::Oven::(definitions)')!.raw.methods).toBe('Oven;fire');

    const second = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 5 });
  });

  it('can still fail: the same owner defined in two files of one namespace is a reported duplicate id', () => {
    files['src/Kiln/oven2.cpp'] = 'namespace kiln { void Oven::rest() {} }';
    const run = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(run.tables[0].duplicateKeys).toBe(1);
  });
});
