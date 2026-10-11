// W19: the tenth generic behaviour-node row (Backlog item 8): THREE consecutive initials in the brace form of row M–O's shape —
// <prefix>{<a>,<b>,<c>}*.{h,cpp}, no stem — registered after a row (S) that lies ABOVE it in the alphabet, with a row (M–O) directly
// BELOW it: the first row whose alphabetic gap closes from BOTH sides (vault Decisions Z-D84, Z-D85). It is read by BOTH
// source-code techniques over that one glob — a cpp-decls spec under the shared node map, and its cpp-handles twin, both in the
// row's own catalog. The glob must read the row's code files and nothing else, and must share no file with any other spec (an
// overlap would wrap one file twice under one id). Every row path below — the prefix, the initials, the other rows' alternatives —
// is DERIVED from the registered specs at run time, and every letter is derived over the specs registered BEFORE this one
// (`ROW_SPECS.slice(0, 9)`), never hard-coded; every line of C++, every name and the one hex value in it was coined for this test.
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, PARAMETER_HANDLE_MAP } from '@/lib/catalog/ingest/botw';
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
// The Action folder's rows, selected by PLACE (W19): the shared-map decls specs whose glob lies directly in the first one's folder.
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === dirOf(SHARED_DECLS[0].file));
// Pinned to this row by position among the row specs (vault Z-D57): the tenth row spec, the ninth registered before it.
const SPEC = ROW_SPECS[9];
const EARLIER = ROW_SPECS[8];
const BEFORE = ROW_SPECS.slice(0, 9);
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const TWIN = twinOf(SPEC.file);
const EARLIER_TWIN = twinOf(EARLIER.file);
const FOLDER = dirOf(SPEC.file);
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
const letterAfter = (c: string, step: number) => String.fromCharCode(c.charCodeAt(0) + step);
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const rowFile = (head: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${head}${tail}.${ext}`;
// The first initial whose bare probe no spec reads — the stay-open file IS that probe (the W14 lesson).
const OPEN = UPPER.find((i) => BOTW.tables.every((t) => !expandGlob([rowFile(i, 'Probe', 'h')], t.file).length))!;

// Where this row sits among the specs registered BEFORE it (by position, never by the alphabet): the single initials of the
// earlier row specs. The lower neighbour is the greatest of them below FIRST, the upper neighbour the least above LAST.
const BEFORE_INITIALS = BEFORE.flatMap((s) => altsOf(s.file)).filter((a) => a.length === 1);
const BELOW = BEFORE_INITIALS.filter((c) => c < FIRST).sort().at(-1) ?? '';
const ABOVE = BEFORE_INITIALS.filter((c) => c > LAST).sort()[0] ?? '';
const readersOf = (probe: string) => BOTW.tables.filter((s) => expandGlob([probe], s.file).length);
const specOf = (initial: string) => BEFORE.find((s) => altsOf(s.file).includes(initial))!;

const LEAD = { h: rowFile(FIRST, 'OkapiLead', 'h'), cpp: rowFile(FIRST, 'OkapiLead', 'cpp') };
const TRAIL = { h: rowFile(LAST, 'OkapiTrail', 'h'), cpp: rowFile(LAST, 'OkapiTrail', 'cpp') };
const ONE_ROW = rowFile(altsOf(ROW_SPECS[2].file)[0], 'OkapiEcho', 'h');
const STEM_ROW = rowFile(altsOf(ROW_SPECS[3].file)[0], 'OkapiFold', 'h');
const FG_ROW = rowFile(altsOf(ROW_SPECS[4].file)[0], 'OkapiHarp', 'h');
const HL_ROW = rowFile(altsOf(ROW_SPECS[5].file)[0], 'OkapiLute', 'h');
const MO_ROW = rowFile(BELOW, 'OkapiGate', 'h');
const TZ_ROW = rowFile(altsOf(ROW_SPECS[7].file)[0], 'OkapiLate', 'h');
const S_ROW = rowFile(ABOVE, 'OkapiSolo', 'h');
const OTHER_ROWS = [ONE_ROW, STEM_ROW, FG_ROW, HL_ROW, MO_ROW, TZ_ROW, S_ROW];

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter.
  [LEAD.h]: `
namespace demo::okapi {
class OkapiLead : public OkapiRoot {
public:
    explicit OkapiLead(const Kit& kit);
    ~OkapiLead() override;
    bool pluckOkapi() override;
    void wakeOkapi(Satchel* satchel) override;
    void strumOkapi() override;
    void tuneOkapi() override;
protected:
    // okapi_fixed at offset 0x7c3d
    const float* mOkapiPitch_s{};
    // okapi_call at offset 0x7c3d
    demo::Verse mOkapiCue_d{};
    // okapi_placed at offset 0x7c3d
    const int* mOkapiLane_m{};
    // okapi_shared at offset 0x7c3d
    void* mOkapiLink_a{};
    float mOkapiBeat;
};
}`,
  [LEAD.cpp]: `
#include "okapiLead.h"
namespace demo::okapi {
OkapiLead::OkapiLead(const Kit& kit) : OkapiRoot(kit) {}
OkapiLead::~OkapiLead() = default;
bool OkapiLead::pluckOkapi() { return OkapiRoot::pluckOkapi(); }
void OkapiLead::wakeOkapi(Satchel* satchel) { OkapiRoot::wakeOkapi(satchel); }
void OkapiLead::strumOkapi() { OkapiRoot::strumOkapi(); }
void OkapiLead::tuneOkapi() { bindPeg(&mOkapiPitch_s, "OkapiPitch"); bindPeg(&mOkapiCue_d, "OkapiCue"); }
}`,
  // A node under the last initial whose parent is the lead above, named bare.
  [TRAIL.h]: `
namespace demo::okapi {
class OkapiTrail : public OkapiLead {
public:
    explicit OkapiTrail(const Kit& kit);
    ~OkapiTrail() override = default;
    void tuneOkapi() override;
protected:
    // okapi_fixed at offset 0x7c3d
    const bool* mOkapiMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "okapiTrail.h"
namespace demo::okapi {
OkapiTrail::OkapiTrail(const Kit& kit) : OkapiLead(kit) {}
void OkapiTrail::tuneOkapi() { OkapiLead::tuneOkapi(); bindPeg(&mOkapiMute_s, "OkapiMute"); }
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'listOkapiFiles(okapiLead.cpp)\n',
  // Read by seven other row specs — the single-initial row, the stem row, the enumerated row, the sixth row, the row directly
  // BELOW this one, the eighth row and the row directly ABOVE it — never by this row's.
  [ONE_ROW]: 'namespace demo { class EchoOkapi { int mEchoPeg; }; }',
  [STEM_ROW]: 'namespace demo { class FoldOkapi { int mFoldPeg; }; }',
  [FG_ROW]: 'namespace demo { class HarpOkapi { int mHarpPeg; }; }',
  [HL_ROW]: 'namespace demo { class LuteOkapi { int mLutePeg; }; }',
  [MO_ROW]: 'namespace demo { class GateOkapi { int mGatePeg; }; }',
  [TZ_ROW]: 'namespace demo { class LateOkapi { int mLatePeg; }; }',
  [S_ROW]: 'namespace demo { class SoloOkapi { int mSoloPeg; }; }',
  // Stay open: the probe of the first initial no spec reads, a lower-case initial, another extension, a deeper folder, and a
  // look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN, 'Probe', 'h')]: 'namespace demo { class OpenOkapi { int mOpenPeg; }; }',
  [rowFile(FIRST.toLowerCase(), 'OkapiLow', 'h')]: 'namespace demo { class LowOkapi { int mLowPeg; }; }',
  [rowFile(FIRST, 'OkapiNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}OkapiDeep.h`]: 'namespace demo { class DeepOkapi { int mDeepPeg; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}OkapiTwin.h`]: 'namespace demo { class TwinOkapi { int mTwinPeg; }; }',
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

describe('BOTW generic behaviour-node rows: the tenth row, three initials closing the gap from both sides, read by both techniques (W19)', () => {
  it('sits directly after the ninth row and its handle twin directly after the ninth twin: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(10);
    expect(EARLIER).toBe(ROW_SPECS[8]);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(EARLIER_TWIN) + 1);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // Every row spec of the folder has the shape and the prefix; this one lists several consecutive initials, as the seventh row does.
    for (const s of ROW_SPECS) expect(ROW_SHAPE.exec(filePart(s.file))?.[1]).toBe(PREFIX);
    expect(SHAPE).not.toBeNull();
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS.length).toBeGreaterThan(1);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(FIRST).toMatch(/^[A-Z]$/);
  });

  it('closes the gap from both sides: the lower neighbour is directly below FIRST, the upper directly above LAST, each read by its own spec and twin', () => {
    // The first row whose gap is closed from both sides. Registration is wave order (vault Z-D78); the alphabet is derived over
    // the specs registered before this one, and no letter is hard-coded.
    expect(BELOW).toHaveLength(1);
    expect(ABOVE).toHaveLength(1);
    expect(BELOW < FIRST).toBe(true);
    expect(ABOVE > LAST).toBe(true);
    expect(FIRST).toBe(letterAfter(BELOW, 1)); // nothing lies between the lower neighbour and this row
    expect(ABOVE).toBe(letterAfter(LAST, 1)); // nothing lies between this row and the upper neighbour
    expect(BEFORE_INITIALS.filter((c) => c > BELOW && c < FIRST)).toEqual([]);
    expect(BEFORE_INITIALS.filter((c) => c > LAST && c < ABOVE)).toEqual([]);
    // A probe at each neighbour is read by exactly that neighbour's spec and its twin, never by this row's.
    for (const [initial, owner] of [[BELOW, specOf(BELOW)], [ABOVE, specOf(ABOVE)]] as const) {
      expect(owner).toBeDefined();
      expect(owner).not.toBe(SPEC);
      for (const ext of EXTS.split(',')) {
        const probe = rowFile(initial, 'Probe', ext);
        expect(readersOf(probe)).toEqual([owner, twinOf(owner.file)]);
        for (const s of [SPEC, TWIN]) expect(expandGlob([probe], s.file)).toEqual([]);
      }
    }
    // The lower neighbour is the seventh row and the upper the ninth, by registration.
    expect(specOf(BELOW)).toBe(ROW_SPECS[6]);
    expect(specOf(ABOVE)).toBe(EARLIER);
  });

  it('shares no file with any other spec: no alternative begins another, and no border probe is read by two specs', () => {
    // A name read by two prefix globs would begin with an alternative of each, so one alternative would begin the other.
    for (const earlier of BEFORE) {
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
      // Every other row spec of this technique really reads probes, so "no overlap" is not "nothing read".
      for (const earlier of BEFORE) {
        const s = specs === DECL_SPECS ? earlier : twinOf(earlier.file);
        expect(expandGlob(probes, s.file).length).toBeGreaterThan(0);
      }
    }
    // Over the fixture tree too, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of Object.keys(FILES)) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), TWIN.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([S_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[7].file)).toEqual([TZ_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[6].file)).toEqual([MO_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[5].file)).toEqual([HL_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[4].file)).toEqual([FG_ROW]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the seven other rows' files covered; the build file descoped; the 5 others open.
    expect(cov).toMatchObject({ total: 17, covered: 11, descoped: 1, open: 5 });
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
    // 4 node records + 5 handle records of the row, and one node record from each of the seven other specs' files.
    expect(first.store).toEqual({ created: 16, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::okapi::OkapiLead',
      `botw-demo::okapi::OkapiLead::(definitions@${LEAD.cpp})`,
      'botw-demo::okapi::OkapiTrail',
      `botw-demo::okapi::OkapiTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['OkapiLead', 'mOkapiCue_d', 'okapi_call', 'named'], ['OkapiLead', 'mOkapiLane_m', 'okapi_placed', 'integer'],
      ['OkapiLead', 'mOkapiLink_a', 'okapi_shared', 'void'], ['OkapiLead', 'mOkapiPitch_s', 'okapi_fixed', 'real'],
      ['OkapiTrail', 'mOkapiMute_s', 'okapi_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::okapi::OkapiLead')).toMatchObject({
      kind: 'class', bases: 'OkapiRoot', methods: 'OkapiLead;~OkapiLead;pluckOkapi;wakeOkapi;strumOkapi;tuneOkapi',
      fields: 'mOkapiPitch_s;mOkapiCue_d;mOkapiLane_m;mOkapiLink_a;mOkapiBeat',
    });
    // The in-row link: the trail names its parent bare. A destructor defaulted in the header leaves the definition without it.
    expect(node('botw-demo::okapi::OkapiTrail')).toMatchObject({ kind: 'class', bases: 'OkapiLead', fields: 'mOkapiMute_s' });
    expect(node(`botw-demo::okapi::OkapiTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'OkapiTrail;tuneOkapi' });
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(16);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(16);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 16 });
  });
});
