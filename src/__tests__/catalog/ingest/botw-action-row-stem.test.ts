// W13: the fourth generic behaviour-node row (Backlog item 8). Unlike the first three rows it is named by a STEM after the
// folder's file prefix, not by initials, so its glob is <prefix><stem>*.{h,cpp}. It is read by BOTH source-code techniques
// over that one glob — a cpp-decls spec under the shared node map at the end of the cpp-decls block, and its cpp-handles twin
// last, both in the row's own catalog (vault Decisions Z-D55, Z-D56). The glob must read the row's code files and nothing
// else: not the folder's descoped build file, not a file of an earlier row, not a file under the stem's initial whose name
// does not continue the stem, not a lower-case variant, not another extension, not the mount test's synthetic file, not a
// deeper folder and not a look-alike sibling folder. Every row path below — the prefix, the stem, the initials — is DERIVED
// from the registered specs at run time; every line of C++, every name and the one hex value in it was coined for this test
// (each checked whole-word against the reference clone before the first run: 0 hits).
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
const SHARED_DECLS = DECL_SPECS.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/'));
// The Action folder's rows, selected by PLACE (W19): the shared-map decls specs whose glob lies directly in the first one's folder; the folder specs registered after them are read by their own test.
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === dirOf(SHARED_DECLS[0].file));
const SPEC = ROW_SPECS[3];
const EARLIER = ROW_SPECS[2];
// W14: the next row's spec — the rest of the stem's initial, enumerated — follows this one (vault Z-D61).
const LATER = ROW_SPECS[4];
const TWIN = BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === SPEC.file)!;
const LATER_TWIN = BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === LATER.file)!;
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
const filePart = (file: string) => file.slice(FOLDER.length + 1);
// The earlier rows' file part: <prefix>{<initial>,…}*.{<ext>,…} — it names the folder's prefix.
const EARLIER_SHAPE = /^([^{}*/]*)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(filePart(EARLIER.file));
const [, PREFIX, EARLIER_INITIALS] = EARLIER_SHAPE ?? ['', '', ''];
const EARLIER_INITIAL = EARLIER_INITIALS.split(',').at(-1)!;
// This row's file part: <prefix><stem>*.{<ext>,…}
const SHAPE = /^([^{}*/]*)\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(filePart(SPEC.file));
const [, HEAD, EXTS] = SHAPE ?? ['', '', ''];
const STEM = HEAD.slice(PREFIX.length);
const INITIAL = STEM.slice(0, 1);
const rowFile = (tail: string, ext: string) => `${FOLDER}/${PREFIX}${STEM}${tail}.${ext}`;

const LEAD = { h: rowFile('QuillVane', 'h'), cpp: rowFile('QuillVane', 'cpp') };
const CHILD = { h: rowFile('QuillVaneSlow', 'h'), cpp: rowFile('QuillVaneSlow', 'cpp') };
const EARLIER_ROW = `${FOLDER}/${PREFIX}${EARLIER_INITIAL}veQuill.h`;
// A file under the stem's initial that does not continue the stem: since W14 the next row's spec reads it, this one never.
const NON_STEM = `${FOLDER}/${PREFIX}${INITIAL}ableQuill.h`;
// A file under the stem's initial that NO spec reads, derived from the specs: the first lower-case continuation none covers.
const OPEN_HEAD = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `${INITIAL}${c.toLowerCase()}`)
  .find((h) => BOTW.tables.every((t) => !expandGlob([`${FOLDER}/${PREFIX}${h}Quill.h`], t.file).length))!;
const OPEN_UNDER_INITIAL = `${FOLDER}/${PREFIX}${OPEN_HEAD}Quill.h`;

const FILES: Record<string, string> = {
  // A side action with a completion choice and a scoped parameter of each kind the row uses, a private helper defined out
  // of line, and one runtime flag that carries no scope marker.
  [LEAD.h]: `
namespace demo::vane {
class QuillVane : public VaneRoot {
public:
    explicit QuillVane(const Kit& kit);
    ~QuillVane() override;
    void wakeVane(Satchel* satchel) override;
    void spinVane() override;
    void restVane() override;
    void tuneVane() override;
protected:
    void settleVane();
    // vane_fixed at offset 0x5d3b
    const int* mVaneEnd_s{};
    // vane_fixed at offset 0x5d3b
    const float* mVaneSpin_s{};
    // vane_call at offset 0x5d3b
    demo::Spot* mVaneAim_d{};
    // vane_placed at offset 0x5d3b
    const float* mVaneSpan_m{};
    // vane_shared at offset 0x5d3b
    void* mVaneSlot_a{};
    // vane_shared at offset 0x5d3b
    bool* mVaneFlag_a{};
    bool mVaneBusy = false;
};
}`,
  [LEAD.cpp]: `
#include "quillVane.h"
namespace demo::vane {
QuillVane::QuillVane(const Kit& kit) : VaneRoot(kit) {}
QuillVane::~QuillVane() = default;
void QuillVane::wakeVane(Satchel* satchel) { VaneRoot::wakeVane(satchel); }
void QuillVane::spinVane() { VaneRoot::spinVane(); }
void QuillVane::restVane() { VaneRoot::restVane(); }
void QuillVane::tuneVane() { bindKnob(&mVaneEnd_s, "VaneEnd"); bindKnob(&mVaneSpin_s, "VaneSpin"); }
void QuillVane::settleVane() { if (*mVaneEnd_s == 0) markVaneDone(); }
}`,
  // A child inside the row: extends the node above (an in-row parent, named bare) and adds one tunable.
  [CHILD.h]: `
namespace demo::vane {
class QuillVaneSlow : public QuillVane {
public:
    explicit QuillVaneSlow(const Kit& kit);
    ~QuillVaneSlow() override;
    void tuneVane() override;
protected:
    // vane_fixed at offset 0x5d3b
    const float* mVaneDrag_s{};
};
}`,
  [CHILD.cpp]: `
#include "quillVaneSlow.h"
namespace demo::vane {
QuillVaneSlow::QuillVaneSlow(const Kit& kit) : QuillVane(kit) {}
QuillVaneSlow::~QuillVaneSlow() = default;
void QuillVaneSlow::tuneVane() { QuillVane::tuneVane(); bindKnob(&mVaneDrag_s, "VaneDrag"); }
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'wireDemoFolder(quillVane.cpp)\n',
  // Read by the EARLIER row's spec (and its handle twin, which finds no handle in it), never by this row's.
  [EARLIER_ROW]: 'namespace demo { class EveQuill { int mEvePace; }; }',
  // Read by the NEXT row's spec (and its handle twin, which finds no handle in it), never by this row's: it does not continue
  // the stem.
  [NON_STEM]: 'namespace demo { class FarQuill { int mFarPace; }; }',
  // Stay open: a file under the stem's initial that no spec reads, a near miss one letter short of the stem, a lower-case
  // stem, another extension, the mount test's synthetic file, a deeper folder, and a look-alike sibling folder whose name
  // starts with the row folder's name.
  [OPEN_UNDER_INITIAL]: 'namespace demo { class OpenQuill { int mOpenPace; }; }',
  [`${FOLDER}/${PREFIX}${STEM.slice(0, -1)}QuillNear.h`]: 'namespace demo { class NearQuill { int mNearPace; }; }',
  [`${FOLDER}/${PREFIX}${STEM.toLowerCase()}Quill.h`]: 'namespace demo { class LowQuill { int mLowPace; }; }',
  [rowFile('QuillNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/demoRoveStep.h`]: 'namespace demo { class RoveStep : public StepNode { float mRoveSpan; }; }',
  [`${FOLDER}/coinedDeep/${PREFIX}${STEM}QuillDeep.h`]: 'namespace demo { class DeepQuill { int mDeepPace; }; }',
  [`${FOLDER}Draft/${PREFIX}${STEM}QuillTwin.h`]: 'namespace demo { class TwinQuill { int mTwinPace; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, CHILD.h, CHILD.cpp].sort();
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !ROW.includes(f) && f !== EARLIER_ROW && f !== NON_STEM && !f.endsWith('CMakeLists.txt')).sort();

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

describe('BOTW generic behaviour-node rows: the fourth row, named by a stem, read by both techniques (W13)', () => {
  it('ends the cpp-decls block with the row and appends its handle twin last: one stem glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(10);
    // The next row's spec directly follows this one, and this row's twin is directly followed by the next row's twin. Which
    // spec ends the cpp-decls block and which twin is last is asserted by the newest row's test (vault Z-D65).
    expect(BOTW.tables.indexOf(LATER)).toBe(BOTW.tables.indexOf(SPEC) + 1);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    expect(BOTW.tables.indexOf(LATER_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The same folder and prefix as the earlier rows; a capitalised stem of more than one letter after the last earlier initial.
    expect(EARLIER_SHAPE).not.toBeNull();
    expect(SHAPE).not.toBeNull();
    expect(EARLIER.file.slice(0, EARLIER.file.lastIndexOf('/'))).toBe(FOLDER);
    expect(HEAD.startsWith(PREFIX)).toBe(true);
    expect(STEM).toMatch(/^[A-Z][a-z]+$/);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIAL.charCodeAt(0)).toBeGreaterThan(EARLIER_INITIAL.charCodeAt(0));
    // A probe needs the whole stem: the bare initial stays open, the stem is read.
    expect(expandGlob([`${FOLDER}/${PREFIX}${INITIAL}Probe.h`], SPEC.file)).toEqual([]);
    expect(expandGlob([`${FOLDER}/${PREFIX}${STEM}Probe.h`], SPEC.file)).toHaveLength(1);
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), TWIN.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([EARLIER_ROW]);
    // The non-stem file under the stem's initial is the next row's, for both techniques, and never this row's.
    expect(expandGlob(Object.keys(FILES), LATER.file)).toEqual([NON_STEM]);
    expect(expandGlob(Object.keys(FILES), LATER_TWIN.file)).toEqual([NON_STEM]);
    expect(expandGlob([NON_STEM, OPEN_UNDER_INITIAL], SPEC.file)).toEqual([]);
    expect(expandGlob([NON_STEM, OPEN_UNDER_INITIAL], TWIN.file)).toEqual([]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the earlier row's file + the next row's file covered; the build file descoped; the 7 others open.
    expect(cov).toMatchObject({ total: 14, covered: 6, descoped: 1, open: 7 });
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
    expect([...new Set(reads)].sort()).toEqual([...ROW, EARLIER_ROW, NON_STEM].sort());
    expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 7, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 2, refused: [] },
    });
    // 4 node records + 7 handle records of the row, the earlier row's 1 node record and the next row's 1.
    expect(first.store).toEqual({ created: 13, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@4')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::vane::QuillVane',
      `botw-demo::vane::QuillVane::(definitions@${LEAD.cpp})`,
      'botw-demo::vane::QuillVaneSlow',
      `botw-demo::vane::QuillVaneSlow::(definitions@${CHILD.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime flag with no
    // marker is a field, never a handle.
    const handlesOnly = [LEAD.h, CHILD.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['QuillVane', 'mVaneAim_d', 'vane_call', 'named'], ['QuillVane', 'mVaneEnd_s', 'vane_fixed', 'integer'],
      ['QuillVane', 'mVaneFlag_a', 'vane_shared', 'boolean'], ['QuillVane', 'mVaneSlot_a', 'vane_shared', 'void'],
      ['QuillVane', 'mVaneSpan_m', 'vane_placed', 'real'], ['QuillVane', 'mVaneSpin_s', 'vane_fixed', 'real'],
      ['QuillVaneSlow', 'mVaneDrag_s', 'vane_fixed', 'real'],
    ]);
    const node = (id: string) => nodes.find((w) => w.entity.id === id)!.raw;
    // The private helper is defined out of line, so it is on both of the node's records; the child names its in-row parent bare.
    expect(node('botw-demo::vane::QuillVane')).toMatchObject({
      kind: 'class', bases: 'VaneRoot', methods: 'QuillVane;~QuillVane;wakeVane;spinVane;restVane;tuneVane;settleVane',
      fields: 'mVaneEnd_s;mVaneSpin_s;mVaneAim_d;mVaneSpan_m;mVaneSlot_a;mVaneFlag_a;mVaneBusy',
    });
    expect(node(`botw-demo::vane::QuillVane::(definitions@${LEAD.cpp})`).methods.split(';').sort())
      .toEqual(node('botw-demo::vane::QuillVane').methods.split(';').sort());
    expect(node('botw-demo::vane::QuillVaneSlow')).toMatchObject({ kind: 'class', bases: 'QuillVane', fields: 'mVaneDrag_s' });
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(13);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(13);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 13 });
  });
});
