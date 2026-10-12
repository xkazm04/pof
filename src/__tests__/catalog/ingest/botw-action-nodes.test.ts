// W09: the first row of the generic behaviour-node rows (Backlog item 8) and the ONE catalog-neutral map
// every later Action and AI row reuses. The row's glob must read its own code files and nothing else: not
// the folder's descoped build file, not a file with another initial (or a lower-case one), not the mount
// test's synthetic file in the same folder, not a deeper folder and not a look-alike sibling folder. Every
// row path below is DERIVED from the registered spec at run time (prefix, initials, extensions), so no file
// name of the reference is written out here; every line of C++ and every name in it was coined for it.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW, REFERENCE_SOURCES } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const SHARED_DECLS = BOTW.tables.filter((t) => t.map === BEHAVIOUR_NODE_ROW_MAP);
const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/'));
// The Action folder's rows, selected by PLACE (W19): the shared-map decls specs whose glob lies directly in the first one's folder; the folder specs registered after them are read by their own test.
const ROW_SPECS = SHARED_DECLS.filter((t) => dirOf(t.file) === dirOf(SHARED_DECLS[0].file));
const SPEC = ROW_SPECS[0];
const FOLDER = SPEC.file.slice(0, SPEC.file.lastIndexOf('/'));
// The row glob's file part: <prefix>{<initial>,…}*.{<ext>,…}
const SHAPE = /^([^{}*/]*)\{([A-Z](?:,[A-Z])*)\}\*\.\{([a-z]+(?:,[a-z]+)*)\}$/.exec(SPEC.file.slice(FOLDER.length + 1));
const [, PREFIX, INITIALS, EXTS] = SHAPE ?? ['', '', '', ''];
const [FIRST, SECOND] = INITIALS.split(',');
// The first initial that no spec over the row folder reads (W10: once a later row's spec reads the letter after
// this row's last initial, a fixed "next letter" would be covered by it).
const NEXT = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((i) => BOTW.tables.every((t) => !expandGlob([`${FOLDER}/${PREFIX}${i}Probe.h`], t.file).length))!;
const rowFile = (initial: string, tail: string, ext: string) => `${FOLDER}/${PREFIX}${initial}${tail}.${ext}`;

const TRAIL = { h: rowFile(FIRST, 'rdentTrek', 'h'), cpp: rowFile(FIRST, 'rdentTrek', 'cpp') };
const SHELL = { h: rowFile(SECOND, 'riskTrek', 'h'), cpp: rowFile(SECOND, 'riskTrek', 'cpp') };

const FILES: Record<string, string> = {
  // A node that runs per frame, with a static tunable, a dynamic input and a per-placement value.
  [TRAIL.h]: `
namespace demo::trek {
class ArdentTrek : public StrideRoot {
public:
    explicit ArdentTrek(const Kit& kit);
    ~ArdentTrek() override;
    void wakeStride(Satchel* satchel) override;
    void paceStride() override;
    void stillStride() override;
    void tuneStride() override;
protected:
    const float* mTrekPace_s{};
    Waymark mTrekGoal_d{};
    int mTrekLane_m{};
};
}`,
  [TRAIL.cpp]: `
#include "ardentTrek.h"
namespace demo::trek {
ArdentTrek::ArdentTrek(const Kit& kit) : StrideRoot(kit) {}
ArdentTrek::~ArdentTrek() = default;
void ArdentTrek::wakeStride(Satchel* satchel) { StrideRoot::wakeStride(satchel); }
void ArdentTrek::paceStride() { StrideRoot::paceStride(); }
void ArdentTrek::stillStride() { StrideRoot::stillStride(); }
void ArdentTrek::tuneStride() { tuneDial(&mTrekPace_s, "TrekPace"); }
}`,
  // A shell: extends the node above and declares construction only.
  [SHELL.h]: `
namespace demo::trek {
class BriskTrek : public ArdentTrek {
public:
    explicit BriskTrek(const Kit& kit);
};
}`,
  [SHELL.cpp]: `
#include "briskTrek.h"
namespace demo::trek {
BriskTrek::BriskTrek(const Kit& kit) : ArdentTrek(kit) {}
}`,
  // The folder's build file: descoped, never read.
  [`${FOLDER}/CMakeLists.txt`]: 'wireDemoFolder(ardentTrek.cpp)\n',
  // Stay open: another initial (the very probe that derives it, so no spec reads it by construction — W14: a later row
  // reads some lower-case continuations of that initial), a lower-case initial, another extension, the mount test's
  // synthetic file, a deeper folder, and a look-alike sibling folder whose name starts with the row folder's name.
  [rowFile(NEXT, 'Probe', 'h')]: 'namespace demo { class CalmTrek { int mCalmPace; }; }',
  [rowFile(FIRST.toLowerCase(), 'rdentDraft', 'h')]: 'namespace demo { class LowDraft { int mLowPace; }; }',
  [rowFile(FIRST, 'rdentNotes', 'txt')]: 'synthetic notes',
  [`${FOLDER}/demoRoveStep.h`]: 'namespace demo { class RoveStep : public StepNode { float mRoveSpan; }; }',
  [`${FOLDER}/coinedDeep/${PREFIX}${FIRST}rdentDeep.h`]: 'namespace demo { class DeepTrek { int mDeepPace; }; }',
  [`${FOLDER}Draft/${PREFIX}${FIRST}rdentTwin.h`]: 'namespace demo { class TwinTrek { int mTwinPace; }; }',
};

const ROW = [TRAIL.h, TRAIL.cpp, SHELL.h, SHELL.cpp].sort();
const STAY_OPEN = Object.keys(FILES).filter((f) => !ROW.includes(f) && !f.endsWith('CMakeLists.txt')).sort();

describe('BOTW generic behaviour-node rows (W09)', () => {
  it('registers the first row: one wrap-only spec under the shared node map, a flat glob over two initials', () => {
    expect(BOTW.tables).toHaveLength(65);
    expect(ROW_SPECS).toHaveLength(10);
    expect(SPEC).toMatchObject({ catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(SHAPE).not.toBeNull();
    expect(INITIALS.split(',')).toHaveLength(2);
    expect(EXTS.split(',').sort()).toEqual(['cpp', 'h']);
  });

  it('reads the row\'s code files and nothing else', () => {
    expect(expandGlob(Object.keys(FILES), SPEC.file)).toEqual(ROW);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 row files covered; the build file descoped; the 6 others open.
    expect(cov).toMatchObject({ total: 11, covered: 4, descoped: 1, open: 6 });
    expect(cov.openFiles).toEqual(STAY_OPEN);
    expect(cov.specs.find((s) => s.pattern === SPEC.file)?.files).toBe(4);
    expect(cov.openFiles).toContain(`${FOLDER}/demoRoveStep.h`);
  });

  it('the shared map classifies every reader column, its gaps name no catalog, and they say "mostly" and "shells"', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], BEHAVIOUR_NODE_ROW_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
    const catalogs = new Set(Object.values(REFERENCE_SOURCES).flatMap((s) => s.tables.map((t) => t.catalogId)));
    expect(catalogs.size).toBeGreaterThan(5); // the instrument can fail: the ids it looks for exist
    for (const { why } of audit.gap) {
      for (const id of catalogs) expect(why).not.toContain(id);
    }
    const reasonOf = (column: string) => audit.gap.find((g) => g.column === column)!.why;
    expect(reasonOf('fields')).toContain('mostly parameter handles');
    expect(reasonOf('methods')).toContain('shells');
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
      expect([...new Set(reads)].sort()).toEqual(ROW);
      expect(first.tables.find((t) => t.file === SPEC.file)).toMatchObject({
        catalogId: 'state-graph', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.store).toEqual({ created: 4, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const rows = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' });
      expect(rows.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::trek::ArdentTrek',
        `botw-demo::trek::ArdentTrek::(definitions@${TRAIL.cpp})`,
        'botw-demo::trek::BriskTrek',
        `botw-demo::trek::BriskTrek::(definitions@${SHELL.cpp})`,
      ]);
      const raw = (id: string) => rows.find((w) => w.entity.id === id)?.raw;
      expect(raw('botw-demo::trek::ArdentTrek')).toMatchObject({
        kind: 'class', bases: 'StrideRoot', methods: 'ArdentTrek;~ArdentTrek;wakeStride;paceStride;stillStride;tuneStride',
        fields: 'mTrekPace_s;mTrekGoal_d;mTrekLane_m',
      });
      expect(raw('botw-demo::trek::BriskTrek')).toMatchObject({ kind: 'class', bases: 'ArdentTrek', methods: 'BriskTrek', fields: '' });
      expect(raw(`botw-demo::trek::ArdentTrek::(definitions@${TRAIL.cpp})`)).toMatchObject({
        kind: 'definition', methods: 'ArdentTrek;~ArdentTrek;wakeStride;paceStride;stillStride;tuneStride',
      });

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 4 });
    });
  });
});
