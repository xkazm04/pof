// W10: the second generic behaviour-node row (Backlog item 8), appended after the first under the SAME shared map
// and its own catalog label. Its glob must read its own code files and nothing else: not the folder's descoped build
// file, not a file of the first row's initials, not an initial after its own, not a lower-case one, not the mount
// test's synthetic file in the same folder, not a deeper folder and not a look-alike sibling folder. Every row path
// below is DERIVED from the registered specs at run time (prefix, initials, extensions), so no file name of the
// reference is written out here; every line of C++ and every name in it was coined for it.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const ROW_SPECS = BOTW.tables.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
const [EARLIER, SPEC] = ROW_SPECS;
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
// A row glob's file part: <prefix>{<initial>,…}*.{<ext>,…}
const shapeOf = (file: string) => /^([^{}*/]*)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(file.slice(FOLDER.length + 1));
const SHAPE = shapeOf(SPEC.file);
const [, PREFIX, INITIALS, EXTS] = SHAPE ?? ['', '', '', ''];
const [FIRST, SECOND] = INITIALS.split(',');
const EARLIER_INITIALS = (shapeOf(EARLIER.file)?.[2] ?? '').split(',');
const OPEN_INITIAL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((i) => BOTW.tables.every((t) => !expandGlob([`${FOLDER}/${PREFIX}${i}Probe.h`], t.file).length))!;
const rowFile = (initial: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${initial}${tail}.${ext}`;

const LEAD = { h: rowFile(FIRST, 'inderVeil', 'h'), cpp: rowFile(FIRST, 'inderVeil', 'cpp') };
const SHELL = { h: rowFile(SECOND, 'uskVeil', 'h'), cpp: rowFile(SECOND, 'uskVeil', 'cpp') };
const EARLIER_ROW = rowFile(EARLIER_INITIALS[0], 'mberTrace', 'h');

const FILES: Record<string, string> = {
  // A node that runs per frame and once, with a static tunable, two per-call inputs whose names share one suffix,
  // a per-placement value and a tree-shared variable.
  [LEAD.h]: `
namespace demo::cue {
class CinderVeil : public CueRoot {
public:
    explicit CinderVeil(const Kit& kit);
    ~CinderVeil() override;
    void wakeCue(Satchel* satchel) override;
    void paceCue() override;
    bool onceCue() override;
    void tuneCue() override;
protected:
    const float* mVeilGlow_s{};
    Waymark mVeilMark_d{};
    int* mVeilPulse_d{};
    int mVeilSpan_m{};
    void* mVeilLink_a{};
};
}`,
  [LEAD.cpp]: `
#include "cinderVeil.h"
namespace demo::cue {
CinderVeil::CinderVeil(const Kit& kit) : CueRoot(kit) {}
CinderVeil::~CinderVeil() = default;
void CinderVeil::wakeCue(Satchel* satchel) { CueRoot::wakeCue(satchel); }
void CinderVeil::paceCue() { CueRoot::paceCue(); }
bool CinderVeil::onceCue() { return true; }
void CinderVeil::tuneCue() { tuneDial(&mVeilGlow_s, "VeilGlow"); }
}`,
  // A shell: extends the node above and declares construction and destruction only.
  [SHELL.h]: `
namespace demo::cue {
class DuskVeil : public CinderVeil {
public:
    explicit DuskVeil(const Kit& kit);
    ~DuskVeil() override;
};
}`,
  [SHELL.cpp]: `
#include "duskVeil.h"
namespace demo::cue {
DuskVeil::DuskVeil(const Kit& kit) : CinderVeil(kit) {}
DuskVeil::~DuskVeil() = default;
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'wireDemoFolder(cinderVeil.cpp)\n',
  // Read by the EARLIER row's spec, never by this one.
  [EARLIER_ROW]: 'namespace demo { class AmberTrace { int mAmberPace; }; }',
  // Stay open: an initial no spec reads, a lower-case initial, another extension, the mount test's synthetic file,
  // a deeper folder, and a look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(OPEN_INITIAL, 'quillDraft', 'h')]: 'namespace demo { class QuillDraft { int mQuillPace; }; }',
  [rowFile(FIRST.toLowerCase(), 'inderDraft', 'h')]: 'namespace demo { class LowVeil { int mLowPace; }; }',
  [rowFile(FIRST, 'inderNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/demoRoveStep.h`]: 'namespace demo { class RoveStep : public StepNode { float mRoveSpan; }; }',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}inderDeep.h`]: 'namespace demo { class DeepVeil { int mDeepPace; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}inderTwin.h`]: 'namespace demo { class TwinVeil { int mTwinPace; }; }',
};

const ROW = [LEAD.h, LEAD.cpp, SHELL.h, SHELL.cpp].sort();
const STAY_OPEN = Object.keys(FILES)
  .filter((f) => !ROW.includes(f) && f !== EARLIER_ROW && !f.endsWith('CMakeLists.txt')).sort();

describe('BOTW generic behaviour-node rows: the second row (W10)', () => {
  it('appends the second row after the first: same folder, prefix and extensions, the next initials, the shared map', () => {
    expect(ROW_SPECS).toHaveLength(6);
    expect(BOTW.tables.indexOf(SPEC)).toBe(BOTW.tables.indexOf(EARLIER) + 1);
    expect(SPEC.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(SPEC).toMatchObject({ catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(SHAPE).not.toBeNull();
    expect(EARLIER.file.slice(0, EARLIER.file.lastIndexOf('/'))).toBe(FOLDER);
    expect(shapeOf(EARLIER.file)?.[1]).toBe(PREFIX);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
    expect(INITIALS.split(',')).toHaveLength(2);
    expect(FIRST.charCodeAt(0)).toBe(EARLIER_INITIALS.at(-1)!.charCodeAt(0) + 1);
    expect(SECOND.charCodeAt(0)).toBe(FIRST.charCodeAt(0) + 1);
    expect(OPEN_INITIAL.charCodeAt(0)).toBeGreaterThan(SECOND.charCodeAt(0));
  });

  it('reads the row\'s code files and nothing else', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    expect(expandGlob(Object.keys(FILES), EARLIER.file)).toEqual([EARLIER_ROW]);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files + the earlier row's file covered; the build file descoped; the 6 others open.
    expect(cov).toMatchObject({ total: 12, covered: 5, descoped: 1, open: 6 });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(4);
    expect(cov.specs.find((s) => s.pattern === EARLIER.file)?.files).toBe(1);
  });

  it('the row\'s map classifies every reader column', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], SPEC.map);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
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

    it('wraps one class per header and one definition owner per source, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([...ROW, EARLIER_ROW].sort());
      expect(first.tables.find((t) => t.file === SPEC.file)).toMatchObject({
        catalogId: 'cutscenes', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.store).toEqual({ created: 5, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'cutscenes' });
      expect(rows.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::cue::CinderVeil',
        `botw-demo::cue::CinderVeil::(definitions@${LEAD.cpp})`,
        'botw-demo::cue::DuskVeil',
        `botw-demo::cue::DuskVeil::(definitions@${SHELL.cpp})`,
      ]);
      const raw = (id: string) => rows.find((w) => w.entity.id === id)?.raw;
      // The two per-call inputs share one suffix, so the record cannot tell their kinds apart (names only).
      expect(raw('botw-demo::cue::CinderVeil')).toMatchObject({
        kind: 'class', bases: 'CueRoot', methods: 'CinderVeil;~CinderVeil;wakeCue;paceCue;onceCue;tuneCue',
        fields: 'mVeilGlow_s;mVeilMark_d;mVeilPulse_d;mVeilSpan_m;mVeilLink_a',
      });
      expect(raw('botw-demo::cue::DuskVeil')).toMatchObject({ kind: 'class', bases: 'CinderVeil', methods: 'DuskVeil;~DuskVeil', fields: '' });
      expect(raw(`botw-demo::cue::CinderVeil::(definitions@${LEAD.cpp})`)).toMatchObject({
        kind: 'definition', methods: 'CinderVeil;~CinderVeil;wakeCue;paceCue;onceCue;tuneCue',
      });

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 5 });
    });
  });
});
