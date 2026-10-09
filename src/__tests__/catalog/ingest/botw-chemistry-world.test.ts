// W03: the BOTW chemistry and world specs. Each registered glob must read its own folder's code
// files and nothing else (above all not the folder's build file — descoped — and no sibling
// KingSystem folder), each class map must classify every reader column for every record kind the
// area holds, and a second ingest must move nothing. The tree below copies only the reference's
// PATHS; every line of C++ in it was written for this test.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BOTW_DESCOPES, CHEMISTRY_CLASS_MAP, WORLD_CLASS_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const CHEM = 'src/KingSystem/Chemical';
const WORLD = 'src/KingSystem/World';

const FILES: Record<string, string> = {
  // A read-only interface and the body behind it: two class records.
  [`${CHEM}/demoKilnHull.h`]: `
namespace demo::kiln {
class IKilnHull {
public:
    virtual float hullWarmth() const = 0;
};
class KilnHull : public TuneObj, public IKilnHull {
public:
    KilnHull();
    float hullWarmth() const override { return mWarmth.peekValue(); }
private:
    Tune<float> mWarmth;
    Tune<float> mSparkCap;
};
}`,
  [`${CHEM}/demoKilnHull.cpp`]: `
#include "demoKilnHull.h"
namespace demo::kiln {
KilnHull::KilnHull() : mWarmth(0.f, "warmth", this), mSparkCap(1.f, "spark_cap", this) {}
}`,
  // A rule-book with two nested property structs: class + struct + struct.
  [`${CHEM}/demoKilnLedger.h`]: `
namespace demo::kiln {
class KilnLedger : public TuneFile {
public:
    struct Ember : TuneObj { Ember(); Tune<float> mGlowRate; Tune<float> mDampRate; };
    struct Stuff : TuneObj { Tune<float> mKindleAt; Tune<float> mSoakUp; };
    void readLedger();
private:
    Stuff mFallbackStuff;
};
}`,
  // Definitions of two owners (the rule-book and its nested struct): two definition records.
  [`${CHEM}/demoKilnLedger.cpp`]: `
#include "demoKilnLedger.h"
namespace demo::kiln {
KilnLedger::Ember::Ember() = default;
void KilnLedger::readLedger() {}
}`,
  // An enumeration written as one macro call stays invisible; the scoped enum after it is read and
  // the forward declaration is not a record: one enum record.
  [`${WORLD}/demoSkyKinds.h`]: `
namespace demo::skies {
DEMO_LISTING(Watch, Firstlight, Lastlight)
enum class Overcast { Bright, Mizzle, Squall };
enum class Belt;
}`,
  // A world job with a nested enum and a nested struct: class + enum + struct.
  [`${WORLD}/demoSkyTicker.h`]: `
namespace demo::skies {
class SkyTicker : public SkyTask {
public:
    enum class Lunation { Swelling, Shrinking };
    struct Bell { int mBellHour; };
    SkyTicker();
    bool isSquallAt(const Point3d& at) const;
private:
    float mTickHour;
    Bell mBell;
};
}`,
  [`${WORLD}/demoSkyTicker.cpp`]: `
#include "demoSkyTicker.h"
namespace demo::skies {
SkyTicker::SkyTicker() = default;
bool SkyTicker::isSquallAt(const Point3d& at) const { return false; }
}`,
  // An include-only source: read, but no record.
  [`${WORLD}/demoSkyStub.cpp`]: '#include "demoSkyTicker.h"\n',
  // Build files: descoped, so neither spec may read them.
  [`${CHEM}/CMakeLists.txt`]: 'wireDemoFolder(demoKilnHull.cpp)\n',
  [`${WORLD}/CMakeLists.txt`]: 'wireDemoFolder(demoSkyTicker.cpp)\n',
  // Siblings: still open, and a name that merely starts like an area is not the area.
  'src/KingSystem/WorldDraft/demoDraftSky.h': 'namespace demo { class DraftSky { int mDrafted; }; }',
  'src/KingSystem/ChemicalNotes/demoKilnNote.h': 'namespace demo { class KilnNote { int mNoted; }; }',
  'src/KingSystem/Ecosystem/demoBiomeBand.h': 'namespace demo { class BiomeBand { int mBandSize; }; }',
  // The two earlier specs' areas, so the run shows all four specs side by side.
  'src/Game/Actor/Player/demoRunner.h': 'namespace demo::act { class Runner : public NodeBase { float mPaceLeft; }; }',
  'src/KingSystem/Resource/GeneralParamList/demoGroupBlade.h': 'namespace demo::params { class BladeGroup : public TunableGroup { Tunable<int> mReach; }; }',
};

const areaFiles = (area: string) => Object.keys(FILES)
  .filter((f) => f.startsWith(`${area}/`) && !f.endsWith('CMakeLists.txt')).sort();
const specFor = (area: string) => BOTW.tables.find((t) => t.file.startsWith(`${area}/`));
const chem = specFor(CHEM);
const world = specFor(WORLD);

describe('BOTW chemistry + world specs (W03)', () => {
  it('registers one spec per folder, wrap-only: Chemical under status-effects, World under zone-map', () => {
    expect(BOTW.tables).toHaveLength(5);
    expect(chem).toMatchObject({ file: `${CHEM}/**/*.{h,cpp}`, catalogId: 'status-effects', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(world).toMatchObject({ file: `${WORLD}/**/*.{h,cpp}`, catalogId: 'zone-map', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(chem!.map).toBe(CHEMISTRY_CLASS_MAP);
    expect(world!.map).toBe(WORLD_CLASS_MAP);
  });

  it('each glob reads its own folder\'s code files and nothing else', () => {
    expect(expandGlob(Object.keys(FILES), chem!.file)).toEqual(areaFiles(CHEM));
    expect(expandGlob(Object.keys(FILES), world!.file)).toEqual(areaFiles(WORLD));
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 4 + 4 area files, 1 Player file, 1 parameter-group file covered; the two build files descoped;
    // the three siblings open.
    expect(cov).toMatchObject({ total: 15, covered: 10, descoped: 2, open: 3 });
    expect(cov.openFiles).toEqual([
      'src/KingSystem/ChemicalNotes/demoKilnNote.h',
      'src/KingSystem/Ecosystem/demoBiomeBand.h',
      'src/KingSystem/WorldDraft/demoDraftSky.h',
    ]);
    expect(cov.specs.find((s) => s.pattern === chem!.file)?.files).toBe(4);
    expect(cov.specs.find((s) => s.pattern === world!.file)?.files).toBe(4);
  });

  it('classifies every reader column: Chemical drops bases and methods and keeps fields a gap', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], CHEMISTRY_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams', 'bases', 'methods'],
      gap: [{ column: 'fields' }],
    });
  });

  it('classifies every reader column: World keeps bases, methods and fields as gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], WORLD_CLASS_MAP);
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

    it('wraps every record kind with 0 unclassified columns, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([
        ...areaFiles(CHEM), ...areaFiles(WORLD),
        'src/Game/Actor/Player/demoRunner.h', 'src/KingSystem/Resource/GeneralParamList/demoGroupBlade.h',
      ].sort());
      expect(first.tables.find((t) => t.file === chem!.file)).toMatchObject({
        catalogId: 'status-effects', status: 'ingested', rows: 8, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.tables.find((t) => t.file === world!.file)).toMatchObject({
        catalogId: 'zone-map', status: 'ingested', rows: 5, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 1, refused: [] },
      });
      expect(first.store).toEqual({ created: 15, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const chemWrapped = listWrappers(db, { sourceId: 'botw', catalogId: 'status-effects' });
      expect(chemWrapped.map((w) => w.raw.kind).sort()).toEqual(['class', 'class', 'class', 'definition', 'definition', 'definition', 'struct', 'struct']);
      expect(chemWrapped.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::kiln::IKilnHull',
        'botw-demo::kiln::KilnHull',
        'botw-demo::kiln::KilnHull::(definitions)',
        'botw-demo::kiln::KilnLedger',
        'botw-demo::kiln::KilnLedger::(definitions)',
        'botw-demo::kiln::KilnLedger::Ember',
        'botw-demo::kiln::KilnLedger::Ember::(definitions)',
        'botw-demo::kiln::KilnLedger::Stuff',
      ]);

      const worldWrapped = listWrappers(db, { sourceId: 'botw', catalogId: 'zone-map' });
      expect(worldWrapped.map((w) => w.raw.kind).sort()).toEqual(['class', 'definition', 'enum', 'enum', 'struct']);
      expect(worldWrapped.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::skies::Overcast',
        'botw-demo::skies::SkyTicker',
        'botw-demo::skies::SkyTicker::(definitions)',
        'botw-demo::skies::SkyTicker::Bell',
        'botw-demo::skies::SkyTicker::Lunation',
      ]);
      expect(worldWrapped.find((w) => w.entity.id === 'botw-demo::skies::Overcast')?.raw).toMatchObject({ kind: 'enum', fields: 'Bright;Mizzle;Squall' });
      expect(worldWrapped.find((w) => w.entity.id === 'botw-demo::skies::SkyTicker::(definitions)')?.raw).toMatchObject({ methods: 'SkyTicker;isSquallAt' });

      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'player-movement' })).toHaveLength(1);
      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'items' })).toHaveLength(1);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 15 });
    });
  });
});
