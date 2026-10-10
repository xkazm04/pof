// W16: the seventh generic behaviour-node row (Backlog item 8): three single initials after the sixth row's last one, in the
// shape of the first rows — <prefix>{<initial>,…}*.{h,cpp}, no stem and no enumeration. It is read by BOTH source-code
// techniques over that one glob — a cpp-decls spec under the shared node map at the end of the cpp-decls block, and its
// cpp-handles twin last, both in the row's own catalog (vault Decisions Z-D70, Z-D71). The glob must read the row's code
// files and nothing else, and must share no file with any earlier spec (an overlap would wrap one file twice under one id).
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
const ROW_SPECS = DECL_SPECS.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
// Pinned to this row by position among the row specs (vault Z-D57): the seventh row spec, the sixth before it.
const SPEC = ROW_SPECS[6];
const EARLIER = ROW_SPECS[5];
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const TWIN = twinOf(SPEC.file);
const EARLIER_TWIN = twinOf(EARLIER.file);
const LATER = ROW_SPECS[7];
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

const LEAD = { h: rowFile(FIRST, 'MarimbaLead', 'h'), cpp: rowFile(FIRST, 'MarimbaLead', 'cpp') };
const TRAIL = { h: rowFile(LAST, 'MarimbaTrail', 'h'), cpp: rowFile(LAST, 'MarimbaTrail', 'cpp') };
const ONE_ROW = rowFile(altsOf(ROW_SPECS[2].file)[0], 'MarimbaEcho', 'h');
const STEM_ROW = rowFile(altsOf(ROW_SPECS[3].file)[0], 'MarimbaFold', 'h');
const FG_ROW = rowFile(altsOf(ROW_SPECS[4].file)[0], 'MarimbaHarp', 'h');
const EARLIER_ROW = rowFile(EARLIER_LAST, 'MarimbaGate', 'h');
const NEXT_ROW_OPEN = rowFile(letterAfter(LAST, 1), 'MarimbaNext', 'h');
const MOUNT_FILE = `${MOUNT_AREA}/demoMarimbaMount.h`;
const OTHER_ROWS = [ONE_ROW, STEM_ROW, FG_ROW, EARLIER_ROW, MOUNT_FILE];

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes the row uses, the lifecycle hooks, and one runtime counter.
  [LEAD.h]: `
namespace demo::marimba {
class MarimbaLead : public MarimbaRoot {
public:
    explicit MarimbaLead(const Kit& kit);
    ~MarimbaLead() override;
    bool pluckMarimba() override;
    void wakeMarimba(Satchel* satchel) override;
    void strumMarimba() override;
    void tuneMarimba() override;
protected:
    // marimba_fixed at offset 0x3b6e
    const float* mMarimbaPitch_s{};
    // marimba_call at offset 0x3b6e
    demo::Verse mMarimbaCue_d{};
    // marimba_placed at offset 0x3b6e
    const int* mMarimbaLane_m{};
    // marimba_shared at offset 0x3b6e
    void* mMarimbaLink_a{};
    float mMarimbaBeat;
};
}`,
  [LEAD.cpp]: `
#include "marimbaLead.h"
namespace demo::marimba {
MarimbaLead::MarimbaLead(const Kit& kit) : MarimbaRoot(kit) {}
MarimbaLead::~MarimbaLead() = default;
bool MarimbaLead::pluckMarimba() { return MarimbaRoot::pluckMarimba(); }
void MarimbaLead::wakeMarimba(Satchel* satchel) { MarimbaRoot::wakeMarimba(satchel); }
void MarimbaLead::strumMarimba() { MarimbaRoot::strumMarimba(); }
void MarimbaLead::tuneMarimba() { bindPeg(&mMarimbaPitch_s, "MarimbaPitch"); bindPeg(&mMarimbaCue_d, "MarimbaCue"); }
}`,
  // A node under the last initial whose parent is a node of the MOUNT's area (the file below), named bare.
  [TRAIL.h]: `
namespace demo::marimba {
class MarimbaTrail : public MarimbaMount {
public:
    explicit MarimbaTrail(const Kit& kit);
    ~MarimbaTrail() override = default;
    void tuneMarimba() override;
protected:
    // marimba_fixed at offset 0x3b6e
    const bool* mMarimbaMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "marimbaTrail.h"
namespace demo::marimba {
MarimbaTrail::MarimbaTrail(const Kit& kit) : MarimbaMount(kit) {}
void MarimbaTrail::tuneMarimba() { MarimbaMount::tuneMarimba(); bindPeg(&mMarimbaMute_s, "MarimbaMute"); }
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'listMarimbaFiles(marimbaLead.cpp)\n',
  // Read by the mount's spec (its handle twin finds no handle in it), never by this row's.
  [MOUNT_FILE]: 'namespace demo::marimba { class MarimbaMount : public MarimbaRoot { int mMountPeg; }; }',
  // Read by four earlier row specs — a single-initial row, the stem row, the enumerated row, the sixth row — never by this row's.
  [ONE_ROW]: 'namespace demo { class EchoMarimba { int mEchoPeg; }; }',
  [STEM_ROW]: 'namespace demo { class FoldMarimba { int mFoldPeg; }; }',
  [FG_ROW]: 'namespace demo { class HarpMarimba { int mHarpPeg; }; }',
  [EARLIER_ROW]: 'namespace demo { class GateMarimba { int mGatePeg; }; }',
  // Stay open: the first file of the initial after the row's last one (no spec reads it yet).
  [NEXT_ROW_OPEN]: 'namespace demo { class NextMarimba { int mNextPeg; }; }',
  // Stay open: the probe of the first initial no spec reads, a lower-case initial, another extension, a deeper folder, and a
  // look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN, 'Probe', 'h')]: 'namespace demo { class OpenMarimba { int mOpenPeg; }; }',
  [rowFile(FIRST.toLowerCase(), 'MarimbaLow', 'h')]: 'namespace demo { class LowMarimba { int mLowPeg; }; }',
  [rowFile(FIRST, 'MarimbaNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}MarimbaDeep.h`]: 'namespace demo { class DeepMarimba { int mDeepPeg; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}MarimbaTwin.h`]: 'namespace demo { class TwinMarimba { int mTwinPeg; }; }',
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

describe('BOTW generic behaviour-node rows: the seventh row, three initials, read by both techniques (W16)', () => {
  it('ends the cpp-decls block with the row and appends its handle twin last: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(9);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    // The next row's spec directly follows this one (it ends the cpp-decls block), and this row's twin is directly followed by
    // the next row's twin (which is the last table); the newest row's test asserts the ends (vault Z-D77).
    expect(BOTW.tables.indexOf(LATER)).toBe(BOTW.tables.indexOf(SPEC) + 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(EARLIER_TWIN) + 1);
    expect(BOTW.tables.indexOf(LATER_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // Every row spec of the folder has the shape and the prefix; this one lists single initials only, consecutive, starting
    // directly after the fifth row's single-initial alternative.
    for (const s of ROW_SPECS) expect(ROW_SHAPE.exec(filePart(s.file))?.[1]).toBe(PREFIX);
    expect(SHAPE).not.toBeNull();
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS.length).toBeGreaterThan(1);
    expect(INITIALS.every((c) => /^[A-Z]$/.test(c))).toBe(true);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(EARLIER_LAST).toHaveLength(1);
    expect(FIRST).toBe(letterAfter(EARLIER_LAST, 1));
    expect(MOUNT_AREA.length).toBeGreaterThan(0);
  });

  it('shares no file with any earlier spec: no alternative begins another, and no border probe is read by two specs', () => {
    // A name read by two prefix globs would begin with an alternative of each, so one alternative would begin the other.
    for (const earlier of ROW_SPECS.slice(0, 6)) {
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
      for (const earlier of ROW_SPECS.slice(0, 6)) {
        const s = specs === DECL_SPECS ? earlier : twinOf(earlier.file);
        expect(expandGlob(probes, s.file).length).toBeGreaterThan(0);
      }
    }
    // The letters on either side of the row are not read by it.
    for (const c of [letterAfter(FIRST, -1), letterAfter(LAST, 1)]) {
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
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the five earlier specs' files covered; the build file descoped; the 6 others open.
    expect(cov).toMatchObject({ total: 16, covered: 9, descoped: 1, open: 6 });
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
    // 4 node records + 5 handle records of the row, and one node record from each of the four other specs' files.
    expect(first.store).toEqual({ created: 14, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::marimba::MarimbaLead',
      `botw-demo::marimba::MarimbaLead::(definitions@${LEAD.cpp})`,
      'botw-demo::marimba::MarimbaTrail',
      `botw-demo::marimba::MarimbaTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['MarimbaLead', 'mMarimbaCue_d', 'marimba_call', 'named'], ['MarimbaLead', 'mMarimbaLane_m', 'marimba_placed', 'integer'],
      ['MarimbaLead', 'mMarimbaLink_a', 'marimba_shared', 'void'], ['MarimbaLead', 'mMarimbaPitch_s', 'marimba_fixed', 'real'],
      ['MarimbaTrail', 'mMarimbaMute_s', 'marimba_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::marimba::MarimbaLead')).toMatchObject({
      kind: 'class', bases: 'MarimbaRoot', methods: 'MarimbaLead;~MarimbaLead;pluckMarimba;wakeMarimba;strumMarimba;tuneMarimba',
      fields: 'mMarimbaPitch_s;mMarimbaCue_d;mMarimbaLane_m;mMarimbaLink_a;mMarimbaBeat',
    });
    // The cross-AREA link: this row's node names its parent bare, and the parent's record is the mount spec's, from the mount's
    // area, in the same catalog. A destructor defaulted in the header leaves the definition record without it.
    expect(node('botw-demo::marimba::MarimbaTrail')).toMatchObject({ kind: 'class', bases: 'MarimbaMount', fields: 'mMarimbaMute_s' });
    expect(node(`botw-demo::marimba::MarimbaTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'MarimbaTrail;tuneMarimba' });
    expect(node('botw-demo::marimba::MarimbaMount')).toMatchObject({ kind: 'class', file: MOUNT_FILE });
    expect(listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).some((w) => w.raw.file === MOUNT_FILE)).toBe(true);
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(14);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(14);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 14 });
  });
});
