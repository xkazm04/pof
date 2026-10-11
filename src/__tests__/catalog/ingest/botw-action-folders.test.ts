// W19: the two folders that close item 8's Action library — the area-volume folder and the NPC folder — and (W21) the NPC's AI
// folder beside them (vault Decisions Z-D84, Z-D85, Z-D93). Each is a flat folder read by BOTH source-code techniques over one
// glob directly in the folder (`<folder>/*.{h,cpp}`): a cpp-decls spec under the SHARED node map, and a cpp-handles twin, in the
// catalog the App Master ruled. They are not rows of the Action folder, so the nine row tests select their ROW_SPECS by PLACE
// (the shared-map decls specs directly in the Action folder), and this test selects the rest: FOLDER_SPECS = the shared-map decls
// specs in neither the Action folder nor the AI folder (the AI rows have their own tests). The three lists (Action rows, folders,
// AI rows) are asserted to partition the shared-map decls specs in registration order — the Action rows, the area folder, the NPC
// folder, the AI rows, then the NPC's AI folder, which ends the cpp-decls block (its twin is last of the table) — so no spec can
// drop out of all of them unseen. Every path below is DERIVED from the registered specs at run time (the folders from the globs,
// the Action and AI prefixes from the row globs, the neighbour folders from the camera specs and the folders' own parents); every
// line of C++, every name and the one hex value in it was coined for this test.
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
const ACTION_DIR = dirOf(SHARED_DECLS[0].file);
// The neighbour folders, derived: the camera specs' folders, and the AI folder the camera's own second folder name gives beside
// the Action folder (the AI folder holds the AI rows, which this test does not own — their tests do).
const CAMERA_DIRS = [...new Set(BOTW.tables.filter((t) => t.map === CAMERA_SHOT_NODE_MAP).map((t) => t.file.slice(0, t.file.indexOf('/**'))))];
const SIBLING_NAME = CAMERA_DIRS.map((d) => d.slice(d.lastIndexOf('/') + 1)).find((n) => n !== ACTION_DIR.slice(ACTION_DIR.lastIndexOf('/') + 1))!;
const AI_DIR = `${dirOf(ACTION_DIR)}/${SIBLING_NAME}`;
// The Action folder's rows (by PLACE), the AI folder's rows (by PLACE), and the folder specs: the shared-map decls specs in neither.
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === ACTION_DIR);
const AI_ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === AI_DIR);
const FOLDER_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) !== ACTION_DIR && dirOf(t.file) !== AI_DIR);
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const [AREA_SPEC, NPC_SPEC, NPC_AI_SPEC] = FOLDER_SPECS;
const AREA_TWIN = twinOf(AREA_SPEC.file);
const NPC_TWIN = twinOf(NPC_SPEC.file);
const NPC_AI_TWIN = twinOf(NPC_AI_SPEC.file);
const AI_TWINS = AI_ROW_SPECS.map((s) => twinOf(s.file));
const LAST_ROW = ROW_SPECS.at(-1)!;
const AREA_DIR = dirOf(AREA_SPEC.file);
const NPC_DIR = dirOf(NPC_SPEC.file);
const NPC_AI_DIR = dirOf(NPC_AI_SPEC.file);
const ROW_SHAPE = /^([a-z]+)(?:\{([A-Z][a-z]*(?:,[A-Z][a-z]*)*)\}|([A-Z][a-z]+))\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const AI_SHAPE = /^([a-z]+)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/;
const rowPart = (file: string) => file.slice(ACTION_DIR.length + 1);
const altsOf = (file: string) => { const m = ROW_SHAPE.exec(rowPart(file)); return m ? (m[2] ? m[2].split(',') : [m[3]]) : []; };
const PREFIX = ROW_SHAPE.exec(rowPart(ROW_SPECS[0].file))?.[1] ?? '';
const AI_PREFIX = AI_SHAPE.exec(AI_ROW_SPECS[0].file.slice(AI_DIR.length + 1))?.[1] ?? '';
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = UPPER.map((c) => c.toLowerCase());
const FOLDERS = [[AREA_DIR, AREA_SPEC, AREA_TWIN], [NPC_DIR, NPC_SPEC, NPC_TWIN], [NPC_AI_DIR, NPC_AI_SPEC, NPC_AI_TWIN]] as const;
const nameIn = (dir: string, stem: string, ext: string) => `${dir}/${PREFIX}${stem}.${ext}`;

const nodeHeader = (cls: string, parent: string, body: string) => `
namespace demo::heron {
class ${cls} : public ${parent} {
public:
    explicit ${cls}(const Kit& kit);
    ~${cls}() override;
${body}};
}`;
const nodeSource = (cls: string, parent: string, file: string, body: string) => `
#include "${file}.h"
namespace demo::heron {
${cls}::${cls}(const Kit& kit) : ${parent}(kit) {}
${cls}::~${cls}() = default;
${body}}`;

const AREA = { lead: nameIn(AREA_DIR, 'HeronLead', 'h'), leadCpp: nameIn(AREA_DIR, 'HeronLead', 'cpp'), echo: nameIn(AREA_DIR, 'HeronEcho', 'h'), echoCpp: nameIn(AREA_DIR, 'HeronEcho', 'cpp') };
const NPC = { talk: nameIn(NPC_DIR, 'HeronTalk', 'h'), talkCpp: nameIn(NPC_DIR, 'HeronTalk', 'cpp'), wait: nameIn(NPC_DIR, 'HeronWait', 'h'), waitCpp: nameIn(NPC_DIR, 'HeronWait', 'cpp') };
const NPC_AI = { alarm: nameIn(NPC_AI_DIR, 'HeronAlarm', 'h'), alarmCpp: nameIn(NPC_AI_DIR, 'HeronAlarm', 'cpp') };
const ROW_FILE = `${ACTION_DIR}/${PREFIX}${altsOf(ROW_SPECS[0].file)[0]}HeronRow.h`;
const CAM_FILE = nameIn(CAMERA_DIRS[0], 'HeronCam', 'h');
// The AI folder's first initial that no registered spec reads (derived with the matcher, so a later AI row moves it, not the test):
// the fixture IS the probe string the derivation tested, and stays open for every folder spec.
const aiProbe = (c: string, ext = 'h') => `${AI_DIR}/${AI_PREFIX}${c}Probe.${ext}`;
const AI_OPEN = UPPER.find((c) => !BOTW.tables.some((s) => expandGlob([aiProbe(c)], s.file).length))!;
const AI_NEIGHBOUR = aiProbe(AI_OPEN);

const FILES: Record<string, string> = {
  // The area folder: a lead with two placement-scope parameters and a runtime counter, and a shell (a preset of the lead).
  [AREA.lead]: nodeHeader('HeronLead', 'HeronRoot', `    void tuneHeron() override;
protected:
    // heron_placed at offset 0x2f9a
    const int* mHeronLane_m{};
    // heron_placed at offset 0x2f9a
    const bool* mHeronGate_m{};
    float mHeronBeat;
`),
  [AREA.leadCpp]: nodeSource('HeronLead', 'HeronRoot', 'heronLead', 'void HeronLead::tuneHeron() { bindPeg(&mHeronLane_m, "HeronLane"); bindPeg(&mHeronGate_m, "HeronGate"); }\n'),
  [AREA.echo]: nodeHeader('HeronEcho', 'HeronLead', ''),
  [AREA.echoCpp]: nodeSource('HeronEcho', 'HeronLead', 'heronEcho', ''),
  // The NPC folder: a talk with a per-actor-type and a per-call parameter, and a wait with one per-call parameter.
  [NPC.talk]: nodeHeader('HeronTalk', 'HeronRoot', `    void tuneHeron() override;
protected:
    // heron_fixed at offset 0x2f9a
    const float* mHeronPace_s{};
    // heron_call at offset 0x2f9a
    demo::Verse mHeronCue_d{};
`),
  [NPC.talkCpp]: nodeSource('HeronTalk', 'HeronRoot', 'heronTalk', 'void HeronTalk::tuneHeron() { bindPeg(&mHeronPace_s, "HeronPace"); bindPeg(&mHeronCue_d, "HeronCue"); }\n'),
  [NPC.wait]: nodeHeader('HeronWait', 'HeronRoot', `    void tuneHeron() override;
protected:
    // heron_call at offset 0x2f9a
    const int* mHeronBeat_d{};
`),
  [NPC.waitCpp]: nodeSource('HeronWait', 'HeronRoot', 'heronWait', 'void HeronWait::tuneHeron() { bindPeg(&mHeronBeat_d, "HeronBeat"); }\n'),
  // The NPC's AI folder: one alarm node with a per-call and a per-actor-type parameter and a runtime counter, and its source (the
  // real folder has one node and no build file): the class is declared in the header only, the source defines its methods.
  [NPC_AI.alarm]: nodeHeader('HeronAlarm', 'HeronRoot', `    void tuneHeron() override;
protected:
    // heron_call at offset 0x2f9a
    const float* mHeronLevel_d{};
    // heron_fixed at offset 0x2f9a
    const bool* mHeronMute_s{};
    int mHeronCount;
`),
  [NPC_AI.alarmCpp]: nodeSource('HeronAlarm', 'HeronRoot', 'heronAlarm', 'void HeronAlarm::tuneHeron() { bindPeg(&mHeronLevel_d, "HeronLevel"); bindPeg(&mHeronMute_s, "HeronMute"); }\n'),
  // The area and NPC folders' build files: descoped, never read.
  [`${AREA_DIR}/CMakeLists.txt`]: 'listHeronFiles(heronLead.cpp)\n',
  [`${NPC_DIR}/CMakeLists.txt`]: 'listHeronFiles(heronTalk.cpp)\n',
  // Read by the first row spec (an Action-folder file), never by a folder spec.
  [ROW_FILE]: 'namespace demo { class RowHeron { int mRowPeg; }; }',
  // Stay open, for ALL THREE folders: the folder's parent, the AI folder (a file under an initial no spec reads), another
  // extension, a deeper folder, a look-alike sibling folder whose name starts with the folder's name, and a lower-case variant of
  // the folder path; plus a camera folder's file, read by the camera spec.
  [nameIn(dirOf(AREA_DIR), 'HeronUp', 'h')]: 'namespace demo { class UpHeron { int mUpPeg; }; }',
  [nameIn(dirOf(NPC_DIR), 'HeronUp', 'h')]: 'namespace demo { class UpHeron { int mUpPeg; }; }',
  [AI_NEIGHBOUR]: 'namespace demo { class AiHeron { int mAiPeg; }; }',
  [nameIn(AREA_DIR, 'HeronNotes', 'txt')]: 'synthetic notes',
  [nameIn(NPC_DIR, 'HeronNotes', 'txt')]: 'synthetic notes',
  [nameIn(NPC_AI_DIR, 'HeronNotes', 'txt')]: 'synthetic notes',
  [`${AREA_DIR}/coinedDeep/${PREFIX}HeronDeep.h`]: 'namespace demo { class DeepHeron { int mDeepPeg; }; }',
  [`${NPC_DIR}/coinedDeep/${PREFIX}HeronDeep.h`]: 'namespace demo { class DeepHeron { int mDeepPeg; }; }',
  [`${NPC_AI_DIR}/coinedDeep/${PREFIX}HeronDeep.h`]: 'namespace demo { class DeepHeron { int mDeepPeg; }; }',
  [`${AREA_DIR}Draft/${PREFIX}HeronTwin.h`]: 'namespace demo { class TwinHeron { int mTwinPeg; }; }',
  [`${NPC_DIR}Draft/${PREFIX}HeronTwin.h`]: 'namespace demo { class TwinHeron { int mTwinPeg; }; }',
  [`${NPC_AI_DIR}Draft/${PREFIX}HeronTwin.h`]: 'namespace demo { class TwinHeron { int mTwinPeg; }; }',
  [`${AREA_DIR.toLowerCase()}/${PREFIX}HeronLow.h`]: 'namespace demo { class LowHeron { int mLowPeg; }; }',
  [`${NPC_DIR.toLowerCase()}/${PREFIX}HeronLow.h`]: 'namespace demo { class LowHeron { int mLowPeg; }; }',
  [`${NPC_AI_DIR.toLowerCase()}/${PREFIX}HeronLow.h`]: 'namespace demo { class LowHeron { int mLowPeg; }; }',
  [CAM_FILE]: 'namespace demo { class CamHeron { int mCamPeg; }; }',
};

const AREA_ROW = [AREA.lead, AREA.leadCpp, AREA.echo, AREA.echoCpp].sort();
const NPC_ROW = [NPC.talk, NPC.talkCpp, NPC.wait, NPC.waitCpp].sort();
const NPC_AI_ROW = [NPC_AI.alarm, NPC_AI.alarmCpp].sort();
const COVERED_ELSEWHERE = [ROW_FILE, CAM_FILE];
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !AREA_ROW.includes(f) && !NPC_ROW.includes(f) && !NPC_AI_ROW.includes(f) && !COVERED_ELSEWHERE.includes(f) && !f.endsWith('CMakeLists.txt')).sort();

/** Border probes: every letter in both cases and every row alternative, in every neighbour folder of the three folders. */
function neighbourProbes(): string[] {
  const dirs = [ACTION_DIR, dirOf(AREA_DIR), dirOf(NPC_DIR), ...CAMERA_DIRS, ...FOLDERS.flatMap(([d]) => [`${d}/coinedDeep`, `${d}Draft`])];
  const names = [...new Set([...UPPER, ...LOWER, ...ROW_SPECS.flatMap((s) => altsOf(s.file))])];
  const aiNames = [...UPPER, ...LOWER].flatMap((n) => ['h', 'cpp'].map((ext) => aiProbe(n, ext))); // the AI folder, under the AI prefix
  return [...dirs.flatMap((d) => names.flatMap((n) => ['h', 'cpp'].map((ext) => nameIn(d, `${n}Probe`, ext)))), ...aiNames];
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

describe('BOTW node folders: the area-volume folder, the NPC folder and the NPC\'s AI folder, read by both techniques under the shared node map (W19, W21)', () => {
  it('ROW_SPECS, FOLDER_SPECS and the AI row specs partition the shared-map decls specs: exactly three folders (area, NPC, NPC AI), the AI rows directly after the NPC folder, the NPC\'s AI folder directly after them and ending the block', () => {
    expect(ROW_SPECS).toHaveLength(10);
    expect(FOLDER_SPECS).toHaveLength(3);
    expect(AI_ROW_SPECS).toHaveLength(4);
    expect(ROW_SPECS.length + FOLDER_SPECS.length + AI_ROW_SPECS.length).toBe(SHARED_DECLS.length);
    // none dropped, none counted twice, in registration order: the Action rows, the area folder, the NPC folder, the AI rows, the NPC's AI folder
    expect(SHARED_DECLS).toEqual([...ROW_SPECS, AREA_SPEC, NPC_SPEC, ...AI_ROW_SPECS, NPC_AI_SPEC]);
    expect(DECL_SPECS.indexOf(AREA_SPEC)).toBe(DECL_SPECS.indexOf(LAST_ROW) + 1);
    expect(DECL_SPECS.indexOf(NPC_SPEC)).toBe(DECL_SPECS.indexOf(AREA_SPEC) + 1);
    expect(DECL_SPECS.indexOf(AI_ROW_SPECS[0])).toBe(DECL_SPECS.indexOf(NPC_SPEC) + 1); // the NPC folder is directly followed by the first AI row's spec
    for (const [i, row] of AI_ROW_SPECS.entries()) if (i > 0) expect(DECL_SPECS.indexOf(row)).toBe(DECL_SPECS.indexOf(AI_ROW_SPECS[i - 1]) + 1); // each AI row directly follows the previous one
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.indexOf(AI_ROW_SPECS.at(-1)!) + 1); // directly after the last AI row's spec …
    expect(DECL_SPECS.indexOf(NPC_AI_SPEC)).toBe(DECL_SPECS.length - 1); // … and ending the cpp-decls block
    // The row globs keep the action-prefix row shape, all in one folder: nothing is loosened.
    for (const s of ROW_SPECS) expect(ROW_SHAPE.exec(rowPart(s.file))?.[1]).toBe(PREFIX);
    for (const s of FOLDER_SPECS) expect(ROW_SHAPE.exec(s.file.slice(dirOf(s.file).length + 1))).toBeNull(); // a folder glob has no initial
  });

  it('registers each folder with its twin right after the previous place\'s twin, in the ruled catalog, the NPC\'s AI twin last of the table', () => {
    expect(BOTW.tables.indexOf(AREA_TWIN)).toBe(BOTW.tables.indexOf(twinOf(LAST_ROW.file)) + 1);
    expect(BOTW.tables.indexOf(NPC_TWIN)).toBe(BOTW.tables.indexOf(AREA_TWIN) + 1);
    expect(BOTW.tables.indexOf(AI_TWINS[0])).toBe(BOTW.tables.indexOf(NPC_TWIN) + 1); // the NPC twin is directly followed by the first AI row's twin
    for (const [i, twin] of AI_TWINS.entries()) if (i > 0) expect(BOTW.tables.indexOf(twin)).toBe(BOTW.tables.indexOf(AI_TWINS[i - 1]) + 1); // each AI row's twin directly follows the previous row's
    expect(BOTW.tables.indexOf(NPC_AI_TWIN)).toBe(BOTW.tables.indexOf(AI_TWINS.at(-1)!) + 1); // directly after the last AI row's twin …
    expect(BOTW.tables.at(-1)).toBe(NPC_AI_TWIN); // … and last of BOTW.tables, in the same catalog as its decls spec
    expect(HANDLE_SPECS.at(-1)).toBe(NPC_AI_TWIN);
    expect(AREA_SPEC).toMatchObject({ catalogId: 'zone-map', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(NPC_SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(NPC_AI_SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    for (const [, spec, twin] of FOLDERS) {
      expect(twin).toMatchObject({ file: spec.file, catalogId: spec.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
      expect(spec.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
      expect(twin.map).toBe(PARAMETER_HANDLE_MAP);
      // The glob is the folder's code files directly in it: `<folder>/*.{h,cpp}`, nothing deeper, no initial, no stem.
      expect(spec.file).toBe(`${dirOf(spec.file)}/*.{h,cpp}`);
    }
    expect(AREA_DIR).not.toBe(NPC_DIR);
    expect(dirOf(AREA_DIR)).not.toBe(dirOf(NPC_DIR));
    expect(AREA_DIR.startsWith(`${dirOf(ACTION_DIR)}/`)).toBe(true);
    expect(NPC_DIR.startsWith(`${dirOf(ACTION_DIR)}/`)).toBe(true);
    // The NPC's AI folder is the NPC folder's sibling named like the camera's second folder (the AI folder's name), in the NPC's parent.
    expect(NPC_AI_DIR).toBe(`${dirOf(NPC_DIR)}/${SIBLING_NAME}`);
    expect(NPC_AI_DIR).not.toBe(NPC_DIR);
    expect(NPC_AI_DIR).not.toBe(AI_DIR);
    expect(dirOf(NPC_AI_DIR)).toBe(dirOf(NPC_DIR));
  });

  it('shares no file with any other spec: every neighbour folder, letter and alternative probe is read by no folder spec, and none by two specs', () => {
    // Folders: the folder globs name a folder no other glob reaches (no row, no camera glob lies inside any of them), so no probe in
    // a neighbour folder (the Action folder, the AI folder, each parent, the camera folders, a deeper folder, a look-alike sibling)
    // can be read by a folder spec; the probes below show the globs really read files.
    const probes = neighbourProbes();
    const own = [[DECL_SPECS, [AREA_SPEC, NPC_SPEC, NPC_AI_SPEC]], [HANDLE_SPECS, [AREA_TWIN, NPC_TWIN, NPC_AI_TWIN]]] as const;
    for (const [specs, folderSpecs] of own) {
      for (const s of folderSpecs) expect(expandGlob(probes, s.file)).toEqual([]);
      // The instrument can fail: every row spec reads probes in the Action folder, and the camera specs read theirs.
      for (const row of ROW_SPECS) expect(expandGlob(probes, row.file).length).toBeGreaterThan(0);
      for (const f of probes) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
    // … and the AI rows really read probes of the AI folder (the neighbour the NPC's AI folder must not share files with).
    for (const row of AI_ROW_SPECS) expect(expandGlob(probes, row.file).length).toBeGreaterThan(0);
    for (const t of AI_TWINS) expect(expandGlob(probes, t.file).length).toBeGreaterThan(0);
    // Inside each folder, a probe is read by exactly that folder's spec and its twin, and by no other folder's spec.
    for (const [dir, spec, twin] of FOLDERS) {
      for (const n of [...UPPER, ...LOWER]) {
        for (const ext of ['h', 'cpp']) {
          const probe = nameIn(dir, `${n}Probe`, ext);
          expect(BOTW.tables.filter((s) => expandGlob([probe], s.file).length)).toEqual([spec, twin]);
        }
      }
      for (const [otherDir, otherSpec, otherTwin] of FOLDERS.filter(([d]) => d !== dir)) {
        expect(expandGlob([nameIn(otherDir, 'ZProbe', 'h')], spec.file)).toEqual([]);
        expect(expandGlob([nameIn(otherDir, 'ZProbe', 'h')], twin.file)).toEqual([]);
        expect(expandGlob([nameIn(dir, 'ZProbe', 'h')], otherSpec.file)).toEqual([]);
        expect(expandGlob([nameIn(dir, 'ZProbe', 'h')], otherTwin.file)).toEqual([]);
      }
    }
    // Over the fixture tree too, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of Object.keys(FILES)) expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
    }
  });

  it('each folder spec reads its folder\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    const all = Object.keys(FILES);
    expect(expandGlob(all, AREA_SPEC.file)).toEqual(AREA_ROW);
    expect(expandGlob(all, AREA_TWIN.file)).toEqual(AREA_ROW);
    expect(expandGlob(all, NPC_SPEC.file)).toEqual(NPC_ROW);
    expect(expandGlob(all, NPC_TWIN.file)).toEqual(NPC_ROW);
    expect(expandGlob(all, NPC_AI_SPEC.file)).toEqual(NPC_AI_ROW);
    expect(expandGlob(all, NPC_AI_TWIN.file)).toEqual(NPC_AI_ROW);
    expect(expandGlob(all, ROW_SPECS[0].file)).toEqual([ROW_FILE]);
    for (const row of ROW_SPECS.slice(1)) expect(expandGlob(all, row.file)).toEqual([]);
    for (const row of AI_ROW_SPECS) expect(expandGlob(all, row.file)).toEqual([]); // the AI rows read none of the fixtures (the AI-folder neighbour has an open initial)
    const cov = computePathCoverage(all, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 8 + 2 folder files + the row file + the camera file covered; the two build files descoped; the others open.
    expect(cov).toMatchObject({ total: all.length, covered: 12, descoped: 2, open: STAY_OPEN.length });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.openFiles).toContain(AI_NEIGHBOUR);
    expect(cov.specs.find((s) => s.pattern === AREA_SPEC.file)?.files).toBe(4);
    expect(cov.specs.find((s) => s.pattern === NPC_SPEC.file)?.files).toBe(4);
    expect(cov.specs.find((s) => s.pattern === NPC_AI_SPEC.file)?.files).toBe(2);
  });

  it('both maps classify every column of their technique', () => {
    for (const [, spec, twin] of FOLDERS) {
      for (const [columns, map] of [[CPP_RECORD_COLUMNS, spec.map], [CPP_HANDLE_COLUMNS, twin.map]] as const) {
        const audit = auditColumns([...columns], map);
        expect(audit.unclassified).toEqual([]);
        expect(audit.declaredButAbsent).toEqual([]);
      }
    }
  });

  it('wraps node and handle records from the same files, the node records byte-identical to a cpp-decls-only read', () => {
    const db = new Database(':memory:');
    const reads: string[] = [];
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, reads));
    expect([...new Set(reads)].sort()).toEqual([...AREA_ROW, ...NPC_ROW, ...NPC_AI_ROW, ROW_FILE, CAM_FILE].sort());
    expect(first.tables[BOTW.tables.indexOf(AREA_SPEC)]).toMatchObject({
      file: AREA_SPEC.file, catalogId: 'zone-map', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(AREA_TWIN)]).toMatchObject({
      file: AREA_SPEC.file, catalogId: 'zone-map', status: 'ingested', rows: 2, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 3, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(NPC_SPEC)]).toMatchObject({
      file: NPC_SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(NPC_TWIN)]).toMatchObject({
      file: NPC_SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 3, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 2, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(NPC_AI_SPEC)]).toMatchObject({
      file: NPC_AI_SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 2, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 2, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(NPC_AI_TWIN)]).toMatchObject({
      file: NPC_AI_SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 2, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 2, withoutRecords: 1, refused: [] },
    });
    // 4 + 4 + 2 node records, 2 + 3 + 2 handle records, and the one node record each of the Action-folder file and the camera file.
    expect(first.store).toEqual({ created: 19, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    for (const [files, catalogId, nodeCount, handleCount] of [[AREA_ROW, 'zone-map', 4, 2], [NPC_ROW, 'state-graph', 4, 3], [NPC_AI_ROW, 'state-graph', 2, 2]] as const) {
      const rows = listWrappers(db, { sourceId: 'botw', catalogId }).filter((w) => files.includes(w.raw.file));
      const nodes = rows.filter((w) => w.raw.kind !== 'handle');
      const handles = rows.filter((w) => w.raw.kind === 'handle');
      // The node records are exactly what cpp-decls returns on its own, file by file.
      expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...files.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows)].sort(byKey));
      expect(nodes).toHaveLength(nodeCount);
      expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
      // The handle records are exactly what cpp-handles returns on its own; the runtime counter is no handle.
      expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...files.flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows)].sort(byKey));
      expect(handles).toHaveLength(handleCount);
      expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    }
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::heron::HeronLead')).toMatchObject({ kind: 'class', bases: 'HeronRoot', fields: 'mHeronLane_m;mHeronGate_m;mHeronBeat' });
    // The shell is a preset of the lead: construction and destruction only, no field.
    expect(node('botw-demo::heron::HeronEcho')).toMatchObject({ kind: 'class', bases: 'HeronLead', methods: 'HeronEcho;~HeronEcho', fields: '' });
    expect(node('botw-demo::heron::HeronTalk')).toMatchObject({ kind: 'class', fields: 'mHeronPace_s;mHeronCue_d' });
    // The NPC's AI folder's node: declared in its header only, its source defines the methods (a definition record, never a second class).
    expect(node('botw-demo::heron::HeronAlarm')).toMatchObject({ kind: 'class', bases: 'HeronRoot', methods: 'HeronAlarm;~HeronAlarm;tuneHeron', fields: 'mHeronLevel_d;mHeronMute_s;mHeronCount' });
    expect(node(`botw-demo::heron::HeronAlarm::(definitions@${NPC_AI.alarmCpp})`)).toMatchObject({ kind: 'definition', methods: 'HeronAlarm;~HeronAlarm;tuneHeron' });
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(19);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(19);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 19 });
  });
});
