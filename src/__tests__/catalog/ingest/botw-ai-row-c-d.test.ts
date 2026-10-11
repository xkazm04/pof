// W25: the fifth row of the AI folder (Backlog item 8's AI half): TWO consecutive initials, in the brace form of the earlier AI rows'
// shape — <prefix>{<a>,<b>}*.{h,cpp}, no stem — registered directly after the fourth AI row and directly followed by the NPC's AI
// folder, which keeps the end of the cpp-decls block (vault Decisions Z-D96 (d), Z-D104, Z-D105). It is read by BOTH source-code
// techniques over that one glob — a cpp-decls spec under the shared node map and its cpp-handles twin, both in the row's own
// catalog. This is the NEWEST AI row, so its test keeps "exactly five AI rows": the guard that nothing slipped in after it (the next
// AI wave moves that to "the first five", as the fourth row's test moved). The glob must read the row's code files and nothing
// else, and must share no file with any other spec (an overlap would wrap one file twice under one id). Every path below — the AI
// folder, its prefix, its initials, the neighbour folders, the Action prefix — is DERIVED from the registered specs at run time, and
// the row is pinned by POSITION (the spec directly after the fourth AI row), never by "last" and never by an absolute index. This
// is the third row wrapped since the run-level parent pass: a child under this row names a parent of another AI row, bare, and the
// pass links it. Every line of C++, every name and the one hex value in it was coined for this test.
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
// Pinned to this row by position: the AI rows registered before it are the first four (each pinned by its own test), and this row
// is the spec directly after the fourth one. The NPC's AI folder is found by its FOLDER.
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const FIRST_AI = AI_ROWS[0];
const SECOND_AI = AI_ROWS[1];
const THIRD_AI = AI_ROWS[2];
const PREV = AI_ROWS[3];
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
type Spec = (typeof BOTW.tables)[number];
const initialsOf = (spec: Spec) => (AI_SHAPE.exec(filePart(spec.file))?.[2] ?? '').split(',');
const PREV_INITIALS = initialsOf(PREV);
const EARLIER_INITIALS = [FIRST_AI, SECOND_AI, THIRD_AI].flatMap(initialsOf);
const SECOND_AI_INITIALS = initialsOf(SECOND_AI);
const FIRST = INITIALS[0];
const LAST = INITIALS.at(-1)!;
const letterAfter = (c: string, step: number) => String.fromCharCode(c.charCodeAt(0) + step);
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const aiFile = (head: string, tail: string, ext: string, dir = AI_DIR) => `${dir}/${PREFIX}${head}${tail}.${ext}`;
const actionFile = (head: string, tail: string, ext: string) => `${ACTION_DIR}/${ACTION_PREFIX}${head}${tail}.${ext}`;
const readersOf = (probe: string, specs: readonly Spec[] = BOTW.tables) => specs.filter((s) => expandGlob([probe], s.file).length);

// The specs registered BEFORE this row, per technique (by registration order, so rows registered later never move a count):
// every cpp-decls spec before it and every cpp-handles spec before its twin.
const BEFORE = [...DECL_SPECS.slice(0, DECL_SPECS.indexOf(SPEC)), ...HANDLE_SPECS.slice(0, HANDLE_SPECS.indexOf(TWIN))];
const THROUGH = [...BEFORE, SPEC, TWIN];
const LOWER_NB = letterAfter(FIRST, -1);
const UPPER_NB = letterAfter(LAST, 1);

// The Action folder's alternatives that begin with one of this row's initials: each names files read by exactly one Action row.
const ACTION_ALTS = [...new Set(ROW_SPECS.flatMap((s) => actionAlts(s.file)).filter((a) => INITIALS.some((c) => a.startsWith(c))))];

const LEAD = { h: aiFile(FIRST, 'QuillhavenLead', 'h'), cpp: aiFile(FIRST, 'QuillhavenLead', 'cpp') };
const KIN = { h: aiFile(LAST, 'QuillhavenKin', 'h'), cpp: aiFile(LAST, 'QuillhavenKin', 'cpp') };
const TRAIL = { h: aiFile(LAST, 'QuillhavenTrail', 'h'), cpp: aiFile(LAST, 'QuillhavenTrail', 'cpp') };
// A node of the PREVIOUS AI row (under its first initial) that the node of this row above names as its parent, bare.
const ELDER = aiFile(PREV_INITIALS[0], 'QuillhavenElder', 'h');
// Read by other specs: the Action folder's files under the same initials, and a camera AI file.
const ACTION_FILES = ACTION_ALTS.map((alt) => actionFile(alt, 'QuillhavenEcho', 'h'));
const CAMERA_AI = aiFile(FIRST, 'QuillhavenCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node under the first initial with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter; its
  // parent is named nowhere.
  [LEAD.h]: `
namespace demo::quillhaven {
class QuillhavenLead : public QuillhavenRoot {
public:
    explicit QuillhavenLead(const Kit& kit);
    ~QuillhavenLead() override;
    bool pluckQuillhaven() override;
    void wakeQuillhaven(Satchel* satchel) override;
    void strumQuillhaven() override;
    void tuneQuillhaven() override;
protected:
    // quillhaven_fixed at offset 0x4b93
    const float* mQuillhavenPitch_s{};
    // quillhaven_call at offset 0x4b93
    demo::Verse mQuillhavenCue_d{};
    // quillhaven_placed at offset 0x4b93
    const int* mQuillhavenLane_m{};
    // quillhaven_shared at offset 0x4b93
    void* mQuillhavenLink_a{};
    float mQuillhavenBeat;
};
}`,
  [LEAD.cpp]: `
#include "quillhavenLead.h"
namespace demo::quillhaven {
QuillhavenLead::QuillhavenLead(const Kit& kit) : QuillhavenRoot(kit) {}
QuillhavenLead::~QuillhavenLead() = default;
bool QuillhavenLead::pluckQuillhaven() { return QuillhavenRoot::pluckQuillhaven(); }
void QuillhavenLead::wakeQuillhaven(Satchel* satchel) { QuillhavenRoot::wakeQuillhaven(satchel); }
void QuillhavenLead::strumQuillhaven() { QuillhavenRoot::strumQuillhaven(); }
void QuillhavenLead::tuneQuillhaven() { bindPeg(&mQuillhavenPitch_s, "QuillhavenPitch"); bindPeg(&mQuillhavenCue_d, "QuillhavenCue"); }
}`,
  // A node under the last initial whose parent is the lead above (a node under the first initial), named bare: the in-row link
  // across the two initials.
  [TRAIL.h]: `
namespace demo::quillhaven {
class QuillhavenTrail : public QuillhavenLead {
public:
    explicit QuillhavenTrail(const Kit& kit);
    ~QuillhavenTrail() override = default;
    void tuneQuillhaven() override;
protected:
    // quillhaven_fixed at offset 0x4b93
    const bool* mQuillhavenMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "quillhavenTrail.h"
namespace demo::quillhaven {
QuillhavenTrail::QuillhavenTrail(const Kit& kit) : QuillhavenLead(kit) {}
void QuillhavenTrail::tuneQuillhaven() { QuillhavenLead::tuneQuillhaven(); bindPeg(&mQuillhavenMute_s, "QuillhavenMute"); }
}`,
  // A node under the last initial whose parent lives in ANOTHER AI row (the elder below), named bare: the cross-row link.
  [KIN.h]: `
namespace demo::quillhaven {
class QuillhavenKin : public QuillhavenElder {
public:
    explicit QuillhavenKin(const Kit& kit);
    void tuneQuillhaven() override;
protected:
    // quillhaven_call at offset 0x4b93
    demo::Verse mQuillhavenRing_d{};
};
}`,
  [KIN.cpp]: `
#include "quillhavenKin.h"
namespace demo::quillhaven {
QuillhavenKin::QuillhavenKin(const Kit& kit) : QuillhavenElder(kit) {}
void QuillhavenKin::tuneQuillhaven() { QuillhavenElder::tuneQuillhaven(); bindPeg(&mQuillhavenRing_d, "QuillhavenRing"); }
}`,
  [ELDER]: `
namespace demo::quillhaven {
class QuillhavenElder {
public:
    int mElderPeg;
};
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listQuillhavenFiles(quillhavenLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initials, the initial directly above this
  // row's last (the SECOND AI row's), the initial directly below its first (open to nobody through this row) and a file in the
  // camera's AI folder.
  ...Object.fromEntries(ACTION_FILES.map((f, i) => [f, `namespace demo { class EchoQuillhaven${i} { int mEchoPeg; }; }`])),
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class UpNbQuillhaven { int mUpNbPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class CamQuillhaven { int mCamPeg; }; }',
  // Stay unread by this row: the neighbouring initial below (probe; as the matcher decides who else reads it), a lower-case
  // initial, another extension, a deeper folder, a look-alike sibling folder, the NPC's AI folder (read by its own spec), and an
  // AI-prefixed file of the first initial directly in the AI folder's parent.
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class LowNbQuillhaven { int mLowNbPeg; }; }',
  [aiFile(FIRST.toLowerCase(), 'QuillhavenLow', 'h')]: 'namespace demo { class LowQuillhaven { int mLowPeg; }; }',
  [aiFile(FIRST, 'QuillhavenNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}QuillhavenDeep.h`]: 'namespace demo { class DeepQuillhaven { int mDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}QuillhavenTwin.h`]: 'namespace demo { class TwinQuillhaven { int mTwinPeg; }; }',
  [aiFile(FIRST, 'QuillhavenNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class NpcQuillhaven { int mNpcPeg; }; }',
  [aiFile(FIRST, 'QuillhavenNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { void NpcQuillhaven::hum() {} }',
  [aiFile(FIRST, 'QuillhavenUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class UpQuillhaven { int mUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, KIN.h, KIN.cpp, TRAIL.h, TRAIL.cpp].sort();
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

describe('BOTW AI behaviour-node rows: the fifth row, two initials, read by both techniques (W25)', () => {
  it('is the fifth AI row: directly after the fourth AI row\'s spec and directly followed by the NPC\'s AI folder spec; its twin likewise: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS).toHaveLength(5); // exactly five AI row specs: the guard that nothing slipped in after this row (a later AI row moves this to "the first five")
    expect(AI_ROWS).toEqual([FIRST_AI, SECOND_AI, THIRD_AI, PREV, SPEC]);
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(SHARED_DECLS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the NPC's AI folder (it ends the block)
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.length - 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(PREV_TWIN) + 1);
    expect(BOTW.tables.indexOf(NPC_AI_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(BOTW.tables.at(-1)).toBe(NPC_AI_TWIN); // the NPC's AI twin stays last of the table
    expect(dirOf(NPC_AI_SPEC.file)).toBe(NPC_AI_DIR); // the next spec is the NPC's AI folder, not a sixth AI row
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The two-initial brace shape: a prefix other than the Action folder's, two consecutive capitals, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    for (const row of [FIRST_AI, SECOND_AI, THIRD_AI, PREV]) expect(PREFIX).toBe(AI_SHAPE.exec(filePart(row.file))?.[1]);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(2);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(FIRST).toMatch(/^[A-Z]$/);
    expect(filePart(SPEC.file)).toBe(`${PREFIX}{${INITIAL_LIST}}*.{${EXTS}}`);
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
    // A one-letter initial also reads every longer name that begins with it; derive how many names that is (here no Action
    // alternative is longer than a row initial, so it is the initials themselves) and keep the instrument able to fail: it reads some.
    const underInitials = names.filter((n) => INITIALS.some((c) => n.startsWith(c)));
    expect(underInitials.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const [specs, own] of [[DECL_SPECS, SPEC], [HANDLE_SPECS, TWIN]] as const) {
      const read = expandGlob(probes, own.file);
      expect([...read].sort()).toEqual(probes.filter(mine).sort()); // the row reads exactly the probes under its initials …
      expect(read.length).toBe(underInitials.length * EXTS.split(',').length); // … and the instrument can fail: it reads some
      expect(read.length).toBeGreaterThan(0);
      for (const f of probes) {
        const readers = specs.filter((s) => expandGlob([f], s.file).length);
        expect(readers.length).toBeLessThanOrEqual(1);
        if (mine(f)) expect(readers).toEqual([own]);
      }
      // The neighbours really read probes of their own: the Action rows in the Action folder, the earlier AI rows in the AI folder.
      for (const row of ROW_SPECS) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
      for (const row of [FIRST_AI, SECOND_AI, THIRD_AI, PREV]) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
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
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'QuillhavenLow', 'h'),
      aiFile(FIRST, 'QuillhavenNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}QuillhavenDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}QuillhavenTwin.h`,
      aiFile(FIRST, 'QuillhavenNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'QuillhavenNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ...ACTION_FILES,
      aiFile(FIRST, 'QuillhavenUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under these initials are read by exactly one Action row each (not by this row); the camera file by the
    // camera spec; the fourth AI row's file by exactly that row's spec and twin; the initial directly above (the second AI row's)
    // by exactly that row's spec and twin; the initial directly below by nobody registered through this row.
    expect(ACTION_FILES.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const f of ACTION_FILES) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    expect(readersOf(ELDER)).toEqual([PREV, PREV_TWIN]);
    expect(SECOND_AI_INITIALS).toContain(UPPER_NB);
    expect(readersOf(aiFile(UPPER_NB, 'Probe', 'h'), THROUGH)).toEqual([SECOND_AI, twinOf(SECOND_AI.file)]);
    expect(readersOf(aiFile(LOWER_NB, 'Probe', 'h'), THROUGH)).toEqual([]);
    expect(readersOf(aiFile(FIRST, 'QuillhavenNpc', 'h', NPC_AI_DIR))).toEqual([NPC_AI_SPEC, NPC_AI_TWIN]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 6 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(ROW.length);
  });

  it('the AI folder\'s open initials: with the first four AI rows closed, every other initial is open before this row, and exactly its two initials too are closed with it; the initial directly below stays open', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    const CLOSED_BEFORE = [...EARLIER_INITIALS, ...PREV_INITIALS];
    expect(CLOSED_BEFORE).toHaveLength(9);
    expect(openInitials(BEFORE)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c)));
    expect(openInitials(BEFORE)).toHaveLength(UPPER.length - 9);
    expect(openInitials(THROUGH)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c) && !INITIALS.includes(c)));
    expect(openInitials(THROUGH)).toHaveLength(UPPER.length - 9 - INITIALS.length);
    // The neighbours: the initial directly below FIRST stays open through this row (no spec registered through it reads it); the
    // one directly above LAST is the second AI row's, closed before this row and read by exactly its spec and twin.
    for (const ext of EXTS.split(',')) {
      expect(readersOf(aiFile(LOWER_NB, 'Probe', ext), THROUGH)).toEqual([]);
      expect(readersOf(aiFile(UPPER_NB, 'Probe', ext), THROUGH)).toEqual([SECOND_AI, twinOf(SECOND_AI.file)]);
    }
    expect(CLOSED_BEFORE).toContain(UPPER_NB);
    expect(CLOSED_BEFORE).not.toContain(LOWER_NB);
    expect(INITIALS).not.toContain(LOWER_NB);
    expect(INITIALS).not.toContain(UPPER_NB);
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
      'botw-demo::quillhaven::QuillhavenKin',
      `botw-demo::quillhaven::QuillhavenKin::(definitions@${KIN.cpp})`,
      'botw-demo::quillhaven::QuillhavenLead',
      `botw-demo::quillhaven::QuillhavenLead::(definitions@${LEAD.cpp})`,
      'botw-demo::quillhaven::QuillhavenTrail',
      `botw-demo::quillhaven::QuillhavenTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the three headers, exactly as cpp-handles reads them on its own; the runtime counter is no handle.
    const handlesOnly = [LEAD.h, KIN.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['QuillhavenKin', 'mQuillhavenRing_d', 'quillhaven_call', 'named'],
      ['QuillhavenLead', 'mQuillhavenCue_d', 'quillhaven_call', 'named'], ['QuillhavenLead', 'mQuillhavenLane_m', 'quillhaven_placed', 'integer'],
      ['QuillhavenLead', 'mQuillhavenLink_a', 'quillhaven_shared', 'void'], ['QuillhavenLead', 'mQuillhavenPitch_s', 'quillhaven_fixed', 'real'],
      ['QuillhavenTrail', 'mQuillhavenMute_s', 'quillhaven_fixed', 'boolean'],
    ]);
    const all = listWrappers(db, { sourceId: 'botw' });
    const wrapper = (id: string) => all.find((w) => w.entity.id === id)!;
    const node = (id: string) => wrapper(id).raw;
    expect(node('botw-demo::quillhaven::QuillhavenLead')).toMatchObject({
      kind: 'class', bases: 'QuillhavenRoot', methods: 'QuillhavenLead;~QuillhavenLead;pluckQuillhaven;wakeQuillhaven;strumQuillhaven;tuneQuillhaven',
      fields: 'mQuillhavenPitch_s;mQuillhavenCue_d;mQuillhavenLane_m;mQuillhavenLink_a;mQuillhavenBeat',
    });
    // The in-row link across the two initials: the node under the last initial names its parent (a node under the first
    // initial) bare; a destructor defaulted in the header leaves the definition without it.
    expect(node('botw-demo::quillhaven::QuillhavenTrail')).toMatchObject({ kind: 'class', bases: 'QuillhavenLead', fields: 'mQuillhavenMute_s' });
    expect(node(`botw-demo::quillhaven::QuillhavenTrail::(definitions@${TRAIL.cpp})`)).toMatchObject({ methods: 'QuillhavenTrail;tuneQuillhaven' });
    // The parent pass: the in-row child links to its parent, the cross-row child links to the fourth AI row's node (the raw base
    // stays as written), and a parent no record answers stays an explicit marker, never a guessed link.
    expect(wrapper('botw-demo::quillhaven::QuillhavenTrail').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::quillhaven::QuillhavenLead', role: 'extends' }]);
    expect(wrapper('botw-demo::quillhaven::QuillhavenKin').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::quillhaven::QuillhavenElder', role: 'extends' }]);
    expect(node('botw-demo::quillhaven::QuillhavenKin')).toMatchObject({ bases: 'QuillhavenElder' });
    expect(wrapper('botw-demo::quillhaven::QuillhavenLead').entity.links ?? []).toEqual([]);
    expect(wrapper('botw-demo::quillhaven::QuillhavenLead').entity.data).toMatchObject({ unresolvedLinks: [{ role: 'extends', ref: 'QuillhavenRoot' }] });
    expect(first.links.unresolved.filter((u) => u.ref === 'QuillhavenRoot')).toHaveLength(1);
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
