// W12: the third generic behaviour-node row (Backlog item 8), read by BOTH source-code techniques over ONE glob — a
// cpp-decls spec under the shared node map at the end of the cpp-decls block, and its cpp-handles twin last, both in
// the row's own catalog (vault Decisions Z-D51, Z-D52). The glob must read the row's code files and nothing else: not
// the folder's descoped build file, not a file of an earlier row, not an initial after its own, not a lower-case one,
// not the mount test's synthetic file, not a deeper folder and not a look-alike sibling folder. Every row path below is
// DERIVED from the registered specs at run time; every line of C++, every name and the one hex value in it was coined
// for this test (each checked whole-word against the reference clone before the first run: 0 hits).
import { beforeEach, describe, expect, it } from 'vitest';
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
const ROW_SPECS = DECL_SPECS.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
// Pinned to this row by position among the row specs (vault Z-D57): the third row spec, the second before it. A later
// row's spec follows this one, so "the last row spec" no longer names this row.
const SPEC = ROW_SPECS[2];
const EARLIER = ROW_SPECS[1];
const LATER = ROW_SPECS[3];
const TWIN = BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === SPEC.file)!;
const LATER_TWIN = BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === LATER.file)!;
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
// A row glob's file part: <prefix>{<initial>,…}*.{<ext>,…}
const shapeOf = (file: string) => /^([^{}*/]*)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(file.slice(FOLDER.length + 1));
const SHAPE = shapeOf(SPEC.file);
const [, PREFIX, INITIALS, EXTS] = SHAPE ?? ['', '', '', ''];
const [INITIAL] = INITIALS.split(',');
const EARLIER_INITIALS = (shapeOf(EARLIER.file)?.[2] ?? '').split(',');
const OPEN_INITIAL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((i) => BOTW.tables.every((t) => !expandGlob([`${FOLDER}/${PREFIX}${i}Probe.h`], t.file).length))!;
const rowFile = (initial: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${initial}${tail}.${ext}`;

const LEAD = { h: rowFile(INITIAL, 'mberRite', 'h'), cpp: rowFile(INITIAL, 'mberRite', 'cpp') };
const SHELL = { h: rowFile(INITIAL, 'choRite', 'h'), cpp: rowFile(INITIAL, 'choRite', 'cpp') };
const EARLIER_ROW = rowFile(EARLIER_INITIALS.at(-1)!, 'ashRite', 'h');

const FILES: Record<string, string> = {
  // A node with a scoped parameter of each kind the row uses, plus one runtime flag that carries no scope marker.
  [LEAD.h]: `
namespace demo::rite {
class EmberRite : public RiteRoot {
public:
    explicit EmberRite(const Kit& kit);
    ~EmberRite() override;
    void wakeRite(Satchel* satchel) override;
    bool onceRite() override;
    void tuneRite() override;
protected:
    // rite_fixed at offset 0x7a1e
    const float* mRiteGlow_s{};
    // rite_call at offset 0x7a1e
    int* mRiteKind_d{};
    // rite_call at offset 0x7a1e
    bool* mRiteOn_d{};
    // rite_call at offset 0x7a1e
    demo::Phrase mRiteName_d{};
    // rite_placed at offset 0x7a1e
    const int* mRiteSpan_m{};
    // rite_shared at offset 0x7a1e
    void* mRiteLink_a{};
    bool mRiteReady = false;
};
}`,
  [LEAD.cpp]: `
#include "emberRite.h"
namespace demo::rite {
EmberRite::EmberRite(const Kit& kit) : RiteRoot(kit) {}
EmberRite::~EmberRite() = default;
void EmberRite::wakeRite(Satchel* satchel) { RiteRoot::wakeRite(satchel); }
bool EmberRite::onceRite() { return RiteRoot::onceRite(); }
void EmberRite::tuneRite() { bindKnob(&mRiteGlow_s, "RiteGlow"); bindKnob(&mRiteKind_d, "RiteKind"); }
}`,
  // A shell: extends the node above, declares construction and destruction only, and carries no parameter.
  [SHELL.h]: `
namespace demo::rite {
class EchoRite : public EmberRite {
public:
    explicit EchoRite(const Kit& kit);
    ~EchoRite() override;
};
}`,
  [SHELL.cpp]: `
#include "echoRite.h"
namespace demo::rite {
EchoRite::EchoRite(const Kit& kit) : EmberRite(kit) {}
EchoRite::~EchoRite() = default;
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'wireDemoFolder(emberRite.cpp)\n',
  // Read by the EARLIER row's spec (and its handle twin, which finds no handle in it), never by this row's.
  [EARLIER_ROW]: 'namespace demo { class DashRite { int mAshPace; }; }',
  // Stay open: an initial no spec reads (the very probe that derives it, so no spec reads it by construction — W14: a
  // later row reads some lower-case continuations of that initial), a lower-case initial, another extension, the mount
  // test's synthetic file, a deeper folder, and a look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN_INITIAL, 'Probe', 'h')]: 'namespace demo { class FarRite { int mFarPace; }; }',
  [rowFile(INITIAL.toLowerCase(), 'mberDraft', 'h')]: 'namespace demo { class LowRite { int mLowPace; }; }',
  [rowFile(INITIAL, 'mberNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/demoRoveStep.h`]: 'namespace demo { class RoveStep : public StepNode { float mRoveSpan; }; }',
  [`${FOLDER}/coinedDeep/${PREFIX}${INITIAL}mberDeep.h`]: 'namespace demo { class DeepRite { int mDeepPace; }; }',
  [`${FOLDER}Draft/${PREFIX}${INITIAL}mberTwin.h`]: 'namespace demo { class TwinRite { int mTwinPace; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, SHELL.h, SHELL.cpp].sort();
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !ROW.includes(f) && f !== EARLIER_ROW && !f.endsWith('CMakeLists.txt')).sort();

describe('BOTW generic behaviour-node rows: the third row, read by both techniques (W12)', () => {
  it('ends the cpp-decls block with the row and appends its handle twin last: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(6);
    // The next row's spec directly follows this one, and this row's twin is directly followed by the next row's twin. Which
    // spec ends the cpp-decls block and which twin is last is asserted by the newest row's test (vault Z-D61).
    expect(BOTW.tables.indexOf(LATER)).toBe(BOTW.tables.indexOf(SPEC) + 1);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    expect(BOTW.tables.indexOf(LATER_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(SPEC).toMatchObject({ catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    expect(SHAPE).not.toBeNull();
    expect(shapeOf(EARLIER.file)?.[1]).toBe(PREFIX);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS.split(',')).toHaveLength(1);
    expect(INITIAL.charCodeAt(0)).toBe(EARLIER_INITIALS.at(-1)!.charCodeAt(0) + 1);
    expect(OPEN_INITIAL.charCodeAt(0)).toBeGreaterThan(INITIAL.charCodeAt(0));
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), TWIN.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([EARLIER_ROW]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the earlier row's file covered; the build file descoped; the 6 others open.
    expect(cov).toMatchObject({ total: 12, covered: 5, descoped: 1, open: 6 });
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

  describe('over a synthetic tree', () => {
    let db: Database.Database;
    let reads: string[];
    beforeEach(() => { db = new Database(':memory:'); reads = []; });
    const deps = () => ({
      db,
      readFile: (p: string) => {
        const rel = p.replace(/\\/g, '/').replace(/^clone\//, '');
        reads.push(rel);
        return FILES[rel];
      },
      listFiles: () => Object.keys(FILES),
    });

    it('wraps node and handle records from the same files, the node records byte-identical to a cpp-decls-only read, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([...ROW, EARLIER_ROW].sort());
      expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
        file: SPEC.file, catalogId: 'cutscenes', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
        file: SPEC.file, catalogId: 'cutscenes', status: 'ingested', rows: 6, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 3, refused: [] },
      });
      // 4 node records + 6 handle records of the row, and the earlier row's 1 node record.
      expect(first.store).toEqual({ created: 11, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'cutscenes' }).filter((w) => ROW.includes(w.raw.file));
      const nodes = rows.filter((w) => w.raw.kind !== 'handle');
      const handles = rows.filter((w) => w.raw.kind === 'handle');
      // The node records are exactly what cpp-decls returns on its own, file by file.
      const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
      const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
      expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
      expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
      expect(nodes.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::rite::EchoRite',
        `botw-demo::rite::EchoRite::(definitions@${SHELL.cpp})`,
        'botw-demo::rite::EmberRite',
        `botw-demo::rite::EmberRite::(definitions@${LEAD.cpp})`,
      ]);
      // The handle records come from the same header; the runtime flag with no marker is a field, never a handle.
      expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...parseCppHandles(FILES[LEAD.h], { file: LEAD.h }).rows].sort(byKey));
      expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
      expect(handles.map((w) => [w.raw.name, w.raw.marker, w.raw.typeKind])).toEqual(expect.arrayContaining([
        ['mRiteGlow_s', 'rite_fixed', 'real'], ['mRiteKind_d', 'rite_call', 'integer'], ['mRiteOn_d', 'rite_call', 'boolean'],
        ['mRiteName_d', 'rite_call', 'named'], ['mRiteSpan_m', 'rite_placed', 'integer'], ['mRiteLink_a', 'rite_shared', 'void'],
      ]));
      expect(handles.find((w) => w.raw.name === 'mRiteLink_a')!.entity.id).toBe(`botw-demo::rite::EmberRite::mRiteLink_a::(handle@${LEAD.h})`);
      const lead = nodes.find((w) => w.entity.id === 'botw-demo::rite::EmberRite')!;
      expect(lead.raw).toMatchObject({
        kind: 'class', bases: 'RiteRoot', methods: 'EmberRite;~EmberRite;wakeRite;onceRite;tuneRite',
        fields: 'mRiteGlow_s;mRiteKind_d;mRiteOn_d;mRiteName_d;mRiteSpan_m;mRiteLink_a;mRiteReady',
      });
      expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(11);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 11 });
    });
  });
});
