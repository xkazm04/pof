// W14: the fifth generic behaviour-node row (Backlog item 8): the rest of the stem row's initial plus the next initial. The
// spec glob language has no negation, so "the initial but not the stem" is written as ONE alternation that enumerates the
// continuations present at the pin, beside the next initial: <prefix>{<alt>,…}*.{h,cpp}. It is read by BOTH source-code
// techniques over that one glob — a cpp-decls spec under the shared node map at the end of the cpp-decls block, and its
// cpp-handles twin last, both in the row's own catalog (vault Decisions Z-D59, Z-D60). The glob must read the row's code files
// and nothing else, and must share no file with the stem row's specs (an overlap would wrap one file twice under one id).
// Every row path below — the prefix, the alternatives, the stem, the initials — is DERIVED from the registered specs at run
// time; every line of C++, every name and the one hex value in it was coined for this test (each checked whole-word against
// the reference clone before the first run: 0 hits).
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
// Pinned to this row by position among the row specs (vault Z-D57): the fifth row spec, the stem row's spec before it.
const SPEC = ROW_SPECS[4];
const EARLIER = ROW_SPECS[3];
const INITIAL_ROW = ROW_SPECS[2];
const twinOf = (file: string) => BOTW.tables.find((t) => t.technique === 'cpp-handles' && t.file === file)!;
const TWIN = twinOf(SPEC.file);
const EARLIER_TWIN = twinOf(EARLIER.file);
// The next row's spec follows this one (vault Z-D65).
const LATER = ROW_SPECS[5];
const LATER_TWIN = twinOf(LATER.file);
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
const filePart = (file: string) => file.slice(FOLDER.length + 1);
// An initial row's file part: <prefix>{<initial>,…}*.{<ext>,…} — it names the folder's prefix.
const INITIAL_SHAPE = /^([^{}*/]*)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(filePart(INITIAL_ROW.file));
const [, PREFIX, EARLY_INITIALS] = INITIAL_SHAPE ?? ['', '', ''];
// The stem row's file part: <prefix><stem>*.{<ext>,…}
const STEM_SHAPE = /^([^{}*/]*)\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(filePart(EARLIER.file));
const STEM = (STEM_SHAPE?.[1] ?? '').slice(PREFIX.length);
const INITIAL = STEM.slice(0, 1);
// This row's file part: <prefix>{<alternative>,…}*.{<ext>,…} — each alternative a capital and lower-case letters.
const SHAPE = /^([^{}*/]*)\{([A-Z][a-z]*(?:,[A-Z][a-z]*)*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(filePart(SPEC.file));
const [, ROW_PREFIX, ALT_LIST, EXTS] = SHAPE ?? ['', '', '', ''];
const ALTS = ALT_LIST.split(',');
const UNDER_INITIAL = ALTS.filter((a) => a.startsWith(INITIAL));
const NEXT_INITIAL = ALTS.find((a) => a.length === 1) ?? '';
const LONGEST = [...UNDER_INITIAL].sort((a, b) => b.length - a.length)[0] ?? '';
const LOWER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => c.toLowerCase());
const readByRow = (name: string) => ALTS.some((a) => name.startsWith(a));
// A continuation of the initial that the row does NOT list and that is not the stem: one at the second letter, one at the
// longest alternative's own depth (it shares that alternative's head and parts from it at its last letter).
const OUTSIDE_SHORT = LOWER.map((c) => `${INITIAL}${c}`).find((h) => !readByRow(h) && !UNDER_INITIAL.some((a) => a.startsWith(h)) && !STEM.startsWith(h)) ?? '';
const OUTSIDE_DEEP = LOWER.map((c) => `${LONGEST.slice(0, -1)}${c}`).find((h) => !readByRow(h) && !STEM.startsWith(h)) ?? '';
const rowFile = (head: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${head}${tail}.${ext}`;

const LEAD = { h: rowFile(UNDER_INITIAL[0], 'QuillHarp', 'h'), cpp: rowFile(UNDER_INITIAL[0], 'QuillHarp', 'cpp') };
const TRAIL = { h: rowFile(NEXT_INITIAL, 'QuillHarp', 'h'), cpp: rowFile(NEXT_INITIAL, 'QuillHarp', 'cpp') };
const STEM_ROW = rowFile(STEM, 'QuillHarp', 'h');
const EARLY_ROW = rowFile(EARLY_INITIALS.split(',').at(-1)!, 'veHarp', 'h');

const FILES: Record<string, string> = {
  // A node with a parameter of each of the five scopes the row uses, a one-shot hook, and no runtime state.
  [LEAD.h]: `
namespace demo::harp {
class HarpLead : public HarpRoot {
public:
    explicit HarpLead(const Kit& kit);
    ~HarpLead() override;
    bool pluckHarp() override;
    void wakeHarp(Satchel* satchel) override;
    void tuneHarp() override;
protected:
    // harp_fixed at offset 0x6e2f
    const float* mHarpPitch_s{};
    // harp_call at offset 0x6e2f
    demo::Phrase mHarpCue_d{};
    // harp_call_alt at offset 0x6e2f
    demo::Spot* mHarpAim_d{};
    // harp_placed at offset 0x6e2f
    const int* mHarpLane_m{};
    // harp_shared at offset 0x6e2f
    void* mHarpLink_a{};
};
}`,
  [LEAD.cpp]: `
#include "quillHarp.h"
namespace demo::harp {
HarpLead::HarpLead(const Kit& kit) : HarpRoot(kit) {}
HarpLead::~HarpLead() = default;
bool HarpLead::pluckHarp() { return HarpRoot::pluckHarp(); }
void HarpLead::wakeHarp(Satchel* satchel) { HarpRoot::wakeHarp(satchel); }
void HarpLead::tuneHarp() { bindKnob(&mHarpPitch_s, "HarpPitch"); bindKnob(&mHarpCue_d, "HarpCue"); }
}`,
  // A node under the next initial whose parent is a node of ANOTHER row (the stem row's file below), named bare.
  [TRAIL.h]: `
namespace demo::harp {
class HarpTrail : public HarpSide {
public:
    explicit HarpTrail(const Kit& kit);
    ~HarpTrail() override;
    void tuneHarp() override;
protected:
    // harp_fixed at offset 0x6e2f
    const bool* mHarpMute_s{};
};
}`,
  [TRAIL.cpp]: `
#include "quillHarpTrail.h"
namespace demo::harp {
HarpTrail::HarpTrail(const Kit& kit) : HarpSide(kit) {}
HarpTrail::~HarpTrail() = default;
void HarpTrail::tuneHarp() { HarpSide::tuneHarp(); bindKnob(&mHarpMute_s, "HarpMute"); }
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'wireDemoFolder(quillHarp.cpp)\n',
  // Read by the STEM row's spec (its handle twin finds no handle in it), never by this row's.
  [STEM_ROW]: 'namespace demo::harp { class HarpSide : public HarpRoot { int mSidePace; }; }',
  // Read by an initial row's spec, never by this row's.
  [EARLY_ROW]: 'namespace demo { class EveHarp { int mEvePace; }; }',
  // Stay open: two continuations of the initial the row does not list, a lower-case alternative, another extension, a deeper
  // folder, and a look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OUTSIDE_SHORT, 'Harp', 'h')]: 'namespace demo { class FarHarp { int mFarPace; }; }',
  [rowFile(OUTSIDE_DEEP, 'Harp', 'h')]: 'namespace demo { class NearHarp { int mNearPace; }; }',
  [rowFile(NEXT_INITIAL.toLowerCase(), 'QuillHarp', 'h')]: 'namespace demo { class LowHarp { int mLowPace; }; }',
  [rowFile(UNDER_INITIAL[0], 'QuillNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/coinedDeep/${PREFIX}${NEXT_INITIAL}QuillDeep.h`]: 'namespace demo { class DeepHarp { int mDeepPace; }; }',
  [`${FOLDER}Draft/${PREFIX}${NEXT_INITIAL}QuillTwin.h`]: 'namespace demo { class TwinHarp { int mTwinPace; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, TRAIL.h, TRAIL.cpp].sort();
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !ROW.includes(f) && f !== STEM_ROW && f !== EARLY_ROW && !f.endsWith('CMakeLists.txt')).sort();

/** Every name that could sit on the border of the two rows: each head of the stem followed by each letter, and every alternative. */
function borderProbes(): string[] {
  const heads = [...STEM].map((_, i) => STEM.slice(0, i + 1));
  const letters = [...LOWER, ...LOWER.map((c) => c.toUpperCase())];
  const names = [...heads.flatMap((h) => letters.map((c) => `${h}${c}`)), ...ALTS, STEM];
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

describe('BOTW generic behaviour-node rows: the fifth row, an enumerated glob beside the stem, read by both techniques (W14)', () => {
  it('ends the cpp-decls block with the row and appends its handle twin last: one glob, one catalog, the two shared maps', () => {
    expect(ROW_SPECS).toHaveLength(6);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    // The next row's spec directly follows this one and ends the cpp-decls block; this row's twin is directly followed by
    // the next row's twin, which is the last table (vault Z-D65).
    expect(BOTW.tables.indexOf(LATER)).toBe(BOTW.tables.indexOf(SPEC) + 1);
    expect(BOTW.tables.indexOf(LATER)).toBe(DECL_SPECS.length - 1);
    expect(BOTW.tables.indexOf(TWIN)).toBe(BOTW.tables.indexOf(EARLIER_TWIN) + 1);
    expect(BOTW.tables.indexOf(LATER_TWIN)).toBe(BOTW.tables.indexOf(TWIN) + 1);
    expect(BOTW.tables.at(-1)).toBe(LATER_TWIN);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(TWIN).toMatchObject({ file: SPEC.file, catalogId: SPEC.catalogId, technique: 'cpp-handles', keyColumn: 'qualifiedName' });
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(TWIN.map).toBe(PARAMETER_HANDLE_MAP);
    // The same folder and prefix as the earlier rows; the alternatives continue the stem's initial, plus one next initial.
    expect(INITIAL_SHAPE).not.toBeNull();
    expect(STEM_SHAPE).not.toBeNull();
    expect(SHAPE).not.toBeNull();
    expect(ROW_PREFIX).toBe(PREFIX);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(STEM).toMatch(/^[A-Z][a-z]+$/);
    expect(UNDER_INITIAL.length).toBeGreaterThan(1);
    expect(UNDER_INITIAL.every((a) => a.length > 1)).toBe(true);
    expect(NEXT_INITIAL.charCodeAt(0)).toBe(INITIAL.charCodeAt(0) + 1);
    expect(ALTS).toEqual([...UNDER_INITIAL, NEXT_INITIAL]);
    // The derived "outside" heads exist, so the stay-open fixtures below are real continuations of the initial.
    expect(OUTSIDE_SHORT).toHaveLength(2);
    expect(OUTSIDE_DEEP.length).toBe(LONGEST.length);
  });

  it('shares no file with the stem row: no alternative and the stem begin one another, and no border probe is read by both', () => {
    // A name read by both globs would begin with an alternative AND with the stem, so one would begin the other.
    for (const alt of UNDER_INITIAL) {
      expect(STEM.startsWith(alt)).toBe(false);
      expect(alt.startsWith(STEM)).toBe(false);
    }
    const probes = borderProbes();
    for (const [mine, stem] of [[SPEC, EARLIER], [TWIN, EARLIER_TWIN]] as const) {
      const a = expandGlob(probes, mine.file);
      const b = expandGlob(probes, stem.file);
      expect(a.length).toBeGreaterThan(ALTS.length); // the instrument can fail: both globs really read probes
      expect(b.length).toBeGreaterThan(0);
      expect(a.filter((f) => b.includes(f))).toEqual([]);
    }
    // Over the probes and the fixture tree, no file is read by two specs of one technique.
    for (const specs of [DECL_SPECS, HANDLE_SPECS]) {
      for (const f of [...probes, ...Object.keys(FILES)]) {
        expect(specs.filter((s) => expandGlob([f], s.file).length).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reads the row\'s code files and nothing else, and its handle twin reads exactly the same files', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), TWIN.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([STEM_ROW]);
    expect(expandGlob(Object.keys(FILES), INITIAL_ROW.file)).toEqual([EARLY_ROW]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the stem row's file + the initial row's file covered; the build file descoped; the 6 others open.
    expect(cov).toMatchObject({ total: 13, covered: 6, descoped: 1, open: 6 });
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
    expect([...new Set(reads)].sort()).toEqual([...ROW, STEM_ROW, EARLY_ROW].sort());
    expect(first.tables[BOTW.tables.indexOf(SPEC)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
    });
    expect(first.tables[BOTW.tables.indexOf(TWIN)]).toMatchObject({
      file: SPEC.file, catalogId: 'state-graph', status: 'ingested', rows: 6, unclassified: [], declaredButAbsent: [],
      duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 2, refused: [] },
    });
    // 4 node records + 6 handle records of the row, the stem row's 1 node record and the initial row's 1.
    expect(first.store).toEqual({ created: 12, rawChanged: 0, reprojected: 0, unchanged: 0 });

    const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' }).filter((w) => ROW.includes(w.raw.file));
    const nodes = rows.filter((w) => w.raw.kind !== 'handle');
    const handles = rows.filter((w) => w.raw.kind === 'handle');
    const byKey = (a: Record<string, string>, b: Record<string, string>) => a.qualifiedName.localeCompare(b.qualifiedName);
    // The node records are exactly what cpp-decls returns on its own, file by file.
    const declsOnly = ROW.flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
    expect(nodes.map((w) => w.raw).sort(byKey)).toEqual([...declsOnly].sort(byKey));
    expect(nodes.every((w) => w.technique === 'cpp-decls@3')).toBe(true);
    expect(nodes.map((w) => w.entity.id).sort()).toEqual([
      'botw-demo::harp::HarpLead',
      `botw-demo::harp::HarpLead::(definitions@${LEAD.cpp})`,
      'botw-demo::harp::HarpTrail',
      `botw-demo::harp::HarpTrail::(definitions@${TRAIL.cpp})`,
    ]);
    // The handle records come from the two headers, exactly as cpp-handles reads them on its own.
    const handlesOnly = [LEAD.h, TRAIL.h].flatMap((f) => parseCppHandles(FILES[f], { file: f }).rows);
    expect(handles.map((w) => w.raw).sort(byKey)).toEqual([...handlesOnly].sort(byKey));
    expect(handles.every((w) => w.technique === 'cpp-handles@1')).toBe(true);
    expect(handles.map((w) => [w.raw.owner, w.raw.name, w.raw.marker, w.raw.typeKind]).sort()).toEqual([
      ['HarpLead', 'mHarpAim_d', 'harp_call_alt', 'named'], ['HarpLead', 'mHarpCue_d', 'harp_call', 'named'],
      ['HarpLead', 'mHarpLane_m', 'harp_placed', 'integer'], ['HarpLead', 'mHarpLink_a', 'harp_shared', 'void'],
      ['HarpLead', 'mHarpPitch_s', 'harp_fixed', 'real'], ['HarpTrail', 'mHarpMute_s', 'harp_fixed', 'boolean'],
    ]);
    const node = (id: string) => listWrappers(db, { sourceId: 'botw' }).find((w) => w.entity.id === id)!.raw;
    expect(node('botw-demo::harp::HarpLead')).toMatchObject({
      kind: 'class', bases: 'HarpRoot', methods: 'HarpLead;~HarpLead;pluckHarp;wakeHarp;tuneHarp',
      fields: 'mHarpPitch_s;mHarpCue_d;mHarpAim_d;mHarpLane_m;mHarpLink_a',
    });
    // The cross-row link: this row's node names its parent bare, and the parent's record is the stem row's, from the stem file.
    expect(node('botw-demo::harp::HarpTrail')).toMatchObject({ kind: 'class', bases: 'HarpSide', fields: 'mHarpMute_s' });
    expect(node('botw-demo::harp::HarpSide')).toMatchObject({ kind: 'class', file: STEM_ROW });
    expect(new Set(listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id)).size).toBe(12);
  });

  it('a second ingest over the same tree moves nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(first.store.created).toBe(12);
    const second = ingestSourceFromDir('botw', 'clone', syntheticDeps(db, []));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 12 });
  });
});
