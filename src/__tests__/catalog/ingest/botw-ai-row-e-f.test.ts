// W21: the second row of the AI folder (Backlog item 8's AI half): TWO consecutive initials in the brace form of the first AI row's
// shape — <prefix>{<a>,<b>}*.{h,cpp}, no stem — registered directly after the first AI row and directly followed by the NPC's AI
// folder, which ends the cpp-decls block (vault Decisions Z-D93, Z-D94). It is read by BOTH source-code techniques over that one
// glob — a cpp-decls spec under the shared node map and its cpp-handles twin, both in the row's own catalog. The glob must read the
// row's code files and nothing else, and must share no file with any other spec (an overlap would wrap one file twice under one
// id). Every path below — the AI folder, its prefix, its initials, the neighbour folders, the Action prefix — is DERIVED from the
// registered specs at run time, and the row is pinned by POSITION among the shared-map decls specs (the Action rows, the two
// folders, the first AI row, then this one), never by "last" and never by its folder; every line of C++, every name and the one hex
// value in it was coined for this test.
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
// The Action folder's rows, selected by PLACE (the first shared-map decls spec's folder), and the camera's own folders: the AI
// folder is the camera's second folder name, beside the Action folder (derived; no path literal).
const ACTION_DIR = dirOf(SHARED_DECLS[0].file);
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === ACTION_DIR);
const CAMERA_DIRS = [...new Set(BOTW.tables.filter((t) => t.map === CAMERA_SHOT_NODE_MAP).map((t) => t.file.slice(0, t.file.indexOf('/**'))))];
const SIBLING_NAME = CAMERA_DIRS.map((d) => d.slice(d.lastIndexOf('/') + 1)).find((n) => n !== ACTION_DIR.slice(ACTION_DIR.lastIndexOf('/') + 1))!;
const AI_DIR = `${dirOf(ACTION_DIR)}/${SIBLING_NAME}`;
const CAMERA_AI_DIR = CAMERA_DIRS.find((d) => d.endsWith(`/${SIBLING_NAME}`))!;
// Pinned to this row by position: after the Action rows come the two folders, the first AI row directly after them and this row
// directly after that one. The spec directly after this row is the next AI row (a later wave's), and the NPC's AI folder is found by
// its FOLDER, never by an absolute index (a later AI row registers before it and moves its index).
const NPC_SPEC = SHARED_DECLS[ROW_SPECS.length + 1];
const PREV = SHARED_DECLS[ROW_SPECS.length + 2];
const PREV_TWIN = twinOf(PREV.file);
const SPEC = SHARED_DECLS[ROW_SPECS.length + 3];
const TWIN = twinOf(SPEC.file);
const NEXT = DECL_SPECS[DECL_SPECS.indexOf(SPEC) + 1];
const NEXT_TWIN = twinOf(NEXT.file);
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const NPC_AI_DIR = `${dirOf(dirOf(NPC_SPEC.file))}/${SIBLING_NAME}`;
const NPC_AI_SPEC = SHARED_DECLS.find((t) => dirOf(t.file) === NPC_AI_DIR)!;
const NPC_AI_TWIN = twinOf(NPC_AI_SPEC.file);
const filePart = (file: string) => file.slice(dirOf(file).length + 1);
// An AI row glob's file part: <prefix>{<initial>,…}*.{<ext>,…}; the Action rows' alternatives are capital and lower-case letters.
const AI_SHAPE = /^([a-z]+)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const ACTION_SHAPE = /^([a-z]+)(?:\{([A-Z][a-z]*(?:,[A-Z][a-z]*)*)\}|([A-Z][a-z]+))\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const actionAlts = (file: string) => { const m = ACTION_SHAPE.exec(filePart(file)); return m ? (m[2] ? m[2].split(',') : [m[3]]) : []; };
const ACTION_PREFIX = ACTION_SHAPE.exec(filePart(ROW_SPECS[0].file))?.[1] ?? '';
const SHAPE = AI_SHAPE.exec(filePart(SPEC.file));
const [, PREFIX, INITIAL_LIST, EXTS] = SHAPE ?? ['', '', '', ''];
const INITIALS = (INITIAL_LIST ?? '').split(',');
const PREV_INITIALS = (AI_SHAPE.exec(filePart(PREV.file))?.[2] ?? '').split(',');
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

// The Action folder's alternatives that begin with one of this row's initials: each names files read by exactly one Action row.
const ACTION_ALTS = [...new Set(ROW_SPECS.flatMap((s) => actionAlts(s.file)).filter((a) => INITIALS.some((c) => a.startsWith(c))))];

const LEAD = { h: aiFile(FIRST, 'KestrelLead', 'h'), cpp: aiFile(FIRST, 'KestrelLead', 'cpp') };
const TRAIL = { h: aiFile(LAST, 'KestrelTrail', 'h'), cpp: aiFile(LAST, 'KestrelTrail', 'cpp') };
// Read by other specs: the Action folder's files under the same initials (one file per alternative), and a camera AI file.
const ACTION_FILES = ACTION_ALTS.map((alt) => actionFile(alt, 'KestrelEcho', 'h'));
const CAMERA_AI = aiFile(FIRST, 'KestrelCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter.
  [LEAD.h]: `
namespace demo::kestrel {
class KestrelLead : public KestrelRoot {
public:
    explicit KestrelLead(const Kit& kit);
    ~KestrelLead() override;
    bool pluckKestrel() override;
    void wakeKestrel(Satchel* satchel) override;
    void strumKestrel() override;
    void tuneKestrel() override;
protected:
    // kestrel_fixed at offset 0x71c4
    const float* mKestrelPitch_s{};
    // kestrel_call at offset 0x71c4
    demo::Verse mKestrelCue_d{};
    // kestrel_placed at offset 0x71c4
    const int* mKestrelLane_m{};
    // kestrel_shared at offset 0x71c4
    void* mKestrelLink_a{};
    float mKestrelBeat;
};
}`,
  [LEAD.cpp]: `
#include "kestrelLead.h"
namespace demo::kestrel {
KestrelLead::KestrelLead(const Kit& kit) : KestrelRoot(kit) {}
KestrelLead::~KestrelLead() = default;
bool KestrelLead::pluckKestrel() { return KestrelRoot::pluckKestrel(); }
void KestrelLead::wakeKestrel(Satchel* satchel) { KestrelRoot::wakeKestrel(satchel); }
void KestrelLead::strumKestrel() { KestrelRoot::strumKestrel(); }
void KestrelLead::tuneKestrel() { bindPeg(&mKestrelPitch_s, "KestrelPitch"); bindPeg(&mKestrelCue_d, "KestrelCue"); }
}`,
  // A node under the last initial whose parent is the lead above (a node under the first initial), named bare.
  [TRAIL.h]: `
namespace demo::kestrel {
class KestrelTrail : public KestrelLead {
public:
    explicit KestrelTrail(const Kit& kit);
    ~KestrelTrail() override = default;
    void tuneKestrel() override;
protected:
    // kestrel_fixed at offset 0x71c4
    const bool* mKestrelMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "kestrelTrail.h"
namespace demo::kestrel {
KestrelTrail::KestrelTrail(const Kit& kit) : KestrelLead(kit) {}
void KestrelTrail::tuneKestrel() { KestrelLead::tuneKestrel(); bindPeg(&mKestrelMute_s, "KestrelMute"); }
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listKestrelFiles(kestrelLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initials (E and the F alternatives), the
  // first AI row's initial directly above this row's last (it is open to nobody else), and a file in the camera's AI folder.
  ...Object.fromEntries(ACTION_FILES.map((f, i) => [f, `namespace demo { class EchoKestrel${i} { int mEchoPeg; }; }`])),
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class UpNbKestrel { int mUpNbPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class CamKestrel { int mCamPeg; }; }',
  // Stay unread by this row: the neighbouring initial below (probe; as the matcher decides who else reads it), a lower-case
  // initial, another extension, a deeper folder, a look-alike sibling folder, the NPC's AI folder (read by its own spec), and an
  // AI-prefixed file of the first initial directly in the AI folder's parent.
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class LowNbKestrel { int mLowNbPeg; }; }',
  [aiFile(FIRST.toLowerCase(), 'KestrelLow', 'h')]: 'namespace demo { class LowKestrel { int mLowPeg; }; }',
  [aiFile(FIRST, 'KestrelNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}KestrelDeep.h`]: 'namespace demo { class DeepKestrel { int mDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}KestrelTwin.h`]: 'namespace demo { class TwinKestrel { int mTwinPeg; }; }',
  [aiFile(FIRST, 'KestrelNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class NpcKestrel { int mNpcPeg; }; }',
  [aiFile(FIRST, 'KestrelNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { void NpcKestrel::hum() {} }',
  [aiFile(FIRST, 'KestrelUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class UpKestrel { int mUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, TRAIL.h, TRAIL.cpp].sort();
const ALL = Object.keys(FILES);
// Files another spec reads, as the matcher decides (rows registered later may read a neighbour probe; the count follows).
const readByOthers = (f: string) => BOTW.tables.some((s) => s !== SPEC && s !== TWIN && expandGlob([f], s.file).length);
const COVERED_ELSEWHERE = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && readByOthers(f)).sort();
const STAY_OPEN = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && !readByOthers(f)).sort();

/** Every name that could sit on a border: every letter in both cases and every Action alternative, in every neighbour folder. */
function borderProbes(): { all: string[]; inRow: string[]; names: string[] } {
  const names = [...new Set([...UPPER, ...LOWER, ...ROW_SPECS.flatMap((s) => actionAlts(s.file))])];
  const exts = EXTS.split(',');
  const inRow = names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext)));
  const others = [dirOf(AI_DIR), NPC_AI_DIR, ...CAMERA_DIRS, `${AI_DIR}/coinedDeep`, `${AI_DIR}Draft`];
  const outside = others.flatMap((d) => names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext, d))));
  const action = names.flatMap((n) => exts.map((ext) => actionFile(n, 'Probe', ext)));
  const actionWithAiPrefix = names.flatMap((n) => exts.map((ext) => aiFile(n, 'Probe', ext, ACTION_DIR)));
  return { all: [...inRow, ...outside, ...action, ...actionWithAiPrefix], inRow, names };
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

describe('BOTW AI behaviour-node rows: the second row, two initials, read by both techniques (W21)', () => {
  it('is the second AI row: directly after the first AI row\'s spec and directly followed by the next AI row\'s spec; its twin likewise: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS.slice(0, 2)).toEqual([PREV, SPEC]); // the first two AI row specs are the first AI row then this one (later rows follow)
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(SHARED_DECLS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(NEXT)).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the next AI row's spec (the NPC's AI folder keeps the end of the block)
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(PREV_TWIN) + 1);
    expect(BOTW.tables.indexOf(NEXT_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1); // directly followed by the next AI row's twin
    expect(AI_ROWS[2]).toBe(NEXT); // the next spec is the third AI row, in the AI folder
    expect(dirOf(NEXT.file)).toBe(AI_DIR);
    expect(dirOf(NPC_AI_SPEC.file)).toBe(NPC_AI_DIR); // the NPC's AI folder is found by its folder, after every AI row
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The multi-initial shape: a prefix other than the Action folder's, several consecutive capitals, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    expect(PREFIX).toBe(AI_SHAPE.exec(filePart(PREV.file))?.[1]);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(2);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(FIRST).toMatch(/^[A-Z]$/);
    expect(AI_DIR).not.toBe(ACTION_DIR);
    expect(AI_DIR).not.toBe(CAMERA_AI_DIR);
    expect(AI_DIR).not.toBe(NPC_AI_DIR);
  });

  it('shares no file with any other spec: no other glob can reach the AI folder\'s prefix under these initials, and no border probe is read by two specs', () => {
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
    const { all: probes, inRow, names } = borderProbes();
    const mine = (f: string) => INITIALS.some((c) => f.startsWith(`${AI_DIR}/${PREFIX}${c}`));
    // A one-letter initial also reads every longer name that begins with it (the Action rows' multi-letter alternatives among them).
    const underInitials = names.filter((n) => INITIALS.some((c) => n.startsWith(c)));
    expect(underInitials.length).toBeGreaterThan(INITIALS.length);
    for (const [specs, own] of [[DECL_SPECS, SPEC], [HANDLE_SPECS, TWIN]] as const) {
      const read = expandGlob(probes, own.file);
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initials …
      expect(read.length).toBe(underInitials.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // The neighbours really read probes of their own: the Action rows in the Action folder, the first AI row in the AI folder.
      for (const row of ROW_SPECS) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
      expect(expandGlob(probes, specs === DECL_SPECS ? PREV.file : PREV_TWIN.file).length).toBeGreaterThan(0);
    }
    expect(inRow.length).toBeGreaterThan(INITIALS.length);
    const cameraAiProbes = probes.filter((f) => f.startsWith(`${CAMERA_AI_DIR}/`));
    expect(cameraAiProbes.length).toBeGreaterThan(0);
    expect(cameraAiProbes.filter((f) => BOTW.tables.some((s) => s.map === CAMERA_SHOT_NODE_MAP && expandGlob([f], s.file).length)).length).toBeGreaterThan(0);
    // The NPC's AI folder really reads probes of its own (the folder glob has no initial and no stem).
    expect(expandGlob(probes.filter((f) => f.startsWith(`${NPC_AI_DIR}/`)), NPC_AI_SPEC.file).length).toBeGreaterThan(0);
    // Over the fixture tree too, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of ALL) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(ALL, SPEC.file)).toEqual(ROW);
    expect(expandGlob(ALL, TWIN.file)).toEqual(ROW);
    // Not the AI build file, the initial directly below or above, a lower-case variant, another extension, a deeper or look-alike
    // folder, the NPC's AI folder, the camera's AI folder, the Action folder's files under these initials, or the parent folder's file.
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'KestrelLow', 'h'),
      aiFile(FIRST, 'KestrelNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}KestrelDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}KestrelTwin.h`,
      aiFile(FIRST, 'KestrelNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'KestrelNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ...ACTION_FILES,
      aiFile(FIRST, 'KestrelUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under these initials are read by exactly one Action row each (not by this row); the camera file by the
    // camera spec; the initial above (the first AI row's) by exactly that row's spec and twin; the initial below by nobody.
    expect(ACTION_FILES.length).toBeGreaterThan(INITIALS.length); // the F alternatives are split across several Action rows
    for (const f of ACTION_FILES) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    expect(readersOf(aiFile(UPPER_NB, 'Probe', 'h'))).toEqual([PREV, PREV_TWIN]);
    expect(readersOf(aiFile(LOWER_NB, 'Probe', 'h'), THROUGH)).toEqual([]);
    expect(readersOf(aiFile(FIRST, 'KestrelNpc', 'h', NPC_AI_DIR))).toEqual([NPC_AI_SPEC, NPC_AI_TWIN]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(4);
  });

  it('the AI folder\'s open initials: with the first AI row closed, every other initial is open before this row, and exactly its initials too are closed with it', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    expect(openInitials(BEFORE)).toEqual(UPPER.filter((c) => !PREV_INITIALS.includes(c)));
    expect(openInitials(THROUGH)).toEqual(UPPER.filter((c) => !PREV_INITIALS.includes(c) && !INITIALS.includes(c)));
    expect(openInitials(THROUGH)).toHaveLength(UPPER.length - PREV_INITIALS.length - INITIALS.length);
    // The neighbours: the initial directly below FIRST stays open through this row, for both techniques (no spec registered through
    // this row reads it); the one directly above LAST is the first AI row's, read by exactly its spec and twin.
    for (const ext of EXTS.split(',')) {
      expect(readersOf(aiFile(LOWER_NB, 'Probe', ext), THROUGH)).toEqual([]);
      expect(readersOf(aiFile(UPPER_NB, 'Probe', ext), THROUGH)).toEqual([PREV, PREV_TWIN]);
    }
    expect(INITIALS).not.toContain(LOWER_NB);
    expect(INITIALS).not.toContain(UPPER_NB);
    expect(PREV_INITIALS).toContain(UPPER_NB);
    expect(openInitials(THROUGH)).toContain(LOWER_NB);
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
    expect(nodes.every((w) => w.technique === 'cpp-decls@4')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::kestrel::KestrelLead',
      `botw-demo::kestrel::KestrelLead::(definitions@${LEAD.cpp})`,
      'botw-demo::kestrel::KestrelTrail',
      `botw-demo::kestrel::KestrelTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['KestrelLead', 'mKestrelCue_d', 'kestrel_call', 'named'], ['KestrelLead', 'mKestrelLane_m', 'kestrel_placed', 'integer'],
      ['KestrelLead', 'mKestrelLink_a', 'kestrel_shared', 'void'], ['KestrelLead', 'mKestrelPitch_s', 'kestrel_fixed', 'real'],
      ['KestrelTrail', 'mKestrelMute_s', 'kestrel_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::kestrel::KestrelLead')).toMatchObject({
      kind: 'class', bases: 'KestrelRoot', methods: 'KestrelLead;~KestrelLead;pluckKestrel;wakeKestrel;strumKestrel;tuneKestrel',
      fields: 'mKestrelPitch_s;mKestrelCue_d;mKestrelLane_m;mKestrelLink_a;mKestrelBeat',
    });
    // The in-row link across the two initials: the node under the last initial names its parent (a node under the first initial)
    // bare. A destructor defaulted in the header leaves the definition without it.
    expect(node('botw-demo::kestrel::KestrelTrail')).toMatchObject({ kind: 'class', bases: 'KestrelLead', fields: 'mKestrelMute_s' });
    expect(node(`botw-demo::kestrel::KestrelTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'KestrelTrail;tuneKestrel' });
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
