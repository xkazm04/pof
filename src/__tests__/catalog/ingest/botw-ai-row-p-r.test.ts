// W28: the eighth row of the AI folder (Backlog item 8's AI half): THREE consecutive initials, in the brace form of the earlier AI
// rows' shape — <prefix>{<a>,<b>,<c>}*.{h,cpp}, no stem — registered directly after the seventh AI row and directly followed by the
// ninth (and last) AI row, then the NPC's AI folder, which keeps the end of the cpp-decls block (vault Decisions Z-D96 (d), Z-D113,
// Z-D116). It is read by BOTH source-code
// techniques over that one glob — a cpp-decls spec under the shared node map and its cpp-handles twin, both in the row's own
// catalog. It is no longer the newest AI row, so its test pins "the first eight AI rows" (the ninth row's test keeps "exactly nine"),
// as the seventh row's test moved. The glob must read the row's code files and nothing
// else, and must share no file with any other spec (an overlap would wrap one file twice under one id). Every path below — the AI
// folder, its prefix, its initials, the neighbour folders, the Action prefix — is DERIVED from the registered specs at run time, and
// the row is pinned by POSITION (the spec directly after the seventh AI row), never by "last" and never by an absolute index. This
// is the sixth row wrapped since the run-level parent pass: a child under this row names a parent of another AI row, bare, and the
// pass links it. FIRSTS OF THIS ROW: its MIDDLE initial names no file in the reference today, yet the glob keeps it (it is the
// row's own address, as the Action row of the same initials keeps it), so a coined file under that initial proves both specs read
// it; the row is not at the end of the alphabet, so there is NO last-capital assertion and both neighbour probes stay (the lower
// neighbour is open and read by no spec registered through this row, the upper one is read by exactly the third AI row's pair); the same bare class name sits
// in this row and in the Action folder, in two namespaces (each child links in its own namespace, nothing is ambiguous). The
// row's big node family and its tree-shared handles need no fixture. Every line of C++, every name and the one hex value in it was
// coined for this test.
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
// Pinned to this row by position: the AI rows registered before it are the first seven (each pinned by its own test), and this row
// is the spec directly after the seventh one. The NPC's AI folder is found by its FOLDER.
const AI_ROWS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const FIRST_AI = AI_ROWS[0];
const SECOND_AI = AI_ROWS[1];
const THIRD_AI = AI_ROWS[2];
const FOURTH_AI = AI_ROWS[3];
const FIFTH_AI = AI_ROWS[4];
const SIXTH_AI = AI_ROWS[5];
const PREV = AI_ROWS[6];
const PREV_TWIN = twinOf(PREV.file);
const SPEC = DECL_SPECS[DECL_SPECS.indexOf(PREV) + 1];
const TWIN = twinOf(SPEC.file);
// The spec directly after this row (the next AI row, the ninth) and its twin: found by position, never by an index.
const NEXT = DECL_SPECS[DECL_SPECS.indexOf(SPEC) + 1];
const NEXT_TWIN = twinOf(NEXT.file);
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
const THIRD_INITIALS = initialsOf(THIRD_AI);
const EARLIER_INITIALS = [FIRST_AI, SECOND_AI, THIRD_AI, FOURTH_AI, FIFTH_AI, SIXTH_AI].flatMap(initialsOf);
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
// The row is neither at the start nor at the end of the alphabet: the initial directly BELOW the first is open and read by no spec
// registered through this row; the initial directly ABOVE the last is the third AI row's.
const LOWER_NB = letterAfter(FIRST, -1);
const UPPER_NB = letterAfter(LAST, 1);

// The Action folder's alternatives that begin with one of this row's initials: each names files read by exactly one Action row.
const ACTION_ALTS = [...new Set(ROW_SPECS.flatMap((s) => actionAlts(s.file)).filter((a) => INITIALS.some((c) => a.startsWith(c))))];

const LEAD = { h: aiFile(FIRST, 'JessamyLead', 'h'), cpp: aiFile(FIRST, 'JessamyLead', 'cpp') };
// A node under the MIDDLE initial (it names no file in the reference today) whose parent is the lead, and a node under the last
// initial whose parent is that middle node: the in-row link chain first → middle → last.
const MID = { h: aiFile(MIDDLE, 'JessamyMid', 'h'), cpp: aiFile(MIDDLE, 'JessamyMid', 'cpp') };
const TAIL = { h: aiFile(LAST, 'JessamyTail', 'h'), cpp: aiFile(LAST, 'JessamyTail', 'cpp') };
// A node whose parent lives in ANOTHER AI row (the elder below), named bare: the cross-row link.
const KIN = { h: aiFile(LAST, 'JessamyKin', 'h'), cpp: aiFile(LAST, 'JessamyKin', 'cpp') };
// The same-name pair, AI side: a node (first initial) and a child that names it bare (last initial), in the AI namespace.
const SAME = { h: aiFile(FIRST, 'JessamyTwin', 'h'), cpp: aiFile(FIRST, 'JessamyTwin', 'cpp') };
const ECHO = { h: aiFile(LAST, 'JessamyEcho', 'h'), cpp: aiFile(LAST, 'JessamyEcho', 'cpp') };
// A node of the previous AI row (under its first initial) that the kin above names as its parent, bare.
const ELDER = aiFile(PREV_INITIALS[0], 'JessamyElder', 'h');
// The same-name pair, Action side: a class with the same bare name under one of the Action folder's alternatives, and a child that
// names it bare, in the Action namespace. Each is read by exactly one Action row, never by this row.
const ACT_SAME = actionFile(ACTION_ALTS[0], 'JessamyTwin', 'h');
const ACT_ECHO = actionFile(ACTION_ALTS[1], 'JessamyEchoAct', 'h');
// Read by other specs: the Action folder's files under the same initials, and a camera AI file.
const ACTION_FILES = ACTION_ALTS.map((alt) => actionFile(alt, 'JessamyPeg', 'h'));
const CAMERA_AI = aiFile(FIRST, 'JessamyCam', 'h', CAMERA_AI_DIR);

const FILES: Record<string, string> = {
  // A node under the first initial with a parameter of each of the four scopes, the lifecycle hooks and one runtime counter; its
  // parent is named nowhere.
  [LEAD.h]: `
namespace demo::jessamy {
class JessamyLead : public JessamyRoot {
public:
    explicit JessamyLead(const JessamyRig& rig);
    ~JessamyLead() override;
    bool pluckJessamy() override;
    void wakeJessamy(JessamyPouch* jsBag) override;
    void strumJessamy() override;
    void tuneJessamy() override;
protected:
    // jessamy_fixed at offset 0xa1d6
    const float* mJessamyPitch_s{};
    // jessamy_call at offset 0xa1d6
    demo::JessamyChord mJessamyCue_d{};
    // jessamy_placed at offset 0xa1d6
    const int* mJessamyLane_m{};
    // jessamy_shared at offset 0xa1d6
    void* mJessamyLink_a{};
    float mJessamyBeat;
};
}`,
  [LEAD.cpp]: `
#include "jessamyLead.h"
namespace demo::jessamy {
JessamyLead::JessamyLead(const JessamyRig& rig) : JessamyRoot(rig) {}
JessamyLead::~JessamyLead() = default;
bool JessamyLead::pluckJessamy() { return JessamyRoot::pluckJessamy(); }
void JessamyLead::wakeJessamy(JessamyPouch* jsBag) { JessamyRoot::wakeJessamy(jsBag); }
void JessamyLead::strumJessamy() { JessamyRoot::strumJessamy(); }
void JessamyLead::tuneJessamy() { bindJessamy(&mJessamyPitch_s, "JessamyPitch"); bindJessamy(&mJessamyCue_d, "JessamyCue"); }
}`,
  // A node under the MIDDLE initial whose parent is the lead above (a node under the first initial), named bare.
  [MID.h]: `
namespace demo::jessamy {
class JessamyMid : public JessamyLead {
public:
    explicit JessamyMid(const JessamyRig& rig);
    ~JessamyMid() override = default;
    void tuneJessamy() override;
protected:
    // jessamy_fixed at offset 0xa1d6
    const bool* mJessamyMute_s{};
};
}`,
  [MID.cpp]: `
#include "jessamyMid.h"
namespace demo::jessamy {
JessamyMid::JessamyMid(const JessamyRig& rig) : JessamyLead(rig) {}
void JessamyMid::tuneJessamy() { JessamyLead::tuneJessamy(); bindJessamy(&mJessamyMute_s, "JessamyMute"); }
}`,
  // A node under the last initial whose parent is the middle node above, named bare; one tree-shared handle.
  [TAIL.h]: `
namespace demo::jessamy {
class JessamyTail : public JessamyMid {
public:
    explicit JessamyTail(const JessamyRig& rig);
    void tuneJessamy() override;
protected:
    // jessamy_shared at offset 0xa1d6
    void* mJessamyHub_a{};
};
}`,
  [TAIL.cpp]: `
#include "jessamyTail.h"
namespace demo::jessamy {
JessamyTail::JessamyTail(const JessamyRig& rig) : JessamyMid(rig) {}
void JessamyTail::tuneJessamy() { JessamyMid::tuneJessamy(); bindJessamy(&mJessamyHub_a, "JessamyHub"); }
}`,
  // A node whose parent lives in ANOTHER AI row (the elder below), named bare: the cross-row link.
  [KIN.h]: `
namespace demo::jessamy {
class JessamyKin : public JessamyElder {
public:
    explicit JessamyKin(const JessamyRig& rig);
    void tuneJessamy() override;
protected:
    // jessamy_fixed at offset 0xa1d6
    const float* mJessamyGain_s{};
};
}`,
  [KIN.cpp]: `
#include "jessamyKin.h"
namespace demo::jessamy {
JessamyKin::JessamyKin(const JessamyRig& rig) : JessamyElder(rig) {}
void JessamyKin::tuneJessamy() { JessamyElder::tuneJessamy(); bindJessamy(&mJessamyGain_s, "JessamyGain"); }
}`,
  [ELDER]: `
namespace demo::jessamy {
class JessamyElder {
public:
    int mJessamyKnot;
};
}`,
  // The same bare class name in this row and in the Action folder, in two namespaces. The AI node has no parameters; its child
  // (last initial) names it bare and carries one parameter.
  [SAME.h]: `
namespace demo::jessamy {
class JessamyTwin {
public:
    explicit JessamyTwin(const JessamyRig& rig);
    void tuneJessamy();
};
}`,
  [SAME.cpp]: `
#include "jessamyTwin.h"
namespace demo::jessamy {
JessamyTwin::JessamyTwin(const JessamyRig& rig) {}
void JessamyTwin::tuneJessamy() {}
}`,
  [ECHO.h]: `
namespace demo::jessamy {
class JessamyEcho : public JessamyTwin {
public:
    explicit JessamyEcho(const JessamyRig& rig);
    void tuneJessamy() override;
protected:
    // jessamy_call at offset 0xa1d6
    demo::JessamyChord mJessamyRing_d{};
};
}`,
  [ECHO.cpp]: `
#include "jessamyEcho.h"
namespace demo::jessamy {
JessamyEcho::JessamyEcho(const JessamyRig& rig) : JessamyTwin(rig) {}
void JessamyEcho::tuneJessamy() { JessamyTwin::tuneJessamy(); bindJessamy(&mJessamyRing_d, "JessamyRing"); }
}`,
  [ACT_SAME]: `
namespace demo::jessamyact {
class JessamyTwin {
public:
    int mJessamyActPeg;
};
}`,
  [ACT_ECHO]: `
namespace demo::jessamyact {
class JessamyEchoAct : public JessamyTwin {
public:
    int mJessamyActEchoPeg;
};
}`,
  // The AI folder's build file: descoped, never read.
  [`${AI_DIR}/CMakeLists.txt`]: 'listJessamyFiles(jessamyLead.cpp)\n',
  // Read by other specs, never by this row's: the Action folder's files under the same initials, the initial directly above its
  // last (the THIRD AI row's, read through this row by exactly that row's spec and twin) and a file in the camera's AI folder.
  ...Object.fromEntries(ACTION_FILES.map((f, i) => [f, `namespace demo { class JessamyPeg${i} { int mJessamyPegPeg; }; }`])),
  [aiFile(UPPER_NB, 'Probe', 'h')]: 'namespace demo { class JessamyUpNb { int mJessamyUpNbPeg; }; }',
  [CAMERA_AI]: 'namespace demo { class JessamyCam { int mJessamyCamPeg; }; }',
  // Stay unread by this row: the initial directly below the first (open: no spec registered through this row reads it), a
  // lower-case initial, another extension, a deeper folder, a look-alike sibling folder, the NPC's AI folder (read by its own
  // spec), and an AI-prefixed file of the first initial directly in the AI folder's parent.
  [aiFile(LOWER_NB, 'Probe', 'h')]: 'namespace demo { class JessamyDownNb { int mJessamyDownNbPeg; }; }',
  [aiFile(FIRST.toLowerCase(), 'JessamyLow', 'h')]: 'namespace demo { class JessamyLow { int mJessamyLowPeg; }; }',
  [aiFile(FIRST, 'JessamyNotes', 'txt')]: 'synthetic notes',
  [`${AI_DIR}/coinedDeep/${PREFIX}${FIRST}JessamyDeep.h`]: 'namespace demo { class JessamyDeep { int mJessamyDeepPeg; }; }',
  [`${AI_DIR}Draft/${PREFIX}${FIRST}JessamyDraft.h`]: 'namespace demo { class JessamyDraft { int mJessamyDraftPeg; }; }',
  [aiFile(FIRST, 'JessamyNpc', 'h', NPC_AI_DIR)]: 'namespace demo { class JessamyNpc { int mJessamyNpcPeg; }; }',
  [aiFile(FIRST, 'JessamyNpc', 'cpp', NPC_AI_DIR)]: 'namespace demo { void JessamyNpc::hum() {} }',
  [aiFile(FIRST, 'JessamyUp', 'h', dirOf(AI_DIR))]: 'namespace demo { class JessamyUp { int mJessamyUpPeg; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, MID.h, MID.cpp, TAIL.h, TAIL.cpp, KIN.h, KIN.cpp, SAME.h, SAME.cpp, ECHO.h, ECHO.cpp].sort();
const ALL = Object.keys(FILES);
// Files another spec reads, as the matcher decides (rows registered later may read a neighbour probe; the count follows).
const readByOthers = (f: string) => BOTW.tables.some((s) => s !== SPEC && s !== TWIN && expandGlob([f], s.file).length);
const COVERED_ELSEWHERE = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && readByOthers(f)).sort();
const STAY_OPEN = ALL.filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt') && !readByOthers(f)).sort();
// Node records: class + definition for the six nodes (each has a source); handle records: 4 + 1 + 1 + 1 + 1 = 8. The row's records.
const NODE_RECORDS = 6 * 2;
const HANDLE_RECORDS = 8;
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

/** The AI folder's initials no spec of `specs` reads (a bare probe per capital). */
const openInitials = (specs: readonly Spec[]) => UPPER.filter((c) => !readersOf(aiFile(c, 'Probe', 'h'), specs).length);

describe('BOTW AI behaviour-node rows: the eighth row, three initials with a file-less middle, read by both techniques (W28)', () => {
  it('is the eighth AI row: directly after the seventh AI row\'s spec and directly followed by the next AI row\'s spec; its twin likewise: one glob, one catalog, the two shared maps', () => {
    expect(AI_ROWS.slice(0, 8)).toEqual([FIRST_AI, SECOND_AI, THIRD_AI, FOURTH_AI, FIFTH_AI, SIXTH_AI, PREV, SPEC]); // the first eight AI row specs (the ninth row's test keeps "exactly nine")
    expect(dirOf(SPEC.file)).toBe(AI_DIR);
    expect(SHARED_DECLS.indexOf(SPEC)).toBe(SHARED_DECLS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(SPEC)).toBe(DECL_SPECS.indexOf(PREV) + 1);
    expect(DECL_SPECS.indexOf(NEXT)).toBe(DECL_SPECS.indexOf(SPEC) + 1); // directly followed by the next AI row's spec
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.length - 1); // the NPC's AI folder still ends the block
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(PREV_TWIN) + 1);
    expect(BOTW.tables.indexOf(NEXT_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1); // … and its twin by the next AI row's twin
    expect(BOTW.tables.at(-1)).toBe(NPC_AI_TWIN); // the NPC's AI twin stays last of the table
    expect(dirOf(NEXT.file)).toBe(AI_DIR); // the next spec is the ninth AI row, in the AI folder
    expect(AI_ROWS[8]).toBe(NEXT);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The three-initial brace shape: a prefix other than the Action folder's, three consecutive capitals, both code extensions.
    expect(SHAPE).not.toBeNull();
    expect(PREFIX).not.toBe(ACTION_PREFIX);
    for (const row of [FIRST_AI, SECOND_AI, THIRD_AI, FOURTH_AI, FIFTH_AI, SIXTH_AI, PREV]) expect(PREFIX).toBe(AI_SHAPE.exec(filePart(row.file))?.[1]);
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
      for (const row of [FIRST_AI, SECOND_AI, THIRD_AI, FOURTH_AI, FIFTH_AI, SIXTH_AI, PREV]) expect(expandGlob(probes, specs === DECL_SPECS ? row.file : twinOf(row.file).file).length).toBeGreaterThan(0);
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

  it('reads the row\'s code files and nothing else, the file-less middle initial included, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(ALL, SPEC.file)).toEqual(ROW);
    expect(expandGlob(ALL, TWIN.file)).toEqual(ROW);
    // The coined file under the MIDDLE initial (which names no file in the reference today) is read like any other file of the row.
    expect(MID.h.startsWith(`${AI_DIR}/${PREFIX}${MIDDLE}`)).toBe(true);
    expect(expandGlob([MID.h, MID.cpp], SPEC.file)).toEqual([MID.h, MID.cpp].sort());
    expect(expandGlob([MID.h, MID.cpp], TWIN.file)).toEqual([MID.h, MID.cpp].sort());
    // Not the AI build file, the initials directly below and above the row, a lower-case variant, another extension, a deeper or
    // look-alike folder, the NPC's AI folder, the camera's AI folder, the Action folder's files under these initials (the same-name
    // Action pair included), or the parent folder's file.
    for (const f of [`${AI_DIR}/CMakeLists.txt`, aiFile(LOWER_NB, 'Probe', 'h'), aiFile(UPPER_NB, 'Probe', 'h'), aiFile(FIRST.toLowerCase(), 'JessamyLow', 'h'),
      aiFile(FIRST, 'JessamyNotes', 'txt'), `${AI_DIR}/coinedDeep/${PREFIX}${FIRST}JessamyDeep.h`, `${AI_DIR}Draft/${PREFIX}${FIRST}JessamyDraft.h`,
      aiFile(FIRST, 'JessamyNpc', 'h', NPC_AI_DIR), aiFile(FIRST, 'JessamyNpc', 'cpp', NPC_AI_DIR), CAMERA_AI, ...ACTION_FILES, ACT_SAME, ACT_ECHO,
      aiFile(FIRST, 'JessamyUp', 'h', dirOf(AI_DIR))]) {
      expect(expandGlob([f], SPEC.file)).toEqual([]);
      expect(expandGlob([f], TWIN.file)).toEqual([]);
    }
    // The Action files under these initials are read by exactly one Action row each (not by this row); the camera file by the
    // camera spec; the seventh AI row's file by exactly that row's spec and twin; the initial directly above the last by exactly
    // the THIRD AI row's spec and twin (read through this row); the initial directly below the first by no spec registered through
    // this row (a later AI row may read it; the matcher decides the file-level counts below).
    expect(ACTION_FILES.length).toBeGreaterThanOrEqual(INITIALS.length);
    for (const f of [...ACTION_FILES, ACT_SAME, ACT_ECHO]) expect(readersOf(f, DECL_SPECS).filter((s) => ROW_SPECS.includes(s))).toHaveLength(1);
    expect(readersOf(CAMERA_AI, DECL_SPECS).map((s) => s.map)).toEqual([CAMERA_SHOT_NODE_MAP]);
    expect(readersOf(ELDER)).toEqual([PREV, PREV_TWIN]);
    expect(THIRD_INITIALS).toContain(UPPER_NB);
    expect(readersOf(aiFile(UPPER_NB, 'Probe', 'h'), THROUGH)).toEqual([THIRD_AI, twinOf(THIRD_AI.file)]);
    expect(readersOf(aiFile(LOWER_NB, 'Probe', 'h'), THROUGH)).toEqual([]);
    expect(readersOf(aiFile(FIRST, 'JessamyNpc', 'h', NPC_AI_DIR))).toEqual([NPC_AI_SPEC, NPC_AI_TWIN]);
    const cov = computePathCoverage(ALL, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 12 row files + the files another spec reads covered; the build file descoped; the rest open.
    expect(cov).toMatchObject({ total: ALL.length, covered: ROW.length + COVERED_ELSEWHERE.length, descoped: 1, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(ROW.length);
  });

  it('the AI folder\'s open initials: with the first seven AI rows closed, every other initial is open before this row, and exactly its three initials too are closed with it; the initial below stays open, the one above stays read by the third AI row', () => {
    // Computed with the repo's own glob matcher over the specs registered before the row (the matcher wins, never the brief).
    const CLOSED_BEFORE = [...EARLIER_INITIALS, ...PREV_INITIALS];
    expect(CLOSED_BEFORE).toHaveLength(20);
    expect(openInitials(BEFORE)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c)));
    expect(openInitials(BEFORE)).toHaveLength(UPPER.length - 20);
    expect(openInitials(THROUGH)).toEqual(UPPER.filter((c) => !CLOSED_BEFORE.includes(c) && !INITIALS.includes(c)));
    expect(openInitials(THROUGH)).toHaveLength(UPPER.length - 20 - INITIALS.length);
    // The neighbours: the initial directly below the first is open before and through the row, read by no spec registered through
    // it; the initial directly above the last is the third AI row's, closed before this row and read by exactly its spec and twin.
    expect(openInitials(BEFORE)).toContain(LOWER_NB);
    expect(openInitials(THROUGH)).toContain(LOWER_NB);
    for (const ext of EXTS.split(',')) {
      expect(readersOf(aiFile(LOWER_NB, 'Probe', ext), THROUGH)).toEqual([]);
      expect(readersOf(aiFile(UPPER_NB, 'Probe', ext), THROUGH)).toEqual([THIRD_AI, twinOf(THIRD_AI.file)]);
    }
    expect(CLOSED_BEFORE).toContain(UPPER_NB);
    // Every initial of the row was open before it and is closed through it; the instrument can fail: a probe at each initial, the
    // file-less middle one included, is read by exactly this row's spec and twin.
    for (const c of INITIALS) {
      expect(openInitials(BEFORE)).toContain(c);
      expect(openInitials(THROUGH)).not.toContain(c);
      for (const ext of EXTS.split(',')) expect(readersOf(aiFile(c, 'Probe', ext))).toEqual([SPEC, TWIN]);
    }
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
      duplicateKeys: 0, malformed: 0, files: { matched: 12, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: HANDLE_RECORDS, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 12, withoutRecords: 7, refused: [] },
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
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::jessamy::JessamyEcho',
      `botw-demo::jessamy::JessamyEcho::(definitions@${ECHO.cpp})`,
      'botw-demo::jessamy::JessamyKin',
      `botw-demo::jessamy::JessamyKin::(definitions@${KIN.cpp})`,
      'botw-demo::jessamy::JessamyLead',
      `botw-demo::jessamy::JessamyLead::(definitions@${LEAD.cpp})`,
      'botw-demo::jessamy::JessamyMid',
      `botw-demo::jessamy::JessamyMid::(definitions@${MID.cpp})`,
      'botw-demo::jessamy::JessamyTail',
      `botw-demo::jessamy::JessamyTail::(definitions@${TAIL.cpp})`,
      'botw-demo::jessamy::JessamyTwin',
      `botw-demo::jessamy::JessamyTwin::(definitions@${SAME.cpp})`,
    ].sort());
    // The handle records come from the five headers that carry a scope comment, exactly as cpp-handles reads them on its own; the
    // runtime counter is no handle, and the same-name node has none.
    const handlesOnly = [LEAD.h, MID.h, TAIL.h, KIN.h, ECHO.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['JessamyEcho', 'mJessamyRing_d', 'jessamy_call', 'named'],
      ['JessamyKin', 'mJessamyGain_s', 'jessamy_fixed', 'real'],
      ['JessamyLead', 'mJessamyCue_d', 'jessamy_call', 'named'], ['JessamyLead', 'mJessamyLane_m', 'jessamy_placed', 'integer'],
      ['JessamyLead', 'mJessamyLink_a', 'jessamy_shared', 'void'], ['JessamyLead', 'mJessamyPitch_s', 'jessamy_fixed', 'real'],
      ['JessamyMid', 'mJessamyMute_s', 'jessamy_fixed', 'boolean'],
      ['JessamyTail', 'mJessamyHub_a', 'jessamy_shared', 'void'],
    ].sort());
    const all = listWrappers(db, { sourceId: 'botw' });
    const wrapper = (id: string) => all.find((w) => w.entity.id === id)!;
    const node = (id: string) => wrapper(id).raw;
    expect(node('botw-demo::jessamy::JessamyLead')).toMatchObject({
      kind: 'class', bases: 'JessamyRoot', methods: 'JessamyLead;~JessamyLead;pluckJessamy;wakeJessamy;strumJessamy;tuneJessamy',
      fields: 'mJessamyPitch_s;mJessamyCue_d;mJessamyLane_m;mJessamyLink_a;mJessamyBeat',
    });
    expect(node('botw-demo::jessamy::JessamyMid')).toMatchObject({ kind: 'class', bases: 'JessamyLead', fields: 'mJessamyMute_s' });
    expect(node(`botw-demo::jessamy::JessamyMid::(definitions@${MID.cpp})`)).toMatchObject({ methods: 'JessamyMid;tuneJessamy' });
    // The parent pass: the chain first → middle → last links across the three initials, the cross-row child links to the seventh AI
    // row's node (the raw base stays as written), and a parent no record answers stays an explicit marker, never a guessed link.
    expect(wrapper('botw-demo::jessamy::JessamyMid').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::jessamy::JessamyLead', role: 'extends' }]);
    expect(wrapper('botw-demo::jessamy::JessamyTail').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::jessamy::JessamyMid', role: 'extends' }]);
    expect(wrapper('botw-demo::jessamy::JessamyKin').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::jessamy::JessamyElder', role: 'extends' }]);
    expect(node('botw-demo::jessamy::JessamyKin')).toMatchObject({ bases: 'JessamyElder' });
    expect(wrapper('botw-demo::jessamy::JessamyLead').entity.links ?? []).toEqual([]);
    expect(wrapper('botw-demo::jessamy::JessamyLead').entity.data).toMatchObject({ unresolvedLinks: [{ role: 'extends', ref: 'JessamyRoot' }] });
    expect(first.links.unresolved.filter((u) => u.ref === 'JessamyRoot')).toHaveLength(1);

    // THE SAME-NAME PAIR: one bare class name in this row (namespace A) and under one of the Action folder's alternatives
    // (namespace B). Each child names it bare and links to the class of its OWN namespace; nothing is ambiguous.
    expect(wrapper('botw-demo::jessamy::JessamyTwin').raw.file).toBe(SAME.h);
    expect(wrapper('botw-demo::jessamyact::JessamyTwin').raw.file).toBe(ACT_SAME);
    expect(wrapper('botw-demo::jessamy::JessamyEcho').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::jessamy::JessamyTwin', role: 'extends' }]);
    expect(wrapper('botw-demo::jessamyact::JessamyEchoAct').entity.links).toEqual([{ catalogId: 'state-graph', entityId: 'botw-demo::jessamyact::JessamyTwin', role: 'extends' }]);
    expect(node('botw-demo::jessamy::JessamyEcho')).toMatchObject({ bases: 'JessamyTwin' });
    expect(node('botw-demo::jessamyact::JessamyEchoAct')).toMatchObject({ bases: 'JessamyTwin' });
    expect(first.links.ambiguous ?? []).toEqual([]);
    expect(first.links.unresolved.filter((u) => u.ref === 'JessamyTwin')).toEqual([]);
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
