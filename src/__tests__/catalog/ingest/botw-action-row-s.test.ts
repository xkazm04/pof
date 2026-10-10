// W18: the ninth generic behaviour-node row (Backlog item 8): ONE initial in the brace form of row E's shape —
// <prefix>{<initial>}*.{h,cpp}, no stem and no enumeration — registered AFTER a row whose initials lie ABOVE it in the
// alphabet (vault Decisions Z-D79 – Z-D82). It is the first row below its registration predecessor, so it asserts neither
// "my first initial comes after the earlier row's last" (the eighth row's) nor "directly after it" (the seventh's): it
// asserts its REGISTRATION position, its lower alphabetic neighbour among the specs registered before it, the letters strictly
// between (owned by rows registered later, so unread now) and the contiguity with the row above it. It is read by BOTH
// source-code techniques over that one glob — a cpp-decls spec under the shared node map ending the cpp-decls block, and its
// cpp-handles twin last, both in the row's own catalog. The glob must read the row's code files and nothing else, and must share
// no file with any earlier spec (an overlap would wrap one file twice under one id). Every row path below — the prefix, the
// initial, the earlier rows' alternatives — is DERIVED from the registered specs at run time; every line of C++, every name and
// the one hex value in it was coined for this test.
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
const ROW_SPECS = DECL_SPECS.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
// Pinned to this row by position among the row specs (vault Z-D57): the ninth row spec, the eighth registered before it.
const SPEC = ROW_SPECS[8];
const EARLIER = ROW_SPECS[7];
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const TWIN = twinOf(SPEC.file);
const EARLIER_TWIN = twinOf(EARLIER.file);
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
const letterAfter = (c: string, step: number) => String.fromCharCode(c.charCodeAt(0) + step);
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const rowFile = (head: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${head}${tail}.${ext}`;
// The first initial whose bare probe no spec reads — the stay-open file IS that probe (the W14 lesson).
const OPEN = UPPER.find((i) => BOTW.tables.every((t) => !expandGlob([rowFile(i, 'Probe', 'h')], t.file).length))!;

// Where this row sits among the specs registered BEFORE it (by position, never by the alphabet): the single initials of the
// row specs that precede it. The lower neighbour is the greatest of them below FIRST, the upper neighbour the least above LAST.
const BEFORE_INITIALS = ROW_SPECS.slice(0, 8).flatMap((s) => altsOf(s.file)).filter((a) => a.length === 1);
const BELOW = BEFORE_INITIALS.filter((c) => c < FIRST).sort().at(-1) ?? '';
const ABOVE = BEFORE_INITIALS.filter((c) => c > LAST).sort()[0] ?? '';
// The letters strictly between the lower neighbour and this row's first initial: rows registered later own them, so no spec
// registered up to and including this row reads them (and no fixture sits there: a later row would read it).
const BETWEEN = UPPER.filter((c) => c > BELOW && c < FIRST);

const LEAD = { h: rowFile(FIRST, 'PloverLead', 'h'), cpp: rowFile(FIRST, 'PloverLead', 'cpp') };
const SHELL = { h: rowFile(FIRST, 'PloverEcho', 'h'), cpp: rowFile(FIRST, 'PloverEcho', 'cpp') };
const ONE_ROW = rowFile(altsOf(ROW_SPECS[2].file)[0], 'PloverEcho', 'h');
const STEM_ROW = rowFile(altsOf(ROW_SPECS[3].file)[0], 'PloverFold', 'h');
const FG_ROW = rowFile(altsOf(ROW_SPECS[4].file)[0], 'PloverHarp', 'h');
const HL_ROW = rowFile(altsOf(ROW_SPECS[5].file)[0], 'PloverLute', 'h');
const MO_ROW = rowFile(altsOf(ROW_SPECS[6].file)[0], 'PloverGate', 'h');
const TZ_ROW = rowFile(altsOf(EARLIER.file)[0], 'PloverLate', 'h');
const OTHER_ROWS = [ONE_ROW, STEM_ROW, FG_ROW, HL_ROW, MO_ROW, TZ_ROW];

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes, the lifecycle hooks, a one-shot hook and one runtime counter.
  [LEAD.h]: `
namespace demo::plover {
class PloverLead : public PloverRoot {
public:
    explicit PloverLead(const Kit& kit);
    ~PloverLead() override;
    bool pluckPlover() override;
    void wakePlover(Satchel* satchel) override;
    void strumPlover() override;
    bool trillPlover() override;
    void tunePlover() override;
protected:
    // plover_fixed at offset 0x5e8a
    const float* mPloverPitch_s{};
    // plover_call at offset 0x5e8a
    demo::Verse mPloverCue_d{};
    // plover_placed at offset 0x5e8a
    const int* mPloverLane_m{};
    // plover_shared at offset 0x5e8a
    void* mPloverLink_a{};
    float mPloverBeat;
};
}`,
  [LEAD.cpp]: `
#include "ploverLead.h"
namespace demo::plover {
PloverLead::PloverLead(const Kit& kit) : PloverRoot(kit) {}
PloverLead::~PloverLead() = default;
bool PloverLead::pluckPlover() { return PloverRoot::pluckPlover(); }
void PloverLead::wakePlover(Satchel* satchel) { PloverRoot::wakePlover(satchel); }
void PloverLead::strumPlover() { PloverRoot::strumPlover(); }
bool PloverLead::trillPlover() { return PloverRoot::trillPlover(); }
void PloverLead::tunePlover() { bindPeg(&mPloverPitch_s, "PloverPitch"); bindPeg(&mPloverCue_d, "PloverCue"); }
}`,
  // A shell: a preset of the node above that declares construction and destruction only and carries no parameter.
  [SHELL.h]: `
namespace demo::plover {
class PloverEcho : public PloverLead {
public:
    explicit PloverEcho(const Kit& kit);
    ~PloverEcho() override;
};
}`,
  [SHELL.cpp]: `
#include "ploverEcho.h"
namespace demo::plover {
PloverEcho::PloverEcho(const Kit& kit) : PloverLead(kit) {}
PloverEcho::~PloverEcho() = default;
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'listPloverFiles(ploverLead.cpp)\n',
  // Read by six earlier row specs — a single-initial row, the stem row, the enumerated row, the sixth, the seventh and the eighth
  // row — never by this row's.
  [ONE_ROW]: 'namespace demo { class EchoPlover { int mEchoPeg; }; }',
  [STEM_ROW]: 'namespace demo { class FoldPlover { int mFoldPeg; }; }',
  [FG_ROW]: 'namespace demo { class HarpPlover { int mHarpPeg; }; }',
  [HL_ROW]: 'namespace demo { class LutePlover { int mLutePeg; }; }',
  [MO_ROW]: 'namespace demo { class GatePlover { int mGatePeg; }; }',
  [TZ_ROW]: 'namespace demo { class LatePlover { int mLatePeg; }; }',
  // Stay open: the probe of the first initial no spec reads, a lower-case initial, another extension, a deeper folder, and a
  // look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN, 'Probe', 'h')]: 'namespace demo { class OpenPlover { int mOpenPeg; }; }',
  [rowFile(FIRST.toLowerCase(), 'PloverLow', 'h')]: 'namespace demo { class LowPlover { int mLowPeg; }; }',
  [rowFile(FIRST, 'PloverNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}PloverDeep.h`]: 'namespace demo { class DeepPlover { int mDeepPeg; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}PloverTwin.h`]: 'namespace demo { class TwinPlover { int mTwinPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, SHELL.h, SHELL.cpp].sort();
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

describe('BOTW generic behaviour-node rows: the ninth row, one initial registered below its predecessor, read by both techniques (W18)', () => {
  it('ends the cpp-decls block with the row and appends its handle twin last: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(9);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    expect(BOTW.tables.indexOf(SPEC)).toBe(DECL_SPECS.length - 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(EARLIER_TWIN) + 1);
    expect(BOTW.tables.at(-1)).toBe(TWIN);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // Every row spec of the folder has the shape and the prefix; this one lists exactly one initial (no assertion that a row
    // has more than one — row E's shape).
    for (const s of ROW_SPECS) expect(ROW_SHAPE.exec(filePart(s.file))?.[1]).toBe(PREFIX);
    expect(SHAPE).not.toBeNull();
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(1);
    expect(FIRST).toMatch(/^[A-Z]$/);
  });

  it('sits below its registration predecessor: the lower neighbour, the unread letters between, and contiguity with the row above', () => {
    // The first row whose registration predecessor lies ABOVE it: neither "first > earlier last" nor "first = the letter after
    // the earlier last" holds, and neither is asserted. Registration is wave order (vault Z-D79); the alphabet is derived.
    expect(EARLIER).toBe(ROW_SPECS[7]);
    expect(EXTS).toBeTruthy();
    expect(altsOf(EARLIER.file).every((a) => a > LAST)).toBe(true);
    // Below: the greatest single initial below FIRST among the specs registered before this one (derived, never hard-coded).
    expect(BELOW).toHaveLength(1);
    expect(BELOW < FIRST).toBe(true);
    expect(BEFORE_INITIALS.filter((c) => c > BELOW && c < FIRST)).toEqual([]);
    expect(BEFORE_INITIALS).toContain(BELOW);
    // Between: non-empty, of the arithmetic size, and read by no spec registered up to and including this row, in either case,
    // for both extensions and two tails, for both techniques. Rows registered later (by position) may own them.
    expect(BETWEEN.length).toBeGreaterThan(0);
    expect(BETWEEN.length).toBe(FIRST.charCodeAt(0) - BELOW.charCodeAt(0) - 1);
    const laterFiles = new Set(ROW_SPECS.slice(9).map((s) => s.file)); // rows registered after this one (none yet), both techniques
    const registered = BOTW.tables.filter((t) => !laterFiles.has(t.file));
    expect(registered).toContain(SPEC);
    expect(registered).toContain(TWIN);
    for (const c of [...BETWEEN, ...BETWEEN.map((g) => g.toLowerCase())]) {
      for (const ext of EXTS.split(',')) {
        for (const tail of ['Probe', 'PloverGap']) {
          expect(registered.filter((s) => expandGlob([rowFile(c, tail, ext)], s.file).length)).toEqual([]);
        }
      }
    }
    // Above: the least registered initial above LAST is the letter right after it, so the row is contiguous with the row above
    // from below; a probe at that letter is read by exactly that row's spec and its twin, and never by this row's.
    expect(ABOVE).toBe(letterAfter(LAST, 1));
    expect(altsOf(EARLIER.file)).toContain(ABOVE);
    for (const ext of EXTS.split(',')) {
      const probe = rowFile(ABOVE, 'Probe', ext);
      expect(BOTW.tables.filter((s) => expandGlob([probe], s.file).length)).toEqual([EARLIER, EARLIER_TWIN]);
      for (const s of [SPEC, TWIN]) expect(expandGlob([probe], s.file)).toEqual([]);
    }
  });

  it('shares no file with any earlier spec: no alternative begins another, and no border probe is read by two specs', () => {
    // A name read by two prefix globs would begin with an alternative of each, so one alternative would begin the other.
    for (const earlier of ROW_SPECS.slice(0, 8)) {
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
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initial …
      expect(read.length).toBe(INITIALS.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // Every earlier row spec of this technique really reads probes, so "no overlap" is not "nothing read".
      for (const earlier of ROW_SPECS.slice(0, 8)) {
        const s = specs === DECL_SPECS ? earlier : twinOf(earlier.file);
        expect(expandGlob(probes, s.file).length).toBeGreaterThan(0);
      }
    }
    // The letters on both sides of the row are not read by it.
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
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([TZ_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[6].file)).toEqual([MO_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[5].file)).toEqual([HL_ROW]);
    expect(expandGlob(Object.keys(FILES), ROW_SPECS[4].file)).toEqual([FG_ROW]);
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
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 3, refused: [] },
    });
    // 4 node records + 4 handle records of the row, and one node record from each of the six other specs' files.
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
      'botw-demo::plover::PloverEcho',
      `botw-demo::plover::PloverEcho::(definitions@${SHELL.cpp})`,
      'botw-demo::plover::PloverLead',
      `botw-demo::plover::PloverLead::(definitions@${LEAD.cpp})`,
    ]);
    // The handle records come from the one header that has them, exactly as cpp-handles reads it on its own; the runtime counter is no handle.
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...parseCppHandles(FILES[LEAD.h], { file: LEAD.h }).rows].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['PloverLead', 'mPloverCue_d', 'plover_call', 'named'], ['PloverLead', 'mPloverLane_m', 'plover_placed', 'integer'],
      ['PloverLead', 'mPloverLink_a', 'plover_shared', 'void'], ['PloverLead', 'mPloverPitch_s', 'plover_fixed', 'real'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::plover::PloverLead')).toMatchObject({
      kind: 'class', bases: 'PloverRoot', methods: 'PloverLead;~PloverLead;pluckPlover;wakePlover;strumPlover;trillPlover;tunePlover',
      fields: 'mPloverPitch_s;mPloverCue_d;mPloverLane_m;mPloverLink_a;mPloverBeat',
    });
    // The shell is a preset of the node above: construction and destruction only, no field.
    expect(node('botw-demo::plover::PloverEcho')).toMatchObject({ kind: 'class', bases: 'PloverLead', methods: 'PloverEcho;~PloverEcho', fields: '' });
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
