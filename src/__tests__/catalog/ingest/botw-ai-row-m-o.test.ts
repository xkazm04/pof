// W29: the ninth and LAST row of the AI folder (Backlog item 8's AI half): THREE consecutive initials, in the brace form of the
// earlier AI rows' shape — <prefix>{<a>,<b>,<c>}*.{h,cpp}, no stem — registered directly after the eighth AI row and directly
// followed by the NPC's AI folder, which keeps the end of the cpp-decls block (vault Decisions Z-D96 (d), Z-D116). It is read by
// BOTH source-code techniques over that one glob — a cpp-decls spec under the shared node map and its cpp-handles twin, both in the
// row's own catalog. This is the NEWEST AI row, so its test keeps "exactly nine AI rows": the guard that nothing slipped in after it.
// The glob must read the row's code files and nothing else, and must share no file with any other spec (an overlap would wrap one
// file twice under one id). Every path below — the AI folder, its prefix, its initials, the neighbour folders, the Action prefix —
// is DERIVED from the registered specs at run time, and the row is pinned by POSITION (the spec directly after the eighth AI row),
// never by "last" and never by an absolute index. This is the seventh row wrapped since the run-level parent pass: a child under
// this row names a parent of another AI row, bare, and the pass links it. FIRSTS OF THIS ROW: it closes the LAST open capital
// initial of the AI folder, so the set of open initials through it is EMPTY (asserted with the repo's matcher; the lower-case
// initials stay open, which the folders test's derived open initial relies on); EVERY one of its three initials names files, so a
// coined file under each is read by both specs; and BOTH neighbours are read by rows registered EARLIER (the lower one by the
// fourth AI row's pair, the upper one by the eighth's), so both neighbour probes are matcher-derived readers, not open initials.
// The row needs no same-name pair and no fixture for its big node family or its tree-shared handles. Every line of C++, every name
// and the one hex value in it was coined for this test.
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
// Pinned to this row by position: the AI rows registered before it are the first eight (each pinned by its own test), and this row
// is the spec directly after the eighth one. The NPC's AI folder is found by its FOLDER.
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const EARLIER_ROWS = AI_ROWS.slice(0, 7);
const PREV = AI_ROWS[7];
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
const EARLIER_INITIALS = EARLIER_ROWS.flatMap(initialsOf);
const FIRST = INITIALS[0];
const MIDDLE = INITIALS[1];
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
// The row sits inside the alphabet and both neighbours are read by EARLIER rows: the initial directly BELOW the first by the row
// that owns it, the initial directly ABOVE the last by the eighth AI row.
const LOWER_NB = letterAfter(FIRST, -1);
const UPPER_NB = letterAfter(LAST, 1);
const BELOW_ROW = EARLIER_ROWS.find((s) => initialsOf(s).includes(LOWER_NB))!;
const BELOW_TWIN = twinOf(BELOW_ROW?.file ?? ''); // (a misplaced row must fail an assertion, not crash the module load)

// The Action folder's alternatives that begin with one of this row's initials: each names files read by exactly one Action row.
const ACTION_ALTS = [...new Set(ROW_SPECS.flatMap((s) => actionAlts(s.file)).filter((a) => INITIALS.some((c) => a.startsWith(c))))];

// One node under EACH of the three initials (every one names files in the reference): the lead under the first, a node under the
// middle one whose parent is the lead, a node under the last one whose parent is the middle node — the in-row link chain.
const LEAD = { h: aiFile(FIRST, 'SorrelbyLead', 'h'), cpp: aiFile(FIRST, 'SorrelbyLead', 'cpp') };
const MID = { h: aiFile(MIDDLE, 'SorrelbyMid', 'h'), cpp: aiFile(MIDDLE, 'SorrelbyMid', 'cpp') };
const TAIL = { h: aiFile(LAST, 'SorrelbyTail', 'h'), cpp: aiFile(LAST, 'SorrelbyTail', 'cpp') };
// A node whose parent lives in ANOTHER AI row (the elder, under the eighth row's first initial), named bare: the cross-row link.
const KIN = { h: aiFile(LAST, 'SorrelbyKin', 'h'), cpp: aiFile(LAST, 'SorrelbyKin', 'cpp') };
const ELDER = aiFile(PREV_INITIALS[0], 'SorrelbyElder', 'h');
// Read by other specs: the Action folder's files under the same initials, and a camera AI file.
const ACTION_FILES = ACTION_ALTS.map((alt) => actionFile(alt, 'SorrelbyPeg', 'h'));
const CAMERA_AI = aiFile(FIRST, 'SorrelbyCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node under the first initial with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter; its
  // parent is named nowhere.
  [LEAD.h]: `
namespace demo::sorrelby {
class SorrelbyLead : public SorrelbyRoot {
public:
    explicit SorrelbyLead(const SorrelbyRig& sbRig);
    ~SorrelbyLead() override;
    bool pluckSorrelby() override;
    void wakeSorrelby(SorrelbyPouch* sbBag) override;
    void strumSorrelby() override;
    void tuneSorrelby() override;
protected:
    // sorrelby_fixed at offset 0x6b3e
    const float* mSorrelbyPitch_s{};
    // sorrelby_call at offset 0x6b3e
    demo::SorrelbyChord mSorrelbyCue_d{};
    // sorrelby_placed at offset 0x6b3e
    const int* mSorrelbyLane_m{};
    // sorrelby_shared at offset 0x6b3e
    void* mSorrelbyLink_a{};
    float mSorrelbyBeat;
};
}`,
  [LEAD.cpp]: `
#include "sorrelbyLead.h"
namespace demo::sorrelby {
SorrelbyLead::SorrelbyLead(const SorrelbyRig& sbRig) : SorrelbyRoot(sbRig) {}
SorrelbyLead::~SorrelbyLead() = default;
bool SorrelbyLead::pluckSorrelby() { return SorrelbyRoot::pluckSorrelby(); }
void SorrelbyLead::wakeSorrelby(SorrelbyPouch* sbBag) { SorrelbyRoot::wakeSorrelby(sbBag); }
void SorrelbyLead::strumSorrelby() { SorrelbyRoot::strumSorrelby(); }
void SorrelbyLead::tuneSorrelby() { bindSorrelby(&mSorrelbyPitch_s, "SorrelbyPitch"); bindSorrelby(&mSorrelbyCue_d, "SorrelbyCue"); }
}`,
  // A node under the MIDDLE initial whose parent is the lead above (a node under the first initial), named bare.
  [MID.h]: `
namespace demo::sorrelby {
class SorrelbyMid : public SorrelbyLead {
public:
    explicit SorrelbyMid(const SorrelbyRig& sbRig);
    ~SorrelbyMid() override = default;
    void tuneSorrelby() override;
protected:
    // sorrelby_fixed at offset 0x6b3e
    const bool* mSorrelbyMute_s{};
};
}`,
  [MID.cpp]: `
#include "sorrelbyMid.h"
namespace demo::sorrelby {
SorrelbyMid::SorrelbyMid(const SorrelbyRig& sbRig) : SorrelbyLead(sbRig) {}
void SorrelbyMid::tuneSorrelby() { SorrelbyLead::tuneSorrelby(); bindSorrelby(&mSorrelbyMute_s, "SorrelbyMute"); }
}`,
  // A node under the last initial whose parent is the middle node above, named bare; one tree-shared handle.
  [TAIL.h]: `
namespace demo::sorrelby {
class SorrelbyTail : public SorrelbyMid {
public:
    explicit SorrelbyTail(const SorrelbyRig& sbRig);
    void tuneSorrelby() override;
protected:
    // sorrelby_shared at offset 0x6b3e
    void* mSorrelbyHub_a{};
};
}`,
  [TAIL.cpp]: `
#include "sorrelbyTail.h"
namespace demo::sorrelby {
SorrelbyTail::SorrelbyTail(const SorrelbyRig& sbRig) : SorrelbyMid(sbRig) {}
void SorrelbyTail::tuneSorrelby() { SorrelbyMid::tuneSorrelby(); bindSorrelby(&mSorrelbyHub_a, "SorrelbyHub"); }
}`,
  // A node whose parent lives in ANOTHER AI row (the elder below), named bare: the cross-row link.
  [KIN.h]: `
namespace demo::sorrelby {
class SorrelbyKin : public SorrelbyElder {
public:
    explicit SorrelbyKin(const SorrelbyRig& sbRig);
    void tuneSorrelby() override;
protected:
    // sorrelby_fixed at offset 0x6b3e
    const float* mSorrelbyGain_s{};
};
}`,
  [KIN.cpp]: `
#include "sorrelbyKin.h"
namespace demo::sorrelby {
SorrelbyKin::SorrelbyKin(const SorrelbyRig& sbRig) : SorrelbyElder(sbRig) {}
void SorrelbyKin::tuneSorrelby() { SorrelbyElder::tuneSorrelby(); bindSorrelby(&mSorrelbyGain_s, "SorrelbyGain"); }
}`,
  [ELDER]: `
namespace demo::sorrelby {
class SorrelbyElder {
public:
    int mSorrelbyKnot;
};
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listSorrelbyFiles(sorrelbyLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initials, the initial directly above its last
  // (the eighth AI row's, read through this row by exactly that row's spec and twin), the initial directly below its first (the
  // fourth AI row's, likewise) and a file in the camera's AI folder.
  ...Object.fromEntries(ACTION_FILES.map((f, i) => [f, `namespace demo { class SorrelbyPeg${i} { int mSorrelbyPegPeg; }; }`])),
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class SorrelbyUpNb { int mSorrelbyUpNbPeg; }; }',
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class SorrelbyDownNb { int mSorrelbyDownNbPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class SorrelbyCam { int mSorrelbyCamPeg; }; }',
  // Stay unread by this row: a lower-case initial, another extension, a deeper folder, a look-alike sibling folder, the NPC's AI
  // folder (read by its own spec), and an AI-prefixed file of the first initial directly in the AI folder's parent.
  [aiFile(FIRST.toLowerCase(), 'SorrelbyLow', 'h')]: 'namespace demo { class SorrelbyLow { int mSorrelbyLowPeg; }; }',
  [aiFile(FIRST, 'SorrelbyNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}SorrelbyDeep.h`]: 'namespace demo { class SorrelbyDeep { int mSorrelbyDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}SorrelbyDraft.h`]: 'namespace demo { class SorrelbyDraft { int mSorrelbyDraftPeg; }; }',
  [aiFile(FIRST, 'SorrelbyNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class SorrelbyNpc { int mSorrelbyNpcPeg; }; }',
  [aiFile(FIRST, 'SorrelbyNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { void SorrelbyNpc::hum() {} }',
  [aiFile(FIRST, 'SorrelbyUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class SorrelbyUp { int mSorrelbyUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, MID.h, MID.cpp, TAIL.h, TAIL.cpp, KIN.h, KIN.cpp].sort();
const ALL = Object.keys(FILES);
// Files another spec reads, as the matcher decides (the neighbour probes are read by the earlier rows; the count follows).
const readByOthers = (f: string) => BOTW.tables.some((s) => s !== SPEC && s !== TWIN && expandGlob([f], s.file).length);
const COVERED_ELSEWHERE = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && readByOthers(f)).sort();
const STAY_OPEN = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && !readByOthers(f)).sort();
// Node records: class + definition for the four nodes (each has a source); handle records: 4 + 1 + 1 + 1 = 7. The row's records.
const NODE_RECORDS = 4 * 2;
const HANDLE_RECORDS = 7;
const ROW_RECORDS = NODE_RECORDS + HANDLE_RECORDS;

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

/** The AI folder's capital initials no spec of `specs` reads (a bare probe per capital). */
const openInitials = (specs: readonly Spec[]) => UPPER.filter((c) => !readersOf(aiFile(c, 'Probe', 'h'), specs).length);

describe('BOTW AI behaviour-node rows: the ninth and last row, three initials that all name files, read by both techniques (W29)', () => {
  it('is the ninth AI row: directly after the eighth AI row\'s spec and directly followed by the NPC\'s AI folder spec; its twin likewise: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS).toHaveLength(9); // exactly nine AI row specs: the guard that nothing slipped in after this row
    expect(AI_ROWS).toEqual([...EARLIER_ROWS, PREV, SPEC]);
    expect(AI_ROWS[8]).toBe(SPEC);
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(SHARED_DECLS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the NPC's AI folder (it ends the block)
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.length - 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(PREV_TWIN) + 1);
    expect(BOTW.tables.indexOf(NPC_AI_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(BOTW.tables.at(-1)).toBe(NPC_AI_TWIN); // the NPC's AI twin stays last of the table
    expect(dirOf(NPC_AI_SPEC.file)).toBe(NPC_AI_DIR); // the next spec is the NPC's AI folder: no tenth AI row
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The three-initial brace shape: a prefix other than the Action folder's, three consecutive capitals, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    for (const row of [...EARLIER_ROWS, PREV]) expect(PREFIX).toBe(AI_SHAPE.exec(filePart(row.file))?.[1]);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS).toHaveLength(3);
    INITIALS.forEach((c, i) => expect(c).toBe(letterAfter(FIRST, i)));
    expect(MIDDLE).toBe(letterAfter(FIRST, 1));
    expect(LAST).toBe(letterAfter(MIDDLE, 1));
    for (const c of INITIALS) expect(UPPER).toContain(c);
    // The row sits inside the alphabet: both neighbours are capitals, so both neighbour probes exist (no last-capital assertion).
    expect(UPPER).toContain(LOWER_NB);
    expect(UPPER).toContain(UPPER_NB);
    expect(INITIALS).not.toContain(LOWER_NB);
    expect(INITIALS).not.toContain(UPPER_NB);
    expect(initialsOf(BELOW_ROW)).toContain(LOWER_NB);
    expect(PREV_INITIALS).toContain(UPPER_NB);
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
    // A one-letter initial also reads every longer name that begins with it; derive how many names that is and keep the instrument
    // able to fail: it reads some. The Action folder's alternatives under these initials are the initials themselves.
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
      for (const row of [...EARLIER_ROWS, PREV]) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
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

  it('reads the row\'s code files and nothing else, a coined file under EACH of the three initials included, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(ALL, SPEC.file)).toEqual(ROW);
    expect(expandGlob(ALL, TWIN.file)).toEqual(ROW);
    // Every initial names files: the coined file under each is read by the spec and by the twin.
    for (const [c, node] of [[FIRST, LEAD], [MIDDLE, MID], [LAST, TAIL]] as const) {
      expect(node.h.startsWith(`${AI_DIR}/${PREFIX}${c}`)).toBe(true);
      expect(expandGlob([node.h, node.cpp], SPEC.file)).toEqual([node.h, node.cpp].sort());
      expect(expandGlob([node.h, node.cpp], TWIN.file)).toEqual([node.h, node.cpp].sort());
    }
    // Not the AI build file, the initials directly below and above the row, a lower-case variant, another extension, a deeper or
    // look-alike folder, the NPC's AI folder, the camera's AI folder, the Action folder's files under these initials, or the
    // parent folder's file.
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'SorrelbyLow', 'h'),
      aiFile(FIRST, 'SorrelbyNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}SorrelbyDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}SorrelbyDraft.h`,
      aiFile(FIRST, 'SorrelbyNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'SorrelbyNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ...ACTION_FILES,
      aiFile(FIRST, 'SorrelbyUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under these initials are read by exactly one Action row each (not by this row); the camera file by the
    // camera spec; the elder by exactly the eighth AI row's spec and twin; the initial directly above the last by exactly the
    // eighth AI row's spec and twin; the initial directly below the first by exactly the spec and twin of the row that owns it —
    // both neighbours are registered EARLIER, so these readers hold through this row and after it.
    expect(ACTION_FILES.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const f of ACTION_FILES) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    expect(readersOf(ELDER)).toEqual([PREV, PREV_TWIN]);
    for (const specs of [THROUGH, BOTW.tables]) {
      expect(readersOf(aiFile(UPPER_NB, 'Probe', 'h'), specs)).toEqual([PREV, PREV_TWIN]);
      expect(readersOf(aiFile(LOWER_NB, 'Probe', 'h'), specs)).toEqual([BELOW_ROW, BELOW_TWIN]);
    }
    expect(readersOf(aiFile(FIRST, 'SorrelbyNpc', 'h', NPC_AI_DIR))).toEqual([NPC_AI_SPEC, NPC_AI_TWIN]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 8 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(ROW.length);
  });

  it('the AI folder\'s open initials: before this row exactly its three initials are open, through it NONE is — the first row to close the last open capital; the lower-case initials stay open', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    const CLOSED_BEFORE = [...EARLIER_INITIALS, ...PREV_INITIALS];
    expect(CLOSED_BEFORE).toHaveLength(UPPER.length - INITIALS.length);
    expect(openInitials(BEFORE)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c)));
    expect(openInitials(BEFORE)).toEqual(INITIALS);
    expect(openInitials(THROUGH)).toEqual([]); // the empty set: no capital initial of the AI folder is left open
    expect(openInitials(BOTW.tables)).toEqual([]);
    // Every initial of the row was open before it and is closed through it; the instrument can fail: a probe at each initial is
    // read by exactly this row's spec and twin.
    for (const c of INITIALS) {
      expect(openInitials(BEFORE)).toContain(c);
      expect(openInitials(THROUGH)).not.toContain(c);
      for (const ext of EXTS.split(',')) expect(readersOf(aiFile(c, 'Probe', ext))).toEqual([SPEC, TWIN]);
    }
    // The neighbours: the initial below is closed by the row that owns it, the one above by the eighth AI row, each read by exactly that row's pair.
    expect(CLOSED_BEFORE).toContain(LOWER_NB);
    expect(CLOSED_BEFORE).toContain(UPPER_NB);
    for (const ext of EXTS.split(',')) {
      expect(readersOf(aiFile(LOWER_NB, 'Probe', ext), THROUGH)).toEqual([BELOW_ROW, BELOW_TWIN]);
      expect(readersOf(aiFile(UPPER_NB, 'Probe', ext), THROUGH)).toEqual([PREV, PREV_TWIN]);
    }
    // The capitals are all read and the lower-case initials are all open: the AI globs are capital-initial, so a lower-case probe
    // is read by no spec (the folders test's derived open initial falls back to it once every capital is read).
    for (const c of LOWER) for (const ext of EXTS.split(',')) expect(readersOf(aiFile(c, 'Probe', ext))).toEqual([]);
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
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: NODE_RECORDS, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 8, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: HANDLE_RECORDS, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 8, withoutRecords: 4, refused: [] },
    });
    // The row's node and handle records, and one node record from each file another spec reads.
    expect(first.store).toEqual({ created: ROW_RECORDS + COVERED_ELSEWHERE.length, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@4')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::sorrelby::SorrelbyKin',
      `botw-demo::sorrelby::SorrelbyKin::(definitions@${KIN.cpp})`,
      'botw-demo::sorrelby::SorrelbyLead',
      `botw-demo::sorrelby::SorrelbyLead::(definitions@${LEAD.cpp})`,
      'botw-demo::sorrelby::SorrelbyMid',
      `botw-demo::sorrelby::SorrelbyMid::(definitions@${MID.cpp})`,
      'botw-demo::sorrelby::SorrelbyTail',
      `botw-demo::sorrelby::SorrelbyTail::(definitions@${TAIL.cpp})`,
    ].sort());
    // The handle records come from the four headers that carry a scope comment, exactly as cpp-handles reads them on its own; the
    // runtime counter is no handle.
    const handlesOnly = [LEAD.h, MID.h, TAIL.h, KIN.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['SorrelbyKin', 'mSorrelbyGain_s', 'sorrelby_fixed', 'real'],
      ['SorrelbyLead', 'mSorrelbyCue_d', 'sorrelby_call', 'named'], ['SorrelbyLead', 'mSorrelbyLane_m', 'sorrelby_placed', 'integer'],
      ['SorrelbyLead', 'mSorrelbyLink_a', 'sorrelby_shared', 'void'], ['SorrelbyLead', 'mSorrelbyPitch_s', 'sorrelby_fixed', 'real'],
      ['SorrelbyMid', 'mSorrelbyMute_s', 'sorrelby_fixed', 'boolean'],
      ['SorrelbyTail', 'mSorrelbyHub_a', 'sorrelby_shared', 'void'],
    ].sort());
    const all = listWrappers(db, { sourceId: 'botw' });
    const wrapper = (id: string) => all.find((w) => w.entity.id === id)!;
    const node = (id: string) => wrapper(id).raw;
    expect(node('botw-demo::sorrelby::SorrelbyLead')).toMatchObject({
      kind: 'class', bases: 'SorrelbyRoot', methods: 'SorrelbyLead;~SorrelbyLead;pluckSorrelby;wakeSorrelby;strumSorrelby;tuneSorrelby',
      fields: 'mSorrelbyPitch_s;mSorrelbyCue_d;mSorrelbyLane_m;mSorrelbyLink_a;mSorrelbyBeat',
    });
    expect(node('botw-demo::sorrelby::SorrelbyMid')).toMatchObject({ kind: 'class', bases: 'SorrelbyLead', fields: 'mSorrelbyMute_s' });
    expect(node(`botw-demo::sorrelby::SorrelbyMid::(definitions@${MID.cpp})`)).toMatchObject({ methods: 'SorrelbyMid;tuneSorrelby' });
    // The parent pass: the chain first → middle → last links across the three initials, the cross-row child links to the eighth AI
    // row's node (the raw base stays as written), and a parent no record answers stays an explicit marker, never a guessed link.
    expect(wrapper('botw-demo::sorrelby::SorrelbyMid').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::sorrelby::SorrelbyLead', role: 'extends' }]);
    expect(wrapper('botw-demo::sorrelby::SorrelbyTail').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::sorrelby::SorrelbyMid', role: 'extends' }]);
    expect(wrapper('botw-demo::sorrelby::SorrelbyKin').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::sorrelby::SorrelbyElder', role: 'extends' }]);
    expect(node('botw-demo::sorrelby::SorrelbyKin')).toMatchObject({ bases: 'SorrelbyElder' });
    expect(wrapper('botw-demo::sorrelby::SorrelbyLead').entity.links ?? []).toEqual([]);
    expect(wrapper('botw-demo::sorrelby::SorrelbyLead').entity.data).toMatchObject({ unresolvedLinks: [{ role: 'extends', ref: 'SorrelbyRoot' }] });
    expect(first.links.unresolved.filter((u) => u.ref === 'SorrelbyRoot')).toHaveLength(1);
    expect(first.links.ambiguous ?? []).toEqual([]);
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
