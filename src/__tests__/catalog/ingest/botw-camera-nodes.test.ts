// W07: the BOTW camera specs — one per half of the camera's node library, sharing one map. Each glob
// must read its half's code files and nothing else (not the three descoped build files, not a mount or
// player file, not a look-alike folder beside a half, and not a sibling folder of src/Game/Actor/ whose
// name merely STARTS with the area's name), the map must classify every reader column, and a second
// ingest must move nothing. The tree below copies only the reference's PATHS; every line of C++ in it
// was written for this test, and every name in it was coined for it.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BOTW_DESCOPES, CAMERA_SHOT_NODE_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const AREA = 'src/Game/Actor/Camera';
const SHOTS = `${AREA}/Action`;
const CHOOSERS = `${AREA}/AI`;

const FILES: Record<string, string> = {
  // A shot node that runs per frame, with one per-context preset handle.
  [`${SHOTS}/demoLensTrail.h`]: `
namespace demo::lens {
class LensTrail : public TakeNode {
public:
    explicit LensTrail(const Rigging& rigging);
    ~LensTrail() override;
    void openTake(Clapper* clapper) override;
    void rollTake() override;
    void readDials() override;
protected:
    const char* mTrailPreset{};
};
}`,
  [`${SHOTS}/demoLensTrail.cpp`]: `
#include "demoLensTrail.h"
namespace demo::lens {
LensTrail::LensTrail(const Rigging& rigging) : TakeNode(rigging) {}
LensTrail::~LensTrail() = default;
void LensTrail::openTake(Clapper* clapper) { TakeNode::openTake(clapper); }
void LensTrail::rollTake() { TakeNode::rollTake(); }
void LensTrail::readDials() { readDial(&mTrailPreset, "TrailPreset"); }
}`,
  // A shell that extends another shot node and declares construction only.
  [`${SHOTS}/demoLensSweep.h`]: `
namespace demo::lens {
class LensSweep : public LensTrail {
public:
    explicit LensSweep(const Rigging& rigging);
};
}`,
  [`${SHOTS}/demoLensSweep.cpp`]: `
#include "demoLensSweep.h"
namespace demo::lens {
LensSweep::LensSweep(const Rigging& rigging) : LensTrail(rigging) {}
}`,
  // A chooser node: decides on entry, never runs per frame, carries nothing.
  [`${CHOOSERS}/demoLensPicker.h`]: `
namespace demo::lenspick {
class LensPicker : public PickNode {
public:
    explicit LensPicker(const Rigging& rigging);
    void openTake(Clapper* clapper) override;
};
}`,
  [`${CHOOSERS}/demoLensPicker.cpp`]: `
#include "demoLensPicker.h"
namespace demo::lenspick {
LensPicker::LensPicker(const Rigging& rigging) : PickNode(rigging) {}
void LensPicker::openTake(Clapper* clapper) { PickNode::openTake(clapper); }
}`,
  // The area's three build files: descoped, so neither spec may read them.
  [`${AREA}/CMakeLists.txt`]: 'wireDemoFolder(AI Action)\n',
  [`${CHOOSERS}/CMakeLists.txt`]: 'wireDemoFolder(demoLensPicker.cpp)\n',
  [`${SHOTS}/CMakeLists.txt`]: 'wireDemoFolder(demoLensTrail.cpp)\n',
  // Look-alikes stay open: a folder beside each half whose name starts like it, and a sibling of the area.
  [`${AREA}/ActionDraft/demoDraftTake.h`]: 'namespace demo { class DraftTake { int mDraftCut; }; }',
  [`${AREA}/AIDraft/demoDraftPick.h`]: 'namespace demo { class DraftPick { int mDraftChoice; }; }',
  'src/Game/Actor/CameraDraft/demoDraftLens.h': 'namespace demo { class DraftLens { int mDraftZoom; }; }',
  // Earlier specs' areas — a mount node and a player node — belong to their own specs.
  'src/Game/Actor/Horse/Action/demoCanterTake.h': 'namespace demo::steed { class CanterTake : public TakeNode { float mCanterPace; }; }',
  'src/Game/Actor/Player/demoStrollTake.h': 'namespace demo::stroller { class StrollTake : public TakeNode { float mStrollPace; }; }',
};

const under = (folder: string) => Object.keys(FILES)
  .filter((f) => f.startsWith(`${folder}/`) && !f.endsWith('CMakeLists.txt')).sort();
const specFor = (folder: string) => BOTW.tables.find((t) => t.file.startsWith(`${folder}/`));

describe('BOTW camera node specs (W07)', () => {
  it('registers one spec per half, wrap-only and sharing one map: shots under cutscenes, choosers under dialog-trees', () => {
    expect(BOTW.tables).toHaveLength(36);
    expect(specFor(SHOTS)).toMatchObject({ file: `${SHOTS}/**/*.{h,cpp}`, catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(specFor(CHOOSERS)).toMatchObject({ file: `${CHOOSERS}/**/*.{h,cpp}`, catalogId: 'dialog-trees', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(specFor(SHOTS)!.map).toBe(CAMERA_SHOT_NODE_MAP);
    expect(specFor(CHOOSERS)!.map).toBe(CAMERA_SHOT_NODE_MAP);
  });

  it('each glob reads its half\'s code files and nothing else', () => {
    expect(under(SHOTS)).toHaveLength(4);
    expect(under(CHOOSERS)).toHaveLength(2);
    expect(expandGlob(Object.keys(FILES), specFor(SHOTS)!.file)).toEqual(under(SHOTS));
    expect(expandGlob(Object.keys(FILES), specFor(CHOOSERS)!.file)).toEqual(under(CHOOSERS));
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 6 area files + the mount and player files covered; the 3 build files descoped; the 3 look-alikes open.
    expect(cov).toMatchObject({ total: 14, covered: 8, descoped: 3, open: 3 });
    expect(cov.openFiles).toEqual([
      'src/Game/Actor/Camera/AIDraft/demoDraftPick.h',
      'src/Game/Actor/Camera/ActionDraft/demoDraftTake.h',
      'src/Game/Actor/CameraDraft/demoDraftLens.h',
    ]);
    expect(cov.specs.find((s) => s.pattern === specFor(SHOTS)!.file)?.files).toBe(4);
    expect(cov.specs.find((s) => s.pattern === specFor(CHOOSERS)!.file)?.files).toBe(2);
  });

  it('classifies every reader column: bases, methods and fields stay gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], CAMERA_SHOT_NODE_MAP);
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
      expect([...new Set(reads)].sort()).toEqual([
        ...under(SHOTS), ...under(CHOOSERS),
        'src/Game/Actor/Horse/Action/demoCanterTake.h', 'src/Game/Actor/Player/demoStrollTake.h',
      ].sort());
      expect(first.tables.find((t) => t.file === specFor(SHOTS)!.file)).toMatchObject({
        catalogId: 'cutscenes', status: 'ingested', rows: 4, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.tables.find((t) => t.file === specFor(CHOOSERS)!.file)).toMatchObject({
        catalogId: 'dialog-trees', status: 'ingested', rows: 2, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 2, withoutRecords: 0, refused: [] },
      });
      expect(first.store).toEqual({ created: 8, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const shots = listWrappers(db, { sourceId: 'botw', catalogId: 'cutscenes' });
      expect(shots.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::lens::LensSweep',
        'botw-demo::lens::LensSweep::(definitions@src/Game/Actor/Camera/Action/demoLensSweep.cpp)',
        'botw-demo::lens::LensTrail',
        'botw-demo::lens::LensTrail::(definitions@src/Game/Actor/Camera/Action/demoLensTrail.cpp)',
      ]);
      const raw = (id: string) => shots.find((w) => w.entity.id === id)?.raw;
      expect(raw('botw-demo::lens::LensTrail')).toMatchObject({ kind: 'class', bases: 'TakeNode', methods: 'LensTrail;~LensTrail;openTake;rollTake;readDials', fields: 'mTrailPreset' });
      expect(raw('botw-demo::lens::LensSweep')).toMatchObject({ kind: 'class', bases: 'LensTrail', methods: 'LensSweep', fields: '' });
      expect(raw('botw-demo::lens::LensTrail::(definitions@src/Game/Actor/Camera/Action/demoLensTrail.cpp)')).toMatchObject({ kind: 'definition', methods: 'LensTrail;~LensTrail;openTake;rollTake;readDials' });

      const choosers = listWrappers(db, { sourceId: 'botw', catalogId: 'dialog-trees' });
      expect(choosers.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::lenspick::LensPicker',
        'botw-demo::lenspick::LensPicker::(definitions@src/Game/Actor/Camera/AI/demoLensPicker.cpp)',
      ]);
      expect(choosers.find((w) => w.entity.id === 'botw-demo::lenspick::LensPicker')?.raw).toMatchObject({ bases: 'PickNode', methods: 'LensPicker;openTake', fields: '' });

      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' })).toHaveLength(1);
      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'player-movement' })).toHaveLength(1);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 8 });
    });
  });
});
