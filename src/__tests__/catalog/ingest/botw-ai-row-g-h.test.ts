// W20: the first row of the AI folder (Backlog item 8's AI half): TWO consecutive initials in the brace form of the Action rows'
// shape, with the AI file prefix — <prefix>{<a>,<b>}*.{h,cpp}, no stem — registered after the two Action-library folders
// (vault Decisions Z-D89, Z-D90; W21 registered the second AI row and the NPC's AI folder after it, Z-D93). It is read by BOTH source-code techniques over that one glob — a
// cpp-decls spec under the shared node map and its cpp-handles twin, both in the row's own catalog. The glob must read the
// row's code files and nothing else, and must share no file with any other spec (an overlap would wrap one file twice under
// one id). Every path below — the AI folder, its prefix, its initials, the neighbour folders, the Action prefix — is DERIVED from
// the registered specs at run time, and the row is pinned by POSITION (the first shared-map decls spec after the Action rows
// and the two folders), never by "last"; every line of C++, every name and the one hex value in it was coined for this test.
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, CAMERA_SHOT_NODE_MAP, PARAMETER_HANDLE_MAP } from '@/lib/catalog/ingest/botw';
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
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
// The Action folder's rows, selected by PLACE (the first shared-map decls spec's folder), and the camera's own folders: the
// AI folder is the camera's second folder name, beside the Action folder (derived; no path literal).
const ACTION_DIR = dirOf(SHARED_DECLS[0].file);
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === ACTION_DIR);
const CAMERA_DIRS = [...new Set(BOTW.tables.filter((t) => t.map === CAMERA_SHOT_NODE_MAP).map((t) => t.file.slice(0, t.file.indexOf('/**'))))];
const SIBLING_NAME = CAMERA_DIRS.map((d) => d.slice(d.lastIndexOf('/') + 1)).find((n) => n !== ACTION_DIR.slice(ACTION_DIR.lastIndexOf('/') + 1))!;
const AI_DIR = `${dirOf(ACTION_DIR)}/${SIBLING_NAME}`;
const CAMERA_AI_DIR = CAMERA_DIRS.find((d) => d.endsWith(`/${SIBLING_NAME}`))!;
// Pinned to this row by position: after the Action rows come the two folders, and the first AI row directly after them.
const FOLDER_SPECS = [SHARED_DECLS[ROW_SPECS.length], SHARED_DECLS[ROW_SPECS.length + 1]];
const NPC_SPEC = FOLDER_SPECS[1];
const NPC_TWIN = twinOf(NPC_SPEC.file);
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const SPEC = SHARED_DECLS[ROW_SPECS.length + 2];
const TWIN = twinOf(SPEC.file);
const NPC_AI_DIR = `${dirOf(dirOf(NPC_SPEC.file))}/${SIBLING_NAME}`;
const filePart = (file: string) => file.slice(dirOf(file).length + 1);
// An AI row glob's file part: <prefix>{<initial>,…}*.{<ext>,…}; the Action rows' alternatives are capital and lower-case letters.
const AI_SHAPE = /^([a-z]+)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const ACTION_SHAPE = /^([a-z]+)(?:\{([A-Z][a-z]*(?:,[A-Z][a-z]*)*)\}|([A-Z][a-z]+))\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const actionAlts = (file: string) => { const m = ACTION_SHAPE.exec(filePart(file)); return m ? (m[2] ? m[2].split(',') : [m[3]]) : []; };
const ACTION_PREFIX = ACTION_SHAPE.exec(filePart(ROW_SPECS[0].file))?.[1] ?? '';
const SHAPE = AI_SHAPE.exec(filePart(SPEC.file));
const [, PREFIX, INITIAL_LIST, EXTS] = SHAPE ?? ['', '', '', ''];
const INITIALS = (INITIAL_LIST ?? '').split(',');
const FIRST = INITIALS[0];
const LAST = INITIALS.at(-1)!;
const letterAfter = (c: string, step: number) => String.fromCharCode(c.charCodeAt(0) + step);
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const aiFile = (head: string, tail: string, ext: string, dir = AI_DIR) => `${dir}/${PREFIX}${head}${tail}.${ext}`;
const actionFile = (head: string, tail: string, ext: string) => `${ACTION_DIR}/${ACTION_PREFIX}${head}${tail}.${ext}`;
type Spec = (typeof BOTW.tables)[number];
const readersOf = (probe: string, specs: readonly Spec[] = BOTW.tables) => specs.filter((s) => expandGlob([probe], s.file).length);

// The specs registered BEFORE this row, per technique (by registration order, so rows registered later never move a count):
// every cpp-decls spec before it and every cpp-handles spec before its twin.
const BEFORE = [...DECL_SPECS.slice(0, DECL_SPECS.indexOf(SPEC)), ...HANDLE_SPECS.slice(0, HANDLE_SPECS.indexOf(TWIN))];
const THROUGH = [...BEFORE, SPEC, TWIN];
const LOWER_NB = letterAfter(FIRST, -1);
const UPPER_NB = letterAfter(LAST, 1);

const LEAD = { h: aiFile(FIRST, 'TapirLead', 'h'), cpp: aiFile(FIRST, 'TapirLead', 'cpp') };
const TRAIL = { h: aiFile(LAST, 'TapirTrail', 'h'), cpp: aiFile(LAST, 'TapirTrail', 'cpp') };
// Read by other specs: the Action folder's files under the same two initials, and a file in the camera's AI folder.
const ACTION_FIRST = actionFile(FIRST, 'TapirEcho', 'h');
const ACTION_LAST = actionFile(LAST, 'TapirHarp', 'h');
const CAMERA_AI = aiFile(FIRST, 'TapirCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter.
  [LEAD.h]: `
namespace demo::tapir {
class TapirLead : public TapirRoot {
public:
    explicit TapirLead(const Kit& kit);
    ~TapirLead() override;
    bool pluckTapir() override;
    void wakeTapir(Satchel* satchel) override;
    void strumTapir() override;
    void tuneTapir() override;
protected:
    // tapir_fixed at offset 0x5e71
    const float* mTapirPitch_s{};
    // tapir_call at offset 0x5e71
    demo::Verse mTapirCue_d{};
    // tapir_placed at offset 0x5e71
    const int* mTapirLane_m{};
    // tapir_shared at offset 0x5e71
    void* mTapirLink_a{};
    float mTapirBeat;
};
}`,
  [LEAD.cpp]: `
#include "tapirLead.h"
namespace demo::tapir {
TapirLead::TapirLead(const Kit& kit) : TapirRoot(kit) {}
TapirLead::~TapirLead() = default;
bool TapirLead::pluckTapir() { return TapirRoot::pluckTapir(); }
void TapirLead::wakeTapir(Satchel* satchel) { TapirRoot::wakeTapir(satchel); }
void TapirLead::strumTapir() { TapirRoot::strumTapir(); }
void TapirLead::tuneTapir() { bindPeg(&mTapirPitch_s, "TapirPitch"); bindPeg(&mTapirCue_d, "TapirCue"); }
}`,
  // A node under the last initial whose parent is the lead above, named bare.
  [TRAIL.h]: `
namespace demo::tapir {
class TapirTrail : public TapirLead {
public:
    explicit TapirTrail(const Kit& kit);
    ~TapirTrail() override = default;
    void tuneTapir() override;
protected:
    // tapir_fixed at offset 0x5e71
    const bool* mTapirMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "tapirTrail.h"
namespace demo::tapir {
TapirTrail::TapirTrail(const Kit& kit) : TapirLead(kit) {}
void TapirTrail::tuneTapir() { TapirLead::tuneTapir(); bindPeg(&mTapirMute_s, "TapirMute"); }
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listTapirFiles(tapirLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initials, and the camera's AI folder.
  [ACTION_FIRST]: 'namespace demo { class EchoTapir { int mEchoPeg; }; }',
  [ACTION_LAST]: 'namespace demo { class HarpTapir { int mHarpPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class CamTapir { int mCamPeg; }; }',
  // Stay unread by this row: the neighbouring initials below and above (probes, as the matcher decides who else reads them), a
  // lower-case initial, another extension, a deeper folder, a look-alike sibling folder, the NPC's AI folder, and an AI-prefixed
  // file of the first initial directly in the AI folder's parent.
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class LowNbTapir { int mLowNbPeg; }; }',
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class UpNbTapir { int mUpNbPeg; }; }',
  [aiFile(FIRST.toLowerCase(), 'TapirLow', 'h')]: 'namespace demo { class LowTapir { int mLowPeg; }; }',
  [aiFile(FIRST, 'TapirNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}TapirDeep.h`]: 'namespace demo { class DeepTapir { int mDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}TapirTwin.h`]: 'namespace demo { class TwinTapir { int mTwinPeg; }; }',
  [aiFile(FIRST, 'TapirNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class NpcTapir { int mNpcPeg; }; }',
  [aiFile(FIRST, 'TapirNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { class NpcTapirSrc { int mNpcPeg; }; }',
  [aiFile(FIRST, 'TapirUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class UpTapir { int mUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, TRAIL.h, TRAIL.cpp].sort();
const ALL = Object.keys(FILES);
// Files another spec reads, as the matcher decides (rows registered later may read a neighbour probe; the count follows).
const readByOthers = (f: string) => BOTW.tables.some((s) => s !== SPEC && s !== TWIN && expandGlob([f], s.file).length);
const COVERED_ELSEWHERE = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && readByOthers(f)).sort();
const STAY_OPEN = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && !readByOthers(f)).sort();

/** Every name that could sit on a border: every letter in both cases and every Action alternative, in every neighbour folder. */
function borderProbes(): { all: string[]; inRow: string[] } {
  const names = [...new Set([...UPPER, ...LOWER, ...ROW_SPECS.flatMap((s) => actionAlts(s.file))])];
  const exts = EXTS.split(',');
  const inRow = names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext)));
  const others = [dirOf(AI_DIR), NPC_AI_DIR, ...CAMERA_DIRS, `${AI_DIR}/coinedDeep`, `${AI_DIR}Draft`];
  const outside = others.flatMap((d) => names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext, d))));
  const action = names.flatMap((n) => exts.map((ext) => actionFile(n, 'Probe', ext)));
  const actionWithAiPrefix = names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext, ACTION_DIR)));
  return { all: [...inRow, ...outside, ...action, ...actionWithAiPrefix], inRow };
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

/** The AI folder's initials no spec of `specs` reads (a bare probe per capital). */
const openInitials = (specs: readonly Spec[]) => UPPER.filter((c) => !readersOf(aiFile(c, 'Probe', 'h'), specs).length);

describe('BOTW AI behaviour-node rows: the first row, two initials, read by both techniques (W20)', () => {
  it('sits directly after the NPC folder spec and is directly followed by the second AI row\'s spec; its twin directly after the NPC twin and directly followed by the second row\'s twin: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS[0]).toBe(SPEC); // the first AI row spec (W21: a second AI row follows; its wave moved the 'exactly one' claim)
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(ROW_SPECS.length + FOLDER_SPECS.length);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(NPC_SPEC) + 1);
    expect(DECL_SPECS.indexOf(AI_ROWS[1])).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the next AI row (it no longer ends the block)
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(NPC_TWIN) + 1);
    expect(BOTW.tables.indexOf(twinOf(AI_ROWS[1].file))).toBe(BOTW.tables.indexOf(TWIN) + 1); // directly followed by the next AI row's twin (no longer last)
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The multi-initial shape: a prefix other than the Action folder's, several consecutive capitals, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(2);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(FIRST).toMatch(/^[A-Z]$/);
    expect(AI_DIR).not.toBe(ACTION_DIR);
    expect(AI_DIR).not.toBe(CAMERA_AI_DIR);
    expect(AI_DIR).not.toBe(NPC_AI_DIR);
  });

  it('shares no file with any other spec: no other glob can reach the AI folder\'s prefix, and no border probe is read by two specs', () => {
    // By argument. Two globs read a common file only if their literal prefixes (up to the first wildcard or brace) are compatible,
    // one beginning the other. Every other spec's prefix is incompatible with this row's — except a spec of the same folder and
    // prefix (another AI row), whose initials must then be disjoint and begin no one another.
    const MINE = `${AI_DIR}/${PREFIX}`;
    const literal = (g: string) => g.slice(0, g.search(/[*{]/));
    for (const s of BOTW.tables.filter((t) => t !== SPEC && t !== TWIN)) {
      const lit = literal(s.file);
      if (lit === MINE) {
        const other = AI_SHAPE.exec(filePart(s.file));
        for (const a of INITIALS) for (const b of (other?.[2] ?? '').split(',')) { expect(a.startsWith(b)).toBe(false); expect(b.startsWith(a)).toBe(false); }
      } else {
        expect(lit.startsWith(MINE) || MINE.startsWith(lit)).toBe(false);
      }
    }
    // By probes: every letter in both cases and every Action alternative, in the AI folder and in each neighbour folder.
    const { all: probes, inRow } = borderProbes();
    const mine = (f: string) => INITIALS.some((c) => f.startsWith(`${AI_DIR}/${PREFIX}${c}`));
    for (const [specs, own] of [[DECL_SPECS, SPEC], [HANDLE_SPECS, TWIN]] as const) {
      const read = expandGlob(probes, own.file);
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initials …
      expect(read.length).toBe(INITIALS.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // The neighbours really read probes of their own: the Action rows in the Action folder, the camera spec in its AI folder.
      for (const row of ROW_SPECS) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
    }
    expect(inRow.length).toBeGreaterThan(INITIALS.length);
    const cameraAiProbes = probes.filter((f) => f.startsWith(`${CAMERA_AI_DIR}/`));
    expect(cameraAiProbes.length).toBeGreaterThan(0);
    expect(cameraAiProbes.filter((f) => BOTW.tables.some((s) => s.map === CAMERA_SHOT_NODE_MAP && expandGlob([f], s.file).length)).length).toBeGreaterThan(0);
    // Over the fixture tree too, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of ALL) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(ALL, SPEC.file)).toEqual(ROW);
    expect(expandGlob(ALL, TWIN.file)).toEqual(ROW);
    // Not the AI build file, a neighbouring initial, a lower-case variant, another extension, a deeper or look-alike folder, the
    // NPC's AI folder, the camera's AI folder, the Action folder's files under the same initials, or the parent folder's file.
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'TapirLow', 'h'),
      aiFile(FIRST, 'TapirNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}TapirDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}TapirTwin.h`,
      aiFile(FIRST, 'TapirNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'TapirNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ACTION_FIRST, ACTION_LAST,
      aiFile(FIRST, 'TapirUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under the same initials are read by exactly one Action row each (not by this row); the camera file by the camera spec.
    for (const f of [ACTION_FIRST, ACTION_LAST]) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(4);
  });

  it('the AI folder\'s open initials: every initial is open without this row, and exactly its initials are closed with it', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    expect(openInitials(BEFORE)).toEqual(UPPER);
    expect(openInitials(THROUGH)).toEqual(UPPER.filter((c) => !INITIALS.includes(c)));
    // The neighbours stay open through this row: the initial directly below FIRST and the one directly above LAST, for both
    // techniques, and not a single spec registered through this row reads either probe.
    for (const nb of [LOWER_NB, UPPER_NB]) {
      for (const ext of EXTS.split(',')) expect(readersOf(aiFile(nb, 'Probe', ext), THROUGH)).toEqual([]);
    }
    expect(INITIALS).not.toContain(LOWER_NB);
    expect(INITIALS).not.toContain(UPPER_NB);
    // The instrument can fail: a probe at each of this row's initials is read by exactly this row's spec and twin.
    for (const c of INITIALS) for (const ext of EXTS.split(',')) expect(readersOf(aiFile(c, 'Probe', ext))).toEqual([SPEC, TWIN]);
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
    expect([...new Set(reads)].sort()).toEqual([...ROW, ...COVERED_ELSEWHERE].sort());
    expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 5, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 2, refused: [] },
    });
    // 4 node records + 5 handle records of the row, and one node record from each file another spec reads.
    expect(first.store).toEqual({ created: 9 + COVERED_ELSEWHERE.length, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::tapir::TapirLead',
      `botw-demo::tapir::TapirLead::(definitions@${LEAD.cpp})`,
      'botw-demo::tapir::TapirTrail',
      `botw-demo::tapir::TapirTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['TapirLead', 'mTapirCue_d', 'tapir_call', 'named'], ['TapirLead', 'mTapirLane_m', 'tapir_placed', 'integer'],
      ['TapirLead', 'mTapirLink_a', 'tapir_shared', 'void'], ['TapirLead', 'mTapirPitch_s', 'tapir_fixed', 'real'],
      ['TapirTrail', 'mTapirMute_s', 'tapir_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::tapir::TapirLead')).toMatchObject({
      kind: 'class', bases: 'TapirRoot', methods: 'TapirLead;~TapirLead;pluckTapir;wakeTapir;strumTapir;tuneTapir',
      fields: 'mTapirPitch_s;mTapirCue_d;mTapirLane_m;mTapirLink_a;mTapirBeat',
    });
    // The in-row link: the trail names its parent bare. A destructor defaulted in the header leaves the definition without it.
    expect(node('botw-demo::tapir::TapirTrail')).toMatchObject({ kind: 'class', bases: 'TapirLead', fields: 'mTapirMute_s' });
    expect(node(`botw-demo::tapir::TapirTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'TapirTrail;tuneTapir' });
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(9 + COVERED_ELSEWHERE.length);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(9 + COVERED_ELSEWHERE.length);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 9 + COVERED_ELSEWHERE.length });
  });
});
