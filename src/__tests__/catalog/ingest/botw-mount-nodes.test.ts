// W04: the BOTW mount spec. Its glob must read the area's code files in both sub-folders and nothing
// else (above all not the three descoped build files, and no sibling folder of src/Game/Actor/ —
// not even one whose name merely STARTS with the area's name), its class map must classify every
// reader column, and a second ingest must move nothing. The tree below copies only the reference's
// PATHS; every line of C++ in it was written for this test.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BOTW_DESCOPES, MOUNT_CLASS_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const AREA = 'src/Game/Actor/Horse';

const FILES: Record<string, string> = {
  // A selector node: decides on entry, never updates per frame; one tunable.
  [`${AREA}/AI/demoGaitPicker.h`]: `
namespace demo::steed {
class GaitPicker : public PickerNode {
public:
    explicit GaitPicker(const Setup& setup);
    ~GaitPicker() override;
    void beginStint(Satchel* satchel) override;
    void readKnobs() override;
protected:
    const float* mPickDelay{};
};
}`,
  [`${AREA}/AI/demoGaitPicker.cpp`]: `
#include "demoGaitPicker.h"
namespace demo::steed {
GaitPicker::GaitPicker(const Setup& setup) : PickerNode(setup) {}
GaitPicker::~GaitPicker() = default;
void GaitPicker::beginStint(Satchel* satchel) { PickerNode::beginStint(satchel); }
void GaitPicker::readKnobs() { readTunable(&mPickDelay, "PickDelay"); }
}`,
  // An action node that updates per frame, with a tunable and a per-call input.
  [`${AREA}/Action/demoGrazeStep.h`]: `
namespace demo::steed {
class GrazeStep : public StepNode {
public:
    explicit GrazeStep(const Setup& setup);
    void beginStint(Satchel* satchel) override;
    void tickStint() override;
    void readKnobs() override;
protected:
    const float* mChewTime{};
    Spot* mPasture{};
};
}`,
  [`${AREA}/Action/demoGrazeStep.cpp`]: `
#include "demoGrazeStep.h"
namespace demo::steed {
GrazeStep::GrazeStep(const Setup& setup) : StepNode(setup) {}
void GrazeStep::beginStint(Satchel* satchel) { StepNode::beginStint(satchel); }
void GrazeStep::tickStint() { StepNode::tickStint(); }
void GrazeStep::readKnobs() { readTunable(&mChewTime, "ChewTime"); }
}`,
  // A node that extends another node of its family and carries no member of its own.
  [`${AREA}/Action/demoSlowGrazeStep.h`]: `
namespace demo::steed {
class SlowGrazeStep : public GrazeStep {
public:
    explicit SlowGrazeStep(const Setup& setup);
    void tickStint() override;
};
}`,
  [`${AREA}/Action/demoSlowGrazeStep.cpp`]: `
#include "demoSlowGrazeStep.h"
namespace demo::steed {
SlowGrazeStep::SlowGrazeStep(const Setup& setup) : GrazeStep(setup) {}
void SlowGrazeStep::tickStint() { GrazeStep::tickStint(); }
}`,
  // The area's three build files: descoped, so the spec may not read them.
  [`${AREA}/CMakeLists.txt`]: 'wireDemoFolder(AI Action)\n',
  [`${AREA}/AI/CMakeLists.txt`]: 'wireDemoFolder(demoGaitPicker.cpp)\n',
  [`${AREA}/Action/CMakeLists.txt`]: 'wireDemoFolder(demoGrazeStep.cpp)\n',
  // Siblings stay open: a folder whose name starts with the area's name, and the generic node rows.
  'src/Game/Actor/HorseDraft/demoDraftStep.h': 'namespace demo { class DraftStep { int mDrafted; }; }',
  'src/Game/Actor/HorseDraft/demoDraftStep.cpp': 'namespace demo { void DraftStep::sketch() {} }',
  'src/Game/Actor/AI/demoRovePicker.h': 'namespace demo { class RovePicker : public PickerNode { int mRoveCount; }; }',
  'src/Game/Actor/Action/demoRoveStep.h': 'namespace demo { class RoveStep : public StepNode { float mRoveSpan; }; }',
  // An earlier spec's area, so the run shows the two specs side by side.
  'src/Game/Actor/Player/demoRunner.h': 'namespace demo::act { class Runner : public NodeBase { float mPaceLeft; }; }',
};

const areaFiles = () => Object.keys(FILES)
  .filter((f) => f.startsWith(`${AREA}/`) && !f.endsWith('CMakeLists.txt')).sort();
const spec = BOTW.tables.find((t) => t.file.startsWith(`${AREA}/`));

describe('BOTW mount spec (W04)', () => {
  it('registers one spec for the area, wrap-only, under state-graph', () => {
    expect(BOTW.tables).toHaveLength(5);
    expect(spec).toMatchObject({ file: `${AREA}/**/*.{h,cpp}`, catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(spec!.map).toBe(MOUNT_CLASS_MAP);
  });

  it('the glob reads the code files of both sub-folders and nothing else', () => {
    expect(areaFiles()).toHaveLength(6);
    expect(expandGlob(Object.keys(FILES), spec!.file)).toEqual(areaFiles());
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 6 area files and 1 Player file covered; the area's 3 build files descoped; the 4 sibling files open.
    expect(cov).toMatchObject({ total: 14, covered: 7, descoped: 3, open: 4 });
    expect(cov.openFiles).toEqual([
      'src/Game/Actor/AI/demoRovePicker.h',
      'src/Game/Actor/Action/demoRoveStep.h',
      'src/Game/Actor/HorseDraft/demoDraftStep.cpp',
      'src/Game/Actor/HorseDraft/demoDraftStep.h',
    ]);
    expect(cov.specs.find((s) => s.pattern === spec!.file)?.files).toBe(6);
  });

  it('classifies every reader column: bases, methods and fields stay gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], MOUNT_CLASS_MAP);
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

    it('wraps one class per header and one definition owner per source with 0 unclassified columns, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([...areaFiles(), 'src/Game/Actor/Player/demoRunner.h'].sort());
      expect(first.tables.find((t) => t.file === spec!.file)).toMatchObject({
        catalogId: 'state-graph', status: 'ingested', rows: 6, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 6, withoutRecords: 0, refused: [] },
      });
      expect(first.store).toEqual({ created: 7, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const wrapped = listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' });
      expect(wrapped.map((w) => w.raw.kind).sort()).toEqual(['class', 'class', 'class', 'definition', 'definition', 'definition']);
      expect(wrapped.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::steed::GaitPicker',
        'botw-demo::steed::GaitPicker::(definitions)',
        'botw-demo::steed::GrazeStep',
        'botw-demo::steed::GrazeStep::(definitions)',
        'botw-demo::steed::SlowGrazeStep',
        'botw-demo::steed::SlowGrazeStep::(definitions)',
      ]);
      const raw = (id: string) => wrapped.find((w) => w.entity.id === id)?.raw;
      expect(raw('botw-demo::steed::GaitPicker')).toMatchObject({ bases: 'PickerNode', methods: 'GaitPicker;~GaitPicker;beginStint;readKnobs', fields: 'mPickDelay' });
      expect(raw('botw-demo::steed::GrazeStep')).toMatchObject({ bases: 'StepNode', fields: 'mChewTime;mPasture' });
      expect(raw('botw-demo::steed::SlowGrazeStep')).toMatchObject({ bases: 'GrazeStep', fields: '' });
      expect(raw('botw-demo::steed::GrazeStep::(definitions)')).toMatchObject({ methods: 'GrazeStep;beginStint;tickStint;readKnobs' });

      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'player-movement' })).toHaveLength(1);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 7 });
    });
  });
});
