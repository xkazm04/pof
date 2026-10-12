// W17: the eighth generic behaviour-node row (Backlog item 8): seven single initials in the shape of the first rows —
// <prefix>{<initial>,…}*.{h,cpp}, no stem and no enumeration — that do NOT start after the seventh row's last one: the
// initials between them belong to rows registered later, so they stay unread for now (vault Decisions Z-D74 – Z-D77). It is
// read by BOTH source-code techniques over that one glob — a cpp-decls spec under the shared node map (it ended the
// cpp-decls block until the next row registered) and its cpp-handles twin (last until then), both in the row's own catalog. The glob must read the row's code
// files and nothing else, and must share no file with any earlier spec (an overlap would wrap one file twice under one id).
// One initial of the row has no file at the pin; no test here asserts that every initial has one.
// Some of the row's nodes extend a node of another area, so one fixture node here names a parent the mount's spec reads.
// Every row path below — the prefix, the initials, the earlier rows' alternatives, the mount's area — is DERIVED from the
// registered specs at run time; every line of C++, every name and the one hex value in it was coined for this test.
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, MOUNT_CLASS_MAP, PARAMETER_HANDLE_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { CPP_HANDLE_COLUMNS, parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const DECL_SPECS = BOTW.tables.filter((t) => t.technique === 'cpp-decls');
const HANDLE_SPECS = BOTW.tables.filter((t) => t.technique === 'cpp-handles');
const SHARED_DECLS = DECL_SPECS.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/'));
// The Action folder's rows, selected by PLACE (W19): the shared-map decls specs whose glob lies directly in the first one's folder; the folder specs registered after them are read by their own test.
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === dirOf(SHARED_DECLS[0].file));
// Pinned to this row by position among the row specs (vault Z-D57): the eighth row spec, the seventh before it.
const SPEC = ROW_SPECS[7];
const EARLIER = ROW_SPECS[6];
const LATER = ROW_SPECS[8];
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const TWIN = twinOf(SPEC.file);
const EARLIER_TWIN = twinOf(EARLIER.file);
const LATER_TWIN = twinOf(LATER.file);
const MOUNT = DECL_SPECS.find((t) => t.map === MOUNT_CLASS_MAP)!;
const MOUNT_AREA = MOUNT.file.slice(0, MOUNT.file.indexOf('/**'));
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
const filePart = (file: string) => file.slice(FOLDER.length + 1);
// A row glob's file part: <prefix>{<alternative>,…}*.{<ext>,…} or <prefix><stem>*.{<ext>,…}; an alternative is a capital and
// lower-case letters. The alternatives of a stem glob are its one stem.
const ROW_SHAPE = /^([a-z]+)(?:\{([A-Z][a-z]*(?:,[A-Z][a-z]*)*)\}|([A-Z][a-z]+))\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const altsOf = (file: string) => { const m = ROW_SHAPE.exec(filePart(file)); return m ? (m[2] ? m[2].split(',') : [m[3]]) : []; };
const SHAPE = ROW_SHAPE.exec(filePart(SPEC.file));
const [, PREFIX, INITIAL_LIST, , EXTS] = SHAPE ?? ['', '', '', '', ''];
const INITIALS = (INITIAL_LIST ?? '').split(',');
const FIRST = INITIALS[0];
const LAST = INITIALS.at(-1)!;
const EARLIER_LAST = altsOf(EARLIER.file).filter((a) => a.length === 1).at(-1) ?? '';
const letterAfter = (c: string, step: number) => String.fromCharCode(c.charCodeAt(0) + step);
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const rowFile = (head: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${head}${tail}.${ext}`;
// The first initial whose bare probe no spec reads — the stay-open file IS that probe (the W14 lesson).
const OPEN = UPPER.find((i) => BOTW.tables.every((t) => !expandGlob([rowFile(i, 'Probe', 'h')], t.file).length))!;

const LEAD = { h: rowFile(FIRST, 'QuinceLead', 'h'), cpp: rowFile(FIRST, 'QuinceLead', 'cpp') };
const TRAIL = { h: rowFile(LAST, 'QuinceTrail', 'h'), cpp: rowFile(LAST, 'QuinceTrail', 'cpp') };
const ONE_ROW = rowFile(altsOf(ROW_SPECS[2].file)[0], 'QuinceEcho', 'h');
const STEM_ROW = rowFile(altsOf(ROW_SPECS[3].file)[0], 'QuinceFold', 'h');
const FG_ROW = rowFile(altsOf(ROW_SPECS[4].file)[0], 'QuinceHarp', 'h');
const HL_ROW = rowFile(altsOf(ROW_SPECS[5].file)[0], 'QuinceLute', 'h');
const EARLIER_ROW = rowFile(EARLIER_LAST, 'QuinceGate', 'h');
// The letters strictly between the earlier row's last initial and this row's first: rows registered later own them, so no
// spec registered up to and including this row reads them (and no fixture sits there: a later row would read it).
const GAP = UPPER.filter((c) => c > EARLIER_LAST && c < FIRST);
const MOUNT_FILE = `${MOUNT_AREA}/demoQuinceMount.h`;
const OTHER_ROWS = [ONE_ROW, STEM_ROW, FG_ROW, HL_ROW, EARLIER_ROW, MOUNT_FILE];

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes the row uses, the lifecycle hooks, and one runtime counter.
  [LEAD.h]: `
namespace demo::quince {
class QuinceLead : public QuinceRoot {
public:
    explicit QuinceLead(const Kit& kit);
    ~QuinceLead() override;
    bool pluckQuince() override;
    void wakeQuince(Satchel* satchel) override;
    void strumQuince() override;
    void tuneQuince() override;
protected:
    // quince_fixed at offset 0x6d2f
    const float* mQuincePitch_s{};
    // quince_call at offset 0x6d2f
    demo::Verse mQuinceCue_d{};
    // quince_placed at offset 0x6d2f
    const int* mQuinceLane_m{};
    // quince_shared at offset 0x6d2f
    void* mQuinceLink_a{};
    float mQuinceBeat;
};
}`,
  [LEAD.cpp]: `
#include "quinceLead.h"
namespace demo::quince {
QuinceLead::QuinceLead(const Kit& kit) : QuinceRoot(kit) {}
QuinceLead::~QuinceLead() = default;
bool QuinceLead::pluckQuince() { return QuinceRoot::pluckQuince(); }
void QuinceLead::wakeQuince(Satchel* satchel) { QuinceRoot::wakeQuince(satchel); }
void QuinceLead::strumQuince() { QuinceRoot::strumQuince(); }
void QuinceLead::tuneQuince() { bindPeg(&mQuincePitch_s, "QuincePitch"); bindPeg(&mQuinceCue_d, "QuinceCue"); }
}`,
  // A node under the last initial whose parent is a node of the MOUNT's area (the file below), named bare.
  [TRAIL.h]: `
namespace demo::quince {
class QuinceTrail : public QuinceMount {
public:
    explicit QuinceTrail(const Kit& kit);
    ~QuinceTrail() override = default;
    void tuneQuince() override;
protected:
    // quince_fixed at offset 0x6d2f
    const bool* mQuinceMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "quinceTrail.h"
namespace demo::quince {
QuinceTrail::QuinceTrail(const Kit& kit) : QuinceMount(kit) {}
void QuinceTrail::tuneQuince() { QuinceMount::tuneQuince(); bindPeg(&mQuinceMute_s, "QuinceMute"); }
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'listQuinceFiles(quinceLead.cpp)\n',
  // Read by the mount's spec (its handle twin finds no handle in it), never by this row's.
  [MOUNT_FILE]: 'namespace demo::quince { class QuinceMount : public QuinceRoot { int mMountPeg; }; }',
  // Read by five earlier row specs — a single-initial row, the stem row, the enumerated row, the sixth and the seventh row — never by this row's.
  [ONE_ROW]: 'namespace demo { class EchoQuince { int mEchoPeg; }; }',
  [STEM_ROW]: 'namespace demo { class FoldQuince { int mFoldPeg; }; }',
  [FG_ROW]: 'namespace demo { class HarpQuince { int mHarpPeg; }; }',
  [HL_ROW]: 'namespace demo { class LuteQuince { int mLutePeg; }; }',
  [EARLIER_ROW]: 'namespace demo { class GateQuince { int mGatePeg; }; }',
  // Stay open: the probe of the first initial no spec reads, a lower-case initial, another extension, a deeper folder, and a
  // look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN, 'Probe', 'h')]: 'namespace demo { class OpenQuince { int mOpenPeg; }; }',
  [rowFile(FIRST.toLowerCase(), 'QuinceLow', 'h')]: 'namespace demo { class LowQuince { int mLowPeg; }; }',
  [rowFile(FIRST, 'QuinceNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}QuinceDeep.h`]: 'namespace demo { class DeepQuince { int mDeepPeg; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}QuinceTwin.h`]: 'namespace demo { class TwinQuince { int mTwinPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, TRAIL.h, TRAIL.cpp].sort();
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !ROW.includes(f) && !OTHER_ROWS.includes(f) && !f.endsWith('CMakeLists.txt')).sort();

/** Every name that could sit on a border between the folder's rows: every letter in both cases, and every row alternative. */
function borderProbes(): string[] {
  const names = [...new Set([...UPPER, ...LOWER, ...ROW_SPECS.flatMap((s) => altsOf(s.file))])];
  return names.flatMap((n) => EXTS.split(',').map((ext) => rowFile(n, 'Probe', ext)));
}

function syntheticDeps(db: Database.Database, reads: string[]) {
  return {
    db,
    readFile: (p: string) => {
      const rel = p.replace(/\\/g, '/').replace(/^clone\//, '');
      reads.push(rel);
      return FILES[rel];
    },
    listFiles: () => Object.keys(FILES),
  };
}

describe('BOTW generic behaviour-node rows: the eighth row, seven initials after a gap, read by both techniques (W17)', () => {
  it('is followed directly by the next row\'s spec and its handle twin by the next row\'s twin: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(10);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    // The next row's spec directly follows this one (it ends the cpp-decls block), and this row's twin is directly followed by
    // the next row's twin (which is the last table); the newest row's test asserts the ends (vault Z-D82).
    expect(BOTW.tables.indexOf(LATER)).toBe(BOTW.tables.indexOf(SPEC) + 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(EARLIER_TWIN) + 1);
    expect(BOTW.tables.indexOf(LATER_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // Every row spec of the folder has the shape and the prefix; this one lists single initials only, consecutive among
    // themselves, starting AFTER the previous row's last one but not directly after it (see the gap below).
    for (const s of ROW_SPECS) expect(ROW_SHAPE.exec(filePart(s.file))?.[1]).toBe(PREFIX);
    expect(SHAPE).not.toBeNull();
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS.length).toBeGreaterThan(1);
    expect(INITIALS.every((c) => /^[A-Z]$/.test(c))).toBe(true);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(EARLIER_LAST).toHaveLength(1);
    // The gap (new in this row): the first initial comes after the earlier row's last, but NOT directly after it — every
    // letter strictly between is read by no spec registered up to and including this row, in either case, for both
    // techniques. A row registered later may own them; this assertion looks only at the specs registered before it.
    expect(FIRST > EARLIER_LAST).toBe(true);
    expect(GAP.length).toBeGreaterThan(0);
    expect(GAP.length).toBe(FIRST.charCodeAt(0) - EARLIER_LAST.charCodeAt(0) - 1);
    const laterFiles = new Set(ROW_SPECS.slice(8).map((s) => s.file)); // rows registered after this one (the S row sits at [8], P–R at [9]), both techniques
    const registered = BOTW.tables.filter((t) => !laterFiles.has(t.file));
    expect(registered).toContain(SPEC);
    for (const c of [...GAP, ...GAP.map((g) => g.toLowerCase())]) {
      for (const ext of EXTS.split(',')) {
        for (const tail of ['Probe', 'QuinceGap']) {
          expect(registered.filter((s) => expandGlob([rowFile(c, tail, ext)], s.file).length)).toEqual([]);
        }
      }
    }
    expect(MOUNT_AREA.length).toBeGreaterThan(0);
  });

  it('shares no file with any earlier spec: no alternative begins another, and no border probe is read by two specs', () => {
    // A name read by two prefix globs would begin with an alternative of each, so one alternative would begin the other.
    for (const earlier of ROW_SPECS.slice(0, 7)) {
      for (const a of INITIALS) {
        for (const b of altsOf(earlier.file)) {
          expect(a.startsWith(b)).toBe(false);
          expect(b.startsWith(a)).toBe(false);
        }
      }
    }
    const probes = borderProbes();
    const mine = (f: string) => INITIALS.some((c) => f.startsWith(`${FOLDER}/${PREFIX}${c}`));
    for (const [specs, own] of [[DECL_SPECS, SPEC], [HANDLE_SPECS, TWIN]] as const) {
      const read = expandGlob(probes, own.file);
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initials …
      expect(read.length).toBe(INITIALS.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // Every earlier row spec of this technique really reads probes, so "no overlap" is not "nothing read".
      for (const earlier of ROW_SPECS.slice(0, 7)) {
        const s = specs === DECL_SPECS ? earlier : twinOf(earlier.file);
        expect(expandGlob(probes, s.file).length).toBeGreaterThan(0);
      }
    }
    // The letter below the row is not read by it (the row ends at the alphabet's last letter, so there is none above).
    for (const c of [letterAfter(FIRST, -1)]) {
      for (const s of [SPEC, TWIN]) expect(expandGlob([rowFile(c, 'Probe', 'h')], s.file)).toEqual([]);
    }
    // Over the fixture tree too, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of Object.keys(FILES)) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), TWIN.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), MOUNT.file)).toEqual([MOUNT_FILE]);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([EARLIER_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[4].file)).toEqual([FG_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[5].file)).toEqual([HL_ROW]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the six earlier specs' files covered; the build file descoped; the 5 others open.
    expect(cov).toMatchObject({ total: 16, covered: 10, descoped: 1, open: 5 });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(4);
  });

  it('both maps classify every column of their technique', () => {
    for (const [columns, map] of [[CPP_RECORD_COLUMNS, SPEC.map], [CPP_HANDLE_COLUMNS, TWIN.map]] as const) {
      const audit = auditColumns([...columns], map);
      expect(audit.unclassified).toEqual([]);
      expect(audit.declaredButAbsent).toEqual([]);
    }
  });

  it('wraps node and handle records from the same files, the node records byte-identical to a cpp-decls-only read', () => {
    const db = new Database(':memory:');
    const reads: string[] = [];
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, reads));
    expect([...new Set(reads)].sort()).toEqual([...ROW, ...OTHER_ROWS].sort());
    expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 5, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 2, refused: [] },
    });
    // 4 node records + 5 handle records of the row, and one node record from each of the six other specs' files.
    expect(first.store).toEqual({ created: 15, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@4')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::quince::QuinceLead',
      `botw-demo::quince::QuinceLead::(definitions@${LEAD.cpp})`,
      'botw-demo::quince::QuinceTrail',
      `botw-demo::quince::QuinceTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['QuinceLead', 'mQuinceCue_d', 'quince_call', 'named'], ['QuinceLead', 'mQuinceLane_m', 'quince_placed', 'integer'],
      ['QuinceLead', 'mQuinceLink_a', 'quince_shared', 'void'], ['QuinceLead', 'mQuincePitch_s', 'quince_fixed', 'real'],
      ['QuinceTrail', 'mQuinceMute_s', 'quince_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::quince::QuinceLead')).toMatchObject({
      kind: 'class', bases: 'QuinceRoot', methods: 'QuinceLead;~QuinceLead;pluckQuince;wakeQuince;strumQuince;tuneQuince',
      fields: 'mQuincePitch_s;mQuinceCue_d;mQuinceLane_m;mQuinceLink_a;mQuinceBeat',
    });
    // The cross-AREA link: this row's node names its parent bare, and the parent's record is the mount spec's, from the mount's
    // area, in the same catalog. A destructor defaulted in the header leaves the definition record without it.
    expect(node('botw-demo::quince::QuinceTrail')).toMatchObject({ kind: 'class', bases: 'QuinceMount', fields: 'mQuinceMute_s' });
    expect(node(`botw-demo::quince::QuinceTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'QuinceTrail;tuneQuince' });
    expect(node('botw-demo::quince::QuinceMount')).toMatchObject({ kind: 'class', file: MOUNT_FILE });
    expect(listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).some((w) => w.raw.file === MOUNT_FILE)).toBe(true);
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(15);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(15);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 15 });
  });
});
