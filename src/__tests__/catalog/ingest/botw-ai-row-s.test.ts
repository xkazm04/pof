// W23: the third row of the AI folder (Backlog item 8's AI half): ONE initial, in the brace form of the earlier AI rows' shape —
// <prefix>{<a>}*.{h,cpp}, no stem — registered directly after the second AI row and directly followed by the NPC's AI folder, which
// keeps the end of the cpp-decls block (vault Decisions Z-D96 (d), Z-D99). It is read by BOTH source-code techniques over that one
// glob — a cpp-decls spec under the shared node map and its cpp-handles twin, both in the row's own catalog. The glob must read the
// row's code files and nothing else, and must share no file with any other spec (an overlap would wrap one file twice under one
// id). Every path below — the AI folder, its prefix, its initial, the neighbour folders, the Action prefix — is DERIVED from the
// registered specs at run time, and the row is pinned by POSITION (the spec directly after the second AI row), never by "last" and
// never by an absolute index. This is also the first row wrapped since the run-level parent pass: a child under this row names a
// parent of another AI row, bare, and the pass links it. Every line of C++, every name and the one hex value in it was coined for
// this test.
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
const NPC_SPEC = SHARED_DECLS[ROW_SPECS.length + 1];
const NPC_AI_DIR = `${dirOf(dirOf(NPC_SPEC.file))}/${SIBLING_NAME}`;
const NPC_AI_SPEC = SHARED_DECLS.find((t) => dirOf(t.file) === NPC_AI_DIR)!;
const NPC_AI_TWIN = twinOf(NPC_AI_SPEC.file);
// Pinned to this row by position: the AI rows registered before it are the first two (both pinned by their own tests), and this
// row is the spec directly after the second one. The NPC's AI folder is found by its FOLDER.
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const FIRST_AI = AI_ROWS[0];
const PREV = AI_ROWS[1];
const PREV_TWIN = twinOf(PREV.file);
const SPEC = DECL_SPECS[DECL_SPECS.indexOf(PREV) + 1];
const TWIN = twinOf(SPEC.file);
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
const FIRST_AI_INITIALS = (AI_SHAPE.exec(filePart(FIRST_AI.file))?.[2] ?? '').split(',');
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

// The Action folder's alternatives that begin with this row's initial: each names files read by exactly one Action row.
const ACTION_ALTS = [...new Set(ROW_SPECS.flatMap((s) => actionAlts(s.file)).filter((a) => INITIALS.some((c) => a.startsWith(c))))];

const LEAD = { h: aiFile(FIRST, 'WrenfallLead', 'h'), cpp: aiFile(FIRST, 'WrenfallLead', 'cpp') };
const TRAIL = { h: aiFile(FIRST, 'WrenfallTrail', 'h'), cpp: aiFile(FIRST, 'WrenfallTrail', 'cpp') };
const KIN = { h: aiFile(FIRST, 'WrenfallKin', 'h'), cpp: aiFile(FIRST, 'WrenfallKin', 'cpp') };
// A node of the PREVIOUS AI row (under its first initial) that the node of this row above names as its parent, bare.
const ELDER = aiFile(PREV_INITIALS[0], 'WrenfallElder', 'h');
// Read by other specs: the Action folder's files under the same initial (one file per alternative), and a camera AI file.
const ACTION_FILES = ACTION_ALTS.map((alt) => actionFile(alt, 'WrenfallEcho', 'h'));
const CAMERA_AI = aiFile(FIRST, 'WrenfallCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter; its parent is named nowhere.
  [LEAD.h]: `
namespace demo::wrenfall {
class WrenfallLead : public WrenfallRoot {
public:
    explicit WrenfallLead(const Kit& kit);
    ~WrenfallLead() override;
    bool pluckWrenfall() override;
    void wakeWrenfall(Satchel* satchel) override;
    void strumWrenfall() override;
    void tuneWrenfall() override;
protected:
    // wrenfall_fixed at offset 0x5a9e
    const float* mWrenfallPitch_s{};
    // wrenfall_call at offset 0x5a9e
    demo::Verse mWrenfallCue_d{};
    // wrenfall_placed at offset 0x5a9e
    const int* mWrenfallLane_m{};
    // wrenfall_shared at offset 0x5a9e
    void* mWrenfallLink_a{};
    float mWrenfallBeat;
};
}`,
  [LEAD.cpp]: `
#include "wrenfallLead.h"
namespace demo::wrenfall {
WrenfallLead::WrenfallLead(const Kit& kit) : WrenfallRoot(kit) {}
WrenfallLead::~WrenfallLead() = default;
bool WrenfallLead::pluckWrenfall() { return WrenfallRoot::pluckWrenfall(); }
void WrenfallLead::wakeWrenfall(Satchel* satchel) { WrenfallRoot::wakeWrenfall(satchel); }
void WrenfallLead::strumWrenfall() { WrenfallRoot::strumWrenfall(); }
void WrenfallLead::tuneWrenfall() { bindPeg(&mWrenfallPitch_s, "WrenfallPitch"); bindPeg(&mWrenfallCue_d, "WrenfallCue"); }
}`,
  // A node of the same row whose parent is the lead above, named bare: the in-row link.
  [TRAIL.h]: `
namespace demo::wrenfall {
class WrenfallTrail : public WrenfallLead {
public:
    explicit WrenfallTrail(const Kit& kit);
    ~WrenfallTrail() override = default;
    void tuneWrenfall() override;
protected:
    // wrenfall_fixed at offset 0x5a9e
    const bool* mWrenfallMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "wrenfallTrail.h"
namespace demo::wrenfall {
WrenfallTrail::WrenfallTrail(const Kit& kit) : WrenfallLead(kit) {}
void WrenfallTrail::tuneWrenfall() { WrenfallLead::tuneWrenfall(); bindPeg(&mWrenfallMute_s, "WrenfallMute"); }
}`,
  // A node of this row whose parent lives in ANOTHER AI row (the elder below), named bare: the cross-row link.
  [KIN.h]: `
namespace demo::wrenfall {
class WrenfallKin : public WrenfallElder {
public:
    explicit WrenfallKin(const Kit& kit);
    void tuneWrenfall() override;
protected:
    // wrenfall_call at offset 0x5a9e
    demo::Verse mWrenfallRing_d{};
};
}`,
  [KIN.cpp]: `
#include "wrenfallKin.h"
namespace demo::wrenfall {
WrenfallKin::WrenfallKin(const Kit& kit) : WrenfallElder(kit) {}
void WrenfallKin::tuneWrenfall() { WrenfallElder::tuneWrenfall(); bindPeg(&mWrenfallRing_d, "WrenfallRing"); }
}`,
  [ELDER]: `
namespace demo::wrenfall {
class WrenfallElder {
public:
    int mElderPeg;
};
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listWrenfallFiles(wrenfallLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initial, the previous AI row's initial
  // directly below this row's, the next initial above (open to nobody through this row) and a file in the camera's AI folder.
  ...Object.fromEntries(ACTION_FILES.map((f, i) => [f, `namespace demo { class EchoWrenfall${i} { int mEchoPeg; }; }`])),
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class UpNbWrenfall { int mUpNbPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class CamWrenfall { int mCamPeg; }; }',
  // Stay unread by this row: the neighbouring initial below, a lower-case initial, another extension, a deeper folder, a
  // look-alike sibling folder, the NPC's AI folder (read by its own spec), and an AI-prefixed file of the initial directly in the
  // AI folder's parent.
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class LowNbWrenfall { int mLowNbPeg; }; }',
  [aiFile(FIRST.toLowerCase(), 'WrenfallLow', 'h')]: 'namespace demo { class LowWrenfall { int mLowPeg; }; }',
  [aiFile(FIRST, 'WrenfallNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}WrenfallDeep.h`]: 'namespace demo { class DeepWrenfall { int mDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}WrenfallTwin.h`]: 'namespace demo { class TwinWrenfall { int mTwinPeg; }; }',
  [aiFile(FIRST, 'WrenfallNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class NpcWrenfall { int mNpcPeg; }; }',
  [aiFile(FIRST, 'WrenfallNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { void NpcWrenfall::hum() {} }',
  [aiFile(FIRST, 'WrenfallUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class UpWrenfall { int mUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, TRAIL.h, TRAIL.cpp, KIN.h, KIN.cpp].sort();
const ALL = Object.keys(FILES);
// Files another spec reads, as the matcher decides (rows registered later may read a neighbour probe; the count follows).
const readByOthers = (f: string) => BOTW.tables.some((s) => s !== SPEC && s !== TWIN && expandGlob([f], s.file).length);
const COVERED_ELSEWHERE = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && readByOthers(f)).sort();
const STAY_OPEN = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && !readByOthers(f)).sort();
// 6 node records (class + definition per node) and 6 handle records of the row.
const ROW_RECORDS = 6 + 6;

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

describe('BOTW AI behaviour-node rows: the third row, one initial, read by both techniques (W23)', () => {
  it('is the third AI row: directly after the second AI row\'s spec and directly followed by the NPC\'s AI folder spec; its twin likewise: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS).toHaveLength(3); // exactly three AI row specs so far: the first, the second, then this one (a later AI row moves this)
    expect(AI_ROWS).toEqual([FIRST_AI, PREV, SPEC]);
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(SHARED_DECLS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the NPC's AI folder (it ends the block)
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.length - 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(PREV_TWIN) + 1);
    expect(BOTW.tables.indexOf(NPC_AI_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(BOTW.tables.at(-1)).toBe(NPC_AI_TWIN); // the NPC's AI twin stays last of the table
    expect(dirOf(NPC_AI_SPEC.file)).toBe(NPC_AI_DIR); // the next spec is the NPC's AI folder, not a fourth AI row
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The one-initial brace shape: a prefix other than the Action folder's, ONE capital, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    expect(PREFIX).toBe(AI_SHAPE.exec(filePart(PREV.file))?.[1]);
    expect(PREFIX).toBe(AI_SHAPE.exec(filePart(FIRST_AI.file))?.[1]);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(1);
    expect(FIRST).toMatch(/^[A-Z]$/);
    expect(filePart(SPEC.file)).toBe(`${PREFIX}{${FIRST}}*.{${EXTS}}`); // the brace form is kept even with one initial
    expect(AI_DIR).not.toBe(ACTION_DIR);
    expect(AI_DIR).not.toBe(CAMERA_AI_DIR);
    expect(AI_DIR).not.toBe(NPC_AI_DIR);
  });

  it('shares no file with any other spec: no other glob can reach the AI folder\'s prefix under this initial, and no border probe is read by two specs', () => {
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
    // A one-letter initial also reads every longer name that begins with it; derive how many names that is (here no Action
    // alternative is longer than the initial, so it is the initial itself) and keep the instrument able to fail: it reads some.
    const underInitials = names.filter((n) => INITIALS.some((c) => n.startsWith(c)));
    expect(underInitials.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const [specs, own] of [[DECL_SPECS, SPEC], [HANDLE_SPECS, TWIN]] as const) {
      const read = expandGlob(probes, own.file);
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initial …
      expect(read.length).toBe(underInitials.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      expect(read.length).toBeGreaterThan(0);
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // The neighbours really read probes of their own: the Action rows in the Action folder, the earlier AI rows in the AI folder.
      for (const row of ROW_SPECS) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
      for (const row of [FIRST_AI, PREV]) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
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
    // Not the AI build file, the initials directly below or above (R, T), a lower-case variant, another extension, a deeper or
    // look-alike folder, the NPC's AI folder, the camera's AI folder, the Action folder's files under this initial, or the
    // parent folder's file.
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'WrenfallLow', 'h'),
      aiFile(FIRST, 'WrenfallNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}WrenfallDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}WrenfallTwin.h`,
      aiFile(FIRST, 'WrenfallNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'WrenfallNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ...ACTION_FILES,
      aiFile(FIRST, 'WrenfallUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under this initial are read by exactly one Action row each (not by this row); the camera file by the
    // camera spec; the previous AI row's file by exactly that row's spec and twin; the initials below and above by nobody
    // registered through this row.
    expect(ACTION_FILES.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const f of ACTION_FILES) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    expect(readersOf(ELDER)).toEqual([PREV, PREV_TWIN]);
    expect(readersOf(aiFile(LOWER_NB, 'Probe', 'h'), THROUGH)).toEqual([]);
    expect(readersOf(aiFile(UPPER_NB, 'Probe', 'h'), THROUGH)).toEqual([]);
    expect(readersOf(aiFile(FIRST, 'WrenfallNpc', 'h', NPC_AI_DIR))).toEqual([NPC_AI_SPEC, NPC_AI_TWIN]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 6 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(ROW.length);
  });

  it('the AI folder\'s open initials: with the first two AI rows closed, every other initial is open before this row, and this row\'s initial too is closed with it; the initials directly below and above stay open', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    const CLOSED_BEFORE = [...FIRST_AI_INITIALS, ...PREV_INITIALS];
    expect(CLOSED_BEFORE).toHaveLength(4);
    expect(openInitials(BEFORE)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c)));
    expect(openInitials(BEFORE)).toHaveLength(UPPER.length - 4);
    expect(openInitials(THROUGH)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c) && !INITIALS.includes(c)));
    expect(openInitials(THROUGH)).toHaveLength(UPPER.length - 4 - INITIALS.length);
    // The neighbours: the initials directly below and above stay open through this row, for both techniques.
    for (const ext of EXTS.split(',')) {
      expect(readersOf(aiFile(LOWER_NB, 'Probe', ext), THROUGH)).toEqual([]);
      expect(readersOf(aiFile(UPPER_NB, 'Probe', ext), THROUGH)).toEqual([]);
    }
    expect(openInitials(THROUGH)).toContain(LOWER_NB);
    expect(openInitials(THROUGH)).toContain(UPPER_NB);
    expect(CLOSED_BEFORE).not.toContain(LOWER_NB);
    expect(CLOSED_BEFORE).not.toContain(UPPER_NB);
    // The instrument can fail: a probe at this row's initial is read by exactly this row's spec and twin.
    for (const c of INITIALS) for (const ext of EXTS.split(',')) expect(readersOf(aiFile(c, 'Probe', ext))).toEqual([SPEC, TWIN]);
  });

  it('both maps classify every column of their technique', () => {
    for (const [columns, map] of [[CPP_RECORD_COLUMNS, SPEC.map], [CPP_HANDLE_COLUMNS, TWIN.map]] as const) {
      const audit = auditColumns([...columns], map);
      expect(audit.unclassified).toEqual([]);
      expect(audit.declaredButAbsent).toEqual([]);
    }
  });

  it('wraps node and handle records from the same files, the node records byte-identical to a cpp-decls-only read, and links the parents', () => {
    const db = new Database(':memory:');
    const reads: string[] = [];
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, reads));
    expect([...new Set(reads)].sort()).toEqual([...ROW, ...COVERED_ELSEWHERE].sort());
    expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 6, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 6, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 6, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 6, withoutRecords: 3, refused: [] },
    });
    // 6 node records + 6 handle records of the row, and one node record from each file another spec reads.
    expect(first.store).toEqual({ created: ROW_RECORDS + COVERED_ELSEWHERE.length, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::wrenfall::WrenfallKin',
      `botw-demo::wrenfall::WrenfallKin::(definitions@${KIN.cpp})`,
      'botw-demo::wrenfall::WrenfallLead',
      `botw-demo::wrenfall::WrenfallLead::(definitions@${LEAD.cpp})`,
      'botw-demo::wrenfall::WrenfallTrail',
      `botw-demo::wrenfall::WrenfallTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the three headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, TRAIL.h, KIN.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['WrenfallKin', 'mWrenfallRing_d', 'wrenfall_call', 'named'],
      ['WrenfallLead', 'mWrenfallCue_d', 'wrenfall_call', 'named'], ['WrenfallLead', 'mWrenfallLane_m', 'wrenfall_placed', 'integer'],
      ['WrenfallLead', 'mWrenfallLink_a', 'wrenfall_shared', 'void'], ['WrenfallLead', 'mWrenfallPitch_s', 'wrenfall_fixed', 'real'],
      ['WrenfallTrail', 'mWrenfallMute_s', 'wrenfall_fixed', 'boolean'],
    ]);
    const all = listWrappers(db, { sourceId: 'botw' });
    const wrapper = (id: string) => all.find((w) => w.entity.id === id)!;
    const node = (id: string) => wrapper(id).raw;
    expect(node('botw-demo::wrenfall::WrenfallLead')).toMatchObject({
      kind: 'class', bases: 'WrenfallRoot', methods: 'WrenfallLead;~WrenfallLead;pluckWrenfall;wakeWrenfall;strumWrenfall;tuneWrenfall',
      fields: 'mWrenfallPitch_s;mWrenfallCue_d;mWrenfallLane_m;mWrenfallLink_a;mWrenfallBeat',
    });
    // The in-row link: the node under this initial names its parent (another node of this row) bare; a destructor defaulted in the
    // header leaves the definition without it.
    expect(node('botw-demo::wrenfall::WrenfallTrail')).toMatchObject({ kind: 'class', bases: 'WrenfallLead', fields: 'mWrenfallMute_s' });
    expect(node(`botw-demo::wrenfall::WrenfallTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'WrenfallTrail;tuneWrenfall' });
    // The parent pass: the in-row child links to its parent, the cross-row child links to the previous AI row's node (the raw base
    // stays as written), and a parent no record answers stays an explicit marker, never a guessed link.
    expect(wrapper('botw-demo::wrenfall::WrenfallTrail').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::wrenfall::WrenfallLead', role: 'extends' }]);
    expect(wrapper('botw-demo::wrenfall::WrenfallKin').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::wrenfall::WrenfallElder', role: 'extends' }]);
    expect(node('botw-demo::wrenfall::WrenfallKin')).toMatchObject({ bases: 'WrenfallElder' });
    expect(wrapper('botw-demo::wrenfall::WrenfallLead').entity.links ?? []).toEqual([]);
    expect(wrapper('botw-demo::wrenfall::WrenfallLead').entity.data).toMatchObject({ unresolvedLinks: [{ role: 'extends', ref: 'WrenfallRoot' }] });
    expect(first.links.unresolved.filter((u) => u.ref === 'WrenfallRoot')).toHaveLength(1);
    expect(new Set(all.map((w) => w.entity.id)).size).toBe(ROW_RECORDS + COVERED_ELSEWHERE.length);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(ROW_RECORDS + COVERED_ELSEWHERE.length);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: ROW_RECORDS + COVERED_ELSEWHERE.length });
  });
});
