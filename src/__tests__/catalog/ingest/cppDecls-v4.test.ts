// cpp-decls@4 (vault Decision Z-D123 (c), Findings F13): an enumeration written as one upper-case macro call is read
// by its argument shape, and since v4 an enumerator may be a bare name or a name, `=` and ONE unsigned integer
// literal token. The name is kept; the value is never read or stored. Every fixture is synthetic C++ written for this
// test: the macro, the namespace, the classes and the enumerators are coined here and were checked whole-word against
// the reference clone before the first run (0 hits).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import { botwClassMap } from '@/lib/catalog/ingest/botw';
import { gap } from '@/lib/catalog/ingest/fieldMap';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { REFERENCE_SOURCES, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { getTechnique, techniqueLabel } from '@/lib/catalog/reference/techniques';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const read = (text: string, file: string) => parseCppDecls(text, { file });
const summary = (text: string, file: string) => read(text, file).rows.map((r) => [r.kind, r.qualifiedName, r.fields]);
const FILE = 'src/Quillon/plumbage.h';

// All valued, mixed, line-spliced and class-nested calls, plus a class beside them.
const PLUMBAGE_H = `
namespace quillon {
PLUMBAGE_ENUM(Pumbago, Alderan = 0, Birchen = 1, Cedarwyn = 2)
PLUMBAGE_ENUM(Verdelet, Dogwoode, Elmbury = 0x4F2C9A1E, Fernhold)
PLUMBAGE_ENUM(Oakmoss, Gorsey = 3,\\
               Hazelet = 4)
class Tamarisk {
public:
    PLUMBAGE_ENUM(Mapleshaw, Nettlegrove = 7, Osierby = 8)
    int bloom();
    float mDrift;
};
}`;
// The same text with every value cut away: the lines (and so every record's line number) do not move.
const PLUMBAGE_BARE = PLUMBAGE_H.replace(/ = (?:0x[0-9A-Fa-f]+|[0-9]+)/g, '');

describe('cpp-decls@4 - a macro enumeration with unsigned-literal values is read by name', () => {
  it('is registered as version 4, and says what it adds in its describe string', () => {
    const technique = getTechnique('cpp-decls');
    expect(techniqueLabel(technique)).toBe('cpp-decls@4');
    expect(technique.describe).toContain('v4');
  });

  it('yields one enum record per all-valued, mixed, spliced and class-nested call, with the NAMES in fields', () => {
    const table = read(PLUMBAGE_H, FILE);
    expect(table.malformed).toEqual([]);
    expect(table.rows.map((r) => [r.kind, r.qualifiedName, r.fields])).toEqual([
      ['enum', 'quillon::Pumbago', 'Alderan;Birchen;Cedarwyn'],
      ['enum', 'quillon::Verdelet', 'Dogwoode;Elmbury;Fernhold'],
      ['enum', 'quillon::Oakmoss', 'Gorsey;Hazelet'],
      ['class', 'quillon::Tamarisk', 'mDrift'],
      ['enum', 'quillon::Tamarisk::Mapleshaw', 'Nettlegrove;Osierby'],
    ]);
    expect(table.rows[0]).toEqual({
      file: FILE, line: '3', kind: 'enum', name: 'Pumbago', qualifiedName: 'quillon::Pumbago',
      namespace: 'quillon', outer: '', templateParams: '', bases: '', methods: '', fields: 'Alderan;Birchen;Cedarwyn',
    });
    expect(table.rows[4]).toMatchObject({ outer: 'Tamarisk', line: '9' });
  });

  it('never carries a value anywhere in a record, and reads exactly what the same text without its values reads', () => {
    const valued = read(PLUMBAGE_H, FILE).rows;
    for (const row of valued) expect(JSON.stringify(row)).not.toMatch(/=|4F2C9A1E|Alderan[^;"]*\d/);
    expect(valued).toEqual(read(PLUMBAGE_BARE, FILE).rows);
    expect(PLUMBAGE_BARE).not.toContain('=');
  });
});

// Each form below is still NOT an enumeration: the call adds no record (the class beside it keeps its record).
const UNREAD: Record<string, string> = {
  'a signed value': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = -1, Wrenhigh)',
  'a shift': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 1 << 2, Wrenhigh)',
  'a sum': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 1 + 2, Wrenhigh)',
  'a parenthesised value': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = (1), Wrenhigh)',
  'an identifier value': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = Wrenhigh, Larkspur)',
  'a suffixed literal': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 1u, Wrenhigh)',
  'a suffixed hex literal': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 0x10ULL, Wrenhigh)',
  'a binary literal': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 0b101, Wrenhigh)',
  'a fractional literal': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 1.5, Wrenhigh)',
  'two literal tokens': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = 1 2, Wrenhigh)',
  'a valued first argument': 'PLUMBAGE_ENUM(Quillfeather = 1, Wrenlow, Wrenhigh)',
  'a lower-case first argument that is valued': 'PLUMBAGE_ENUM(quillfeather, Wrenlow = 1, Wrenhigh)',
  'a keyword as the valued name': 'PLUMBAGE_ENUM(Quillfeather, int = 1, Wrenhigh)',
  'a string value': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = "a", Wrenhigh)',
  'a one-argument macro': 'PLUMBAGE_ENUM(Quillfeather)',
  'a call as the value': 'PLUMBAGE_ENUM(Quillfeather, Wrenlow = tally(1), Wrenhigh)',
};

describe('cpp-decls@4 - every other form stays unread', () => {
  for (const [what, call] of Object.entries(UNREAD)) {
    it(`${what} adds no record`, () => {
      const text = `namespace quillon {\n${call}\nclass Wickerdown {\npublic:\n    int bloom();\n};\n}`;
      expect(summary(text, FILE)).toEqual([['class', 'quillon::Wickerdown', '']]);
    });
  }

  it('the enclosing class\'s own name as a valued first argument is no enumeration either', () => {
    const text = 'namespace quillon {\nclass Wickerdown {\n    PLUMBAGE_ENUM(Wickerdown, Wrenlow = 1, Wrenhigh)\npublic:\n    int bloom();\n};\n}';
    expect(summary(text, FILE)).toEqual([['class', 'quillon::Wickerdown', '']]);
  });

  it('a hex value is one token and so is read (a lone 0x is not)', () => {
    expect(summary('PLUMBAGE_ENUM(Quillfeather, Wrenlow = 0x4F2C9A1E, Wrenhigh)', FILE)).toEqual([['enum', 'Quillfeather', 'Wrenlow;Wrenhigh']]);
    expect(summary('PLUMBAGE_ENUM(Quillfeather, Wrenlow = 0x, Wrenhigh)', FILE)).toEqual([]);
  });
});

describe('cpp-decls@4 - the v3 shapes read as before', () => {
  const V3_H = `
namespace quillon {
PLUMBAGE_ENUM(Foxglove, Vetchling, Thistledown)
PLUMBAGE_ENUM(Hollowmere,
              Tessera,
              Larkspur)
class Wickerdown {
public:
    int bloom();
};
}`;
  it('reads bare, multi-line and class records exactly, and the values-free text equals the bare text', () => {
    expect(summary(V3_H, FILE)).toEqual([
      ['enum', 'quillon::Foxglove', 'Vetchling;Thistledown'],
      ['enum', 'quillon::Hollowmere', 'Tessera;Larkspur'],
      ['class', 'quillon::Wickerdown', ''],
    ]);
    expect(read(V3_H, FILE).rows[0]).toEqual({
      file: FILE, line: '3', kind: 'enum', name: 'Foxglove', qualifiedName: 'quillon::Foxglove',
      namespace: 'quillon', outer: '', templateParams: '', bases: '', methods: '', fields: 'Vetchling;Thistledown',
    });
  });
});

describe('cpp-handles is untouched by a valued enumeration', () => {
  const WITH = `namespace quillon {
class Tamarisk {
public:
    PLUMBAGE_ENUM(Mapleshaw, Nettlegrove = 7, Osierby = 8)
    // larkspur_gauge at offset 0x4F2C9A1E
    float* mDrift{};
};
}`;
  const WITHOUT = WITH.replace('    PLUMBAGE_ENUM(Mapleshaw, Nettlegrove = 7, Osierby = 8)', '');
  it('gives records byte-identical to the same text without the call (the call sits on a line of its own)', () => {
    const a = parseCppHandles(WITH, { file: FILE }).rows;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'handle', name: 'mDrift', owner: 'Tamarisk', marker: 'larkspur_gauge' });
    const b = parseCppHandles(WITHOUT, { file: FILE }).rows;
    expect(a.map((r) => ({ ...r, line: '' }))).toEqual(b.map((r) => ({ ...r, line: '' })));
    expect(parseCppHandles(WITH, { file: FILE }).columns).toEqual(parseCppHandles(WITHOUT, { file: FILE }).columns);
  });
});

describe('cpp-decls@4 through the wrapper store', () => {
  const FILES: Record<string, string> = { [FILE]: PLUMBAGE_H };
  const MAP = botwClassMap({ bases: gap('fixture'), methods: gap('fixture'), fields: gap('fixture') });
  const SOURCE_SPEC: ReferenceSource = {
    id: 'cppv4-fixture', game: 'Fixture', project: 'synthetic', licenceNote: 'synthetic test fixture',
    idPrefix: 'cv4', obtain: 'n/a', canonProfile: 'pof',
    tables: [{ file: 'src/Quillon/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: MAP }],
  };
  let db: Database.Database;
  const deps = () => ({
    db,
    readFile: (p: string) => FILES[p.replace(/\\/g, '/').replace(/^root\//, '')],
    listFiles: () => Object.keys(FILES),
    now: '2026-10-12T00:00:00.000Z',
  });
  beforeAll(() => { REFERENCE_SOURCES[SOURCE_SPEC.id] = SOURCE_SPEC; });
  afterAll(() => { delete REFERENCE_SOURCES[SOURCE_SPEC.id]; });
  beforeEach(() => { db = new Database(':memory:'); });

  it('stores the valued enumerations as enum records labelled cpp-decls@4, names only, and a second ingest is idempotent', () => {
    const first = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(first.tables[0]).toMatchObject({ status: 'ingested', rows: 5, duplicateKeys: 0, unclassified: [], malformed: 0 });
    expect(first.store).toEqual({ created: 5, rawChanged: 0, reprojected: 0, unchanged: 0 });
    const wrappers = listWrappers(db, { sourceId: SOURCE_SPEC.id });
    expect(wrappers.every((w) => w.technique === 'cpp-decls@4')).toBe(true);
    const enums = wrappers.filter((w) => w.raw.kind === 'enum');
    expect(enums.map((w) => [w.raw.qualifiedName, w.raw.fields])).toEqual([
      ['quillon::Oakmoss', 'Gorsey;Hazelet'],
      ['quillon::Pumbago', 'Alderan;Birchen;Cedarwyn'],
      ['quillon::Tamarisk::Mapleshaw', 'Nettlegrove;Osierby'],
      ['quillon::Verdelet', 'Dogwoode;Elmbury;Fernhold'],
    ]);
    for (const w of wrappers) expect(JSON.stringify([w.raw, w.entity])).not.toMatch(/4F2C9A1E/);
    expect(new Set(wrappers.map((w) => w.entity.id)).size).toBe(wrappers.length);

    const second = ingestSourceFromDir(SOURCE_SPEC.id, 'root', deps());
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 5 });
  });
});
